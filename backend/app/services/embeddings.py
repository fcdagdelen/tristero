"""Embedding service using e5-small and ChromaDB."""

import time
from typing import Optional

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer


class EmbeddingService:
    """Handles text embeddings and semantic search using e5-small + ChromaDB."""

    def __init__(self, persist_dir: str = "./chroma_db"):
        self.model = SentenceTransformer("intfloat/e5-small-v2")
        self.client = chromadb.PersistentClient(
            path=persist_dir,
            settings=Settings(anonymized_telemetry=False)
        )
        self.collection = self.client.get_or_create_collection(
            name="nodes",
            metadata={"hnsw:space": "cosine"}
        )

    def embed_text(self, text: str) -> list[float]:
        prefixed = f"passage: {text}"
        embedding = self.model.encode(prefixed, normalize_embeddings=True)
        return embedding.tolist()

    def embed_query(self, query: str) -> list[float]:
        prefixed = f"query: {query}"
        embedding = self.model.encode(prefixed, normalize_embeddings=True)
        return embedding.tolist()

    def add_node(self, node_id: str, text: str, metadata: Optional[dict] = None):
        embedding = self.embed_text(text)
        self.collection.add(
            ids=[node_id],
            embeddings=[embedding],
            metadatas=[metadata or {}],
            documents=[text]
        )

    def delete_node(self, node_id: str):
        try:
            self.collection.delete(ids=[node_id])
        except Exception:
            pass

    def search(self, query: str, n_results: int = 10,
               filter_metadata: Optional[dict] = None) -> list[dict]:
        query_embedding = self.embed_query(query)
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=filter_metadata,
            include=["documents", "metadatas", "distances"]
        )

        formatted = []
        if results["ids"] and results["ids"][0]:
            for i, node_id in enumerate(results["ids"][0]):
                formatted.append({
                    "id": node_id,
                    "text": results["documents"][0][i] if results["documents"] else None,
                    "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                    "distance": results["distances"][0][i] if results["distances"] else 0,
                    "similarity": 1 - results["distances"][0][i] if results["distances"] else 1
                })
        return formatted

    def get_similar_nodes(self, node_id: str, n_results: int = 5) -> list[dict]:
        result = self.collection.get(ids=[node_id], include=["embeddings"])
        if not result["embeddings"]:
            return []

        embedding = result["embeddings"][0]
        results = self.collection.query(
            query_embeddings=[embedding],
            n_results=n_results + 1,
            include=["documents", "metadatas", "distances"]
        )

        formatted = []
        if results["ids"] and results["ids"][0]:
            for i, nid in enumerate(results["ids"][0]):
                if nid != node_id:
                    formatted.append({
                        "id": nid,
                        "text": results["documents"][0][i] if results["documents"] else None,
                        "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                        "similarity": 1 - results["distances"][0][i] if results["distances"] else 1
                    })
        return formatted[:n_results]

    def compute_similarity(self, text1: str, text2: str) -> float:
        emb1 = self.model.encode(f"passage: {text1}", normalize_embeddings=True)
        emb2 = self.model.encode(f"passage: {text2}", normalize_embeddings=True)
        return float(emb1 @ emb2)

    def get_collection_count(self) -> int:
        return self.collection.count()

    def clear_all(self):
        """Clear all embeddings from the collection."""
        # Delete and recreate the collection
        self.client.delete_collection("nodes")
        self.collection = self.client.get_or_create_collection(
            name="nodes",
            metadata={"hnsw:space": "cosine"}
        )
