"""Main graph service orchestrating all operations."""

import asyncio
import time
from collections import Counter
from typing import Optional, Any, Callable, Awaitable

from ..models.database import Database
from ..models.schema import Node, Edge, Note, QueryResult, GraphState, AdaptationEvent
from .embeddings import EmbeddingService
from .entities import EntityExtractor, normalize_entity_text
from .llm import LLMService

# Type for broadcast function
BroadcastFunc = Callable[[dict[str, Any]], Awaitable[None]]


class GraphService:
    """Orchestrates knowledge graph operations with adaptive ontology."""

    SIMILARITY_THRESHOLD = 0.7
    MERGE_SIMILARITY_THRESHOLD = 0.85
    TYPE_PROMOTION_THRESHOLD = 5

    def __init__(self, db_path: str = "knowledge_graph.db", chroma_path: str = "./chroma_db"):
        self.db = Database(db_path)
        self.embeddings = EmbeddingService(chroma_path)
        self.entities = EntityExtractor()
        self.llm = LLMService()
        self._type_counts: Counter = Counter()
        self._refresh_type_counts()

    def _refresh_type_counts(self):
        for schema_type in self.db.get_schema_types():
            self._type_counts[schema_type.name] = schema_type.count

    def add_note(self, note: Note) -> tuple[Node, list[Node], list[Edge]]:
        start = time.perf_counter()

        note_content = f"{note.title or ''}\n{note.content}".strip()
        note_node = self.db.create_node(
            name=note.title or note.content[:50] + "...",
            entity_type="note",
            content=note.content,
            metadata={"tags": note.tags}
        )

        self.embeddings.add_node(note_node.id, note_content, {"entity_type": "note"})

        extracted = self.entities.extract_clean(note.content)
        entity_nodes = []
        created_edges = []

        for ent in extracted:
            entity_node = self._find_or_create_entity(ent)
            entity_nodes.append(entity_node)

            edge = self.db.create_edge(
                source_id=note_node.id,
                target_id=entity_node.id,
                relation_type="mentions",
                weight=ent.score,
                metadata={"extraction_score": ent.score}
            )
            created_edges.append(edge)

        auto_edges = self._auto_link_similar(note_node, entity_nodes)
        created_edges.extend(auto_edges)

        similar_edges = self._link_to_similar_notes(note_node)
        created_edges.extend(similar_edges)

        self._check_adaptations()

        latency_ms = (time.perf_counter() - start) * 1000
        self.db.log_adaptation(
            "note_added",
            f"Added note '{note_node.name}' with {len(entity_nodes)} entities",
            {"latency_ms": latency_ms, "entity_count": len(entity_nodes)}
        )

        return note_node, entity_nodes, created_edges

    def _find_or_create_entity(self, extracted) -> Node:
        normalized = normalize_entity_text(extracted.text)
        existing = self.db.find_node_by_name(normalized)
        if existing:
            self.db.update_node_access(existing.id)
            return existing

        type_mapping = {
            "person": "person", "organization": "thing", "location": "place",
            "concept": "concept", "project": "project", "technology": "concept",
            "date": "thing", "event": "thing",
        }
        entity_type = type_mapping.get(extracted.label, "thing")

        node = self.db.create_node(
            name=extracted.text,
            entity_type=entity_type,
            content=None,
            metadata={"original_label": extracted.label, "extraction_score": extracted.score}
        )

        self.embeddings.add_node(node.id, extracted.text, {"entity_type": entity_type})
        self._type_counts[entity_type] += 1
        return node

    def _auto_link_similar(self, source_node: Node, entity_nodes: list[Node]) -> list[Edge]:
        edges = []
        for i, node_a in enumerate(entity_nodes):
            for node_b in entity_nodes[i+1:]:
                existing = self.db.find_edge(node_a.id, node_b.id)
                if existing:
                    self.db.boost_edge(existing.id, 0.2)
                else:
                    similarity = self.embeddings.compute_similarity(node_a.name, node_b.name)
                    if similarity > self.SIMILARITY_THRESHOLD:
                        edge = self.db.create_edge(
                            source_id=node_a.id, target_id=node_b.id,
                            relation_type="co_occurs", weight=similarity,
                            metadata={"similarity": similarity}
                        )
                        edges.append(edge)
        return edges

    def _link_to_similar_notes(self, note_node: Node) -> list[Edge]:
        edges = []
        similar = self.embeddings.get_similar_nodes(note_node.id, n_results=3)

        for sim in similar:
            if sim["similarity"] > self.SIMILARITY_THRESHOLD:
                similar_node = self.db.get_node(sim["id"])
                if similar_node and similar_node.entity_type == "note":
                    edge = self.db.create_edge(
                        source_id=note_node.id, target_id=sim["id"],
                        relation_type="similar_to", weight=sim["similarity"],
                        metadata={"similarity": sim["similarity"]}
                    )
                    edges.append(edge)
        return edges

    def query(self, query_text: str, use_llm: bool = True, max_results: int = 10) -> QueryResult:
        start = time.perf_counter()
        traversed_path = []

        search_results = self.embeddings.search(query_text, n_results=max_results)

        nodes = []
        for result in search_results:
            node = self.db.get_node(result["id"])
            if node:
                nodes.append(node)
                traversed_path.append(node.id)
                self.db.update_node_access(node.id)

        expanded_nodes = set(n.id for n in nodes)
        edges = []

        for node in nodes[:5]:
            node_edges = self.db.get_edges_for_node(node.id)
            for edge in node_edges:
                edges.append(edge)
                self.db.boost_edge(edge.id, 0.1)

                other_id = edge.target_id if edge.source_id == node.id else edge.source_id
                if other_id not in expanded_nodes:
                    other_node = self.db.get_node(other_id)
                    if other_node:
                        nodes.append(other_node)
                        expanded_nodes.add(other_id)
                        traversed_path.append(other_id)

        query_entities = self.entities.extract_with_context(query_text)
        for ent in query_entities:
            matching = self.db.find_node_by_name(ent.text)
            if matching and matching.id not in expanded_nodes:
                nodes.append(matching)
                traversed_path.append(matching.id)

        response = None
        used_llm = False

        if use_llm and self.llm.is_available() and nodes:
            context_nodes = [
                {"name": n.name, "entity_type": n.entity_type, "content": n.content or n.name}
                for n in nodes[:10]
            ]
            context_edges = []
            for e in edges[:5]:
                source = self.db.get_node(e.source_id)
                target = self.db.get_node(e.target_id)
                if source and target:
                    context_edges.append({
                        "source_name": source.name, "target_name": target.name,
                        "relation_type": e.relation_type
                    })

            response = self.llm.generate_response(query_text, context_nodes, context_edges)
            used_llm = True

        latency_ms = (time.perf_counter() - start) * 1000
        self.db.record_query(latency_ms, used_llm)
        self._check_query_adaptations(query_text, nodes)

        return QueryResult(
            nodes=nodes, edges=edges, traversed_path=traversed_path,
            response=response, latency_ms=latency_ms, used_llm=used_llm
        )

    async def query_streaming(
        self,
        query_text: str,
        broadcast: BroadcastFunc,
        use_llm: bool = True,
        max_results: int = 10
    ) -> QueryResult:
        """Query with real-time streaming of traversal events for visualization."""
        start = time.perf_counter()
        traversed_path = []

        # Phase 1: Embedding search with streaming
        search_results = self.embeddings.search(query_text, n_results=max_results)

        nodes = []
        for i, result in enumerate(search_results):
            node = self.db.get_node(result["id"])
            if node:
                nodes.append(node)
                traversed_path.append(node.id)
                self.db.update_node_access(node.id)

                # Stream: highlight this node as we find it
                await broadcast({
                    "type": "query_traversal",
                    "phase": "embedding_search",
                    "node_id": node.id,
                    "score": result.get("similarity", 0.8),
                    "delay_ms": 120
                })
                await asyncio.sleep(0.02)  # Small pause between broadcasts

        # Phase 2: Edge expansion with streaming
        expanded_nodes = set(n.id for n in nodes)
        edges = []

        for node in nodes[:5]:
            node_edges = self.db.get_edges_for_node(node.id)
            for edge in node_edges:
                edges.append(edge)
                self.db.boost_edge(edge.id, 0.1)

                # Stream: show edge being traversed
                await broadcast({
                    "type": "query_traversal",
                    "phase": "edge_expansion",
                    "node_id": node.id,
                    "edge_id": edge.id,
                    "delay_ms": 100
                })
                await asyncio.sleep(0.015)

                other_id = edge.target_id if edge.source_id == node.id else edge.source_id
                if other_id not in expanded_nodes:
                    other_node = self.db.get_node(other_id)
                    if other_node:
                        nodes.append(other_node)
                        expanded_nodes.add(other_id)
                        traversed_path.append(other_id)

                        # Stream: highlight newly discovered node
                        await broadcast({
                            "type": "query_traversal",
                            "phase": "edge_expansion",
                            "node_id": other_id,
                            "score": edge.weight * 0.7,
                            "delay_ms": 120
                        })
                        await asyncio.sleep(0.015)

        # Phase 3: Entity matching from query text
        query_entities = self.entities.extract_with_context(query_text)
        for ent in query_entities:
            matching = self.db.find_node_by_name(ent.text)
            if matching and matching.id not in expanded_nodes:
                nodes.append(matching)
                traversed_path.append(matching.id)

                # Stream: highlight exact entity match
                await broadcast({
                    "type": "query_traversal",
                    "phase": "entity_match",
                    "node_id": matching.id,
                    "score": 0.95,
                    "delay_ms": 120
                })
                await asyncio.sleep(0.02)

        # Phase 4: LLM thinking (if enabled)
        response = None
        used_llm = False

        if use_llm and self.llm.is_available() and nodes:
            # Stream: indicate LLM is processing
            await broadcast({
                "type": "query_traversal",
                "phase": "llm_thinking",
                "delay_ms": 250
            })

            context_nodes = [
                {"name": n.name, "entity_type": n.entity_type, "content": n.content or n.name}
                for n in nodes[:10]
            ]
            context_edges = []
            for e in edges[:5]:
                source = self.db.get_node(e.source_id)
                target = self.db.get_node(e.target_id)
                if source and target:
                    context_edges.append({
                        "source_name": source.name, "target_name": target.name,
                        "relation_type": e.relation_type
                    })

            response = self.llm.generate_response(query_text, context_nodes, context_edges)
            used_llm = True

        # Phase 5: Complete
        latency_ms = (time.perf_counter() - start) * 1000
        self.db.record_query(latency_ms, used_llm)
        self._check_query_adaptations(query_text, nodes)

        # Stream: signal completion
        await broadcast({
            "type": "query_traversal",
            "phase": "complete",
            "delay_ms": 50
        })

        return QueryResult(
            nodes=nodes, edges=edges, traversed_path=traversed_path,
            response=response, latency_ms=latency_ms, used_llm=used_llm
        )

    def _check_query_adaptations(self, query: str, accessed_nodes: list[Node]):
        type_access = Counter(n.entity_type for n in accessed_nodes)
        for entity_type, count in type_access.items():
            if count >= 3:
                self._type_counts[entity_type] += count
                if self._type_counts[entity_type] >= self.TYPE_PROMOTION_THRESHOLD:
                    schema_types = [s.name for s in self.db.get_schema_types()]
                    if entity_type not in schema_types:
                        self.db.create_schema_type(entity_type)

    def _check_adaptations(self):
        self._check_type_promotions()
        self.db.decay_edges(0.995)

    def _check_type_promotions(self):
        schema_types = {s.name for s in self.db.get_schema_types()}
        all_nodes = self.db.get_all_nodes()
        type_counts = Counter(n.entity_type for n in all_nodes)

        for entity_type, count in type_counts.items():
            if entity_type not in schema_types and count >= self.TYPE_PROMOTION_THRESHOLD:
                self.db.create_schema_type(entity_type)
                self.db.log_adaptation(
                    "type_promoted",
                    f"Entity type '{entity_type}' promoted to schema type ({count} entities)",
                    {"type": entity_type, "count": count}
                )

    def merge_entities(self, keep_id: str, merge_ids: list[str]) -> Node:
        keep_node = self.db.get_node(keep_id)
        if not keep_node:
            raise ValueError(f"Node {keep_id} not found")

        for merge_id in merge_ids:
            merge_node = self.db.get_node(merge_id)
            if not merge_node:
                continue

            edges = self.db.get_edges_for_node(merge_id)
            for edge in edges:
                if edge.source_id == merge_id:
                    self.db.create_edge(
                        source_id=keep_id, target_id=edge.target_id,
                        relation_type=edge.relation_type, weight=edge.weight
                    )
                else:
                    self.db.create_edge(
                        source_id=edge.source_id, target_id=keep_id,
                        relation_type=edge.relation_type, weight=edge.weight
                    )

            self.embeddings.delete_node(merge_id)

        self.db.log_adaptation(
            "entities_merged",
            f"Merged {len(merge_ids)} entities into '{keep_node.name}'",
            {"kept": keep_id, "merged": merge_ids}
        )

        return keep_node

    def get_state(self) -> GraphState:
        nodes = self.db.get_all_nodes()
        edges = self.db.get_all_edges()
        schema_types = self.db.get_schema_types()
        metrics = self.db.get_metrics()

        return GraphState(
            node_count=len(nodes), edge_count=len(edges),
            schema_types=schema_types, total_queries=metrics["total_queries"],
            llm_calls=metrics["llm_calls"], avg_latency_ms=metrics["avg_latency_ms"]
        )

    def get_full_graph(self) -> tuple[list[Node], list[Edge]]:
        return self.db.get_all_nodes(), self.db.get_all_edges()

    def get_recent_adaptations(self, limit: int = 10) -> list[AdaptationEvent]:
        return self.db.get_recent_adaptations(limit)

    def confirm_edge(self, edge_id: str):
        self.db.boost_edge(edge_id, 0.5)
        self.db.log_adaptation("edge_confirmed", "User confirmed edge", {"edge_id": edge_id})

    def reject_edge(self, edge_id: str):
        cursor = self.db.conn.cursor()
        cursor.execute("UPDATE edges SET weight = 0.1 WHERE id = ?", (edge_id,))
        self.db.conn.commit()
        self.db.log_adaptation("edge_rejected", "User rejected edge", {"edge_id": edge_id})
