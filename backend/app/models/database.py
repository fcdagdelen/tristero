"""SQLite database for knowledge graph storage."""

import json
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from .schema import Node, Edge, SchemaType, AdaptationEvent


class Database:
    """SQLite-based graph database with JSON metadata support."""

    def __init__(self, db_path: str = "knowledge_graph.db"):
        self.db_path = Path(db_path)
        self.conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self):
        """Initialize database tables."""
        cursor = self.conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS nodes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                content TEXT,
                metadata TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                access_count INTEGER DEFAULT 0
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS edges (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL,
                target_id TEXT NOT NULL,
                relation_type TEXT NOT NULL,
                weight REAL DEFAULT 1.0,
                metadata TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                last_traversed TEXT,
                traversal_count INTEGER DEFAULT 0,
                FOREIGN KEY (source_id) REFERENCES nodes(id),
                FOREIGN KEY (target_id) REFERENCES nodes(id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS schema_types (
                name TEXT PRIMARY KEY,
                count INTEGER DEFAULT 0,
                is_seed INTEGER DEFAULT 0,
                evolved_from TEXT,
                created_at TEXT NOT NULL
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS adaptation_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                description TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                details TEXT DEFAULT '{}'
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS metrics (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                total_queries INTEGER DEFAULT 0,
                llm_calls INTEGER DEFAULT 0,
                total_latency_ms REAL DEFAULT 0
            )
        """)

        cursor.execute("""
            INSERT OR IGNORE INTO metrics (id, total_queries, llm_calls, total_latency_ms)
            VALUES (1, 0, 0, 0)
        """)

        seed_types = ["note", "person", "place", "thing"]
        for t in seed_types:
            cursor.execute("""
                INSERT OR IGNORE INTO schema_types (name, count, is_seed, created_at)
                VALUES (?, 0, 1, ?)
            """, (t, datetime.utcnow().isoformat()))

        cursor.execute("CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(entity_type)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id)")

        self.conn.commit()

    def create_node(self, name: str, entity_type: str, content: Optional[str] = None,
                    metadata: Optional[dict] = None) -> Node:
        node_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        meta_json = json.dumps(metadata or {})

        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO nodes (id, name, entity_type, content, metadata, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (node_id, name, entity_type, content, meta_json, now, now))

        cursor.execute("""
            INSERT INTO schema_types (name, count, is_seed, created_at)
            VALUES (?, 1, 0, ?)
            ON CONFLICT(name) DO UPDATE SET count = count + 1
        """, (entity_type, now))

        self.conn.commit()

        return Node(
            id=node_id, name=name, entity_type=entity_type, content=content,
            metadata=metadata or {}, created_at=datetime.fromisoformat(now),
            updated_at=datetime.fromisoformat(now)
        )

    def get_node(self, node_id: str) -> Optional[Node]:
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM nodes WHERE id = ?", (node_id,))
        row = cursor.fetchone()
        return self._row_to_node(row) if row else None

    def get_all_nodes(self) -> list[Node]:
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM nodes")
        return [self._row_to_node(row) for row in cursor.fetchall()]

    def update_node_access(self, node_id: str):
        cursor = self.conn.cursor()
        cursor.execute("""
            UPDATE nodes SET access_count = access_count + 1, updated_at = ?
            WHERE id = ?
        """, (datetime.utcnow().isoformat(), node_id))
        self.conn.commit()

    def find_node_by_name(self, name: str, entity_type: Optional[str] = None) -> Optional[Node]:
        cursor = self.conn.cursor()
        if entity_type:
            cursor.execute(
                "SELECT * FROM nodes WHERE LOWER(name) = LOWER(?) AND entity_type = ?",
                (name, entity_type)
            )
        else:
            cursor.execute("SELECT * FROM nodes WHERE LOWER(name) = LOWER(?)", (name,))
        row = cursor.fetchone()
        return self._row_to_node(row) if row else None

    def create_edge(self, source_id: str, target_id: str, relation_type: str,
                    weight: float = 1.0, metadata: Optional[dict] = None) -> Edge:
        edge_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        meta_json = json.dumps(metadata or {})

        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO edges (id, source_id, target_id, relation_type, weight, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (edge_id, source_id, target_id, relation_type, weight, meta_json, now))
        self.conn.commit()

        return Edge(
            id=edge_id, source_id=source_id, target_id=target_id,
            relation_type=relation_type, weight=weight, metadata=metadata or {},
            created_at=datetime.fromisoformat(now)
        )

    def get_edges_for_node(self, node_id: str) -> list[Edge]:
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM edges WHERE source_id = ? OR target_id = ?", (node_id, node_id))
        return [self._row_to_edge(row) for row in cursor.fetchall()]

    def get_all_edges(self) -> list[Edge]:
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM edges")
        return [self._row_to_edge(row) for row in cursor.fetchall()]

    def find_edge(self, source_id: str, target_id: str) -> Optional[Edge]:
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM edges
            WHERE (source_id = ? AND target_id = ?) OR (source_id = ? AND target_id = ?)
        """, (source_id, target_id, target_id, source_id))
        row = cursor.fetchone()
        return self._row_to_edge(row) if row else None

    def boost_edge(self, edge_id: str, boost_amount: float = 0.1):
        cursor = self.conn.cursor()
        cursor.execute("""
            UPDATE edges
            SET weight = MIN(weight + ?, 10.0),
                last_traversed = ?,
                traversal_count = traversal_count + 1
            WHERE id = ?
        """, (boost_amount, datetime.utcnow().isoformat(), edge_id))
        self.conn.commit()

    def decay_edges(self, decay_factor: float = 0.99):
        cursor = self.conn.cursor()
        cursor.execute("UPDATE edges SET weight = MAX(weight * ?, 0.1)", (decay_factor,))
        self.conn.commit()

    def get_schema_types(self) -> list[SchemaType]:
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM schema_types ORDER BY count DESC")
        return [
            SchemaType(
                name=row["name"], count=row["count"], is_seed=bool(row["is_seed"]),
                evolved_from=row["evolved_from"],
                created_at=datetime.fromisoformat(row["created_at"])
            )
            for row in cursor.fetchall()
        ]

    def create_schema_type(self, name: str, evolved_from: Optional[str] = None) -> SchemaType:
        now = datetime.utcnow().isoformat()
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT OR IGNORE INTO schema_types (name, count, is_seed, evolved_from, created_at)
            VALUES (?, 0, 0, ?, ?)
        """, (name, evolved_from, now))
        self.conn.commit()

        self.log_adaptation(
            "type_created",
            f"New entity type '{name}' created" + (f" (evolved from {evolved_from})" if evolved_from else ""),
            {"type_name": name, "evolved_from": evolved_from}
        )

        return SchemaType(name=name, count=0, is_seed=False, evolved_from=evolved_from,
                         created_at=datetime.fromisoformat(now))

    def log_adaptation(self, event_type: str, description: str, details: Optional[dict] = None):
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO adaptation_events (event_type, description, timestamp, details)
            VALUES (?, ?, ?, ?)
        """, (event_type, description, datetime.utcnow().isoformat(), json.dumps(details or {})))
        self.conn.commit()

    def get_recent_adaptations(self, limit: int = 10) -> list[AdaptationEvent]:
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM adaptation_events ORDER BY timestamp DESC LIMIT ?", (limit,))
        return [
            AdaptationEvent(
                event_type=row["event_type"], description=row["description"],
                timestamp=datetime.fromisoformat(row["timestamp"]),
                details=json.loads(row["details"])
            )
            for row in cursor.fetchall()
        ]

    def record_query(self, latency_ms: float, used_llm: bool):
        cursor = self.conn.cursor()
        cursor.execute("""
            UPDATE metrics
            SET total_queries = total_queries + 1,
                llm_calls = llm_calls + ?,
                total_latency_ms = total_latency_ms + ?
            WHERE id = 1
        """, (1 if used_llm else 0, latency_ms))
        self.conn.commit()

    def get_metrics(self) -> dict:
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM metrics WHERE id = 1")
        row = cursor.fetchone()
        total_queries = row["total_queries"]
        return {
            "total_queries": total_queries,
            "llm_calls": row["llm_calls"],
            "avg_latency_ms": row["total_latency_ms"] / total_queries if total_queries > 0 else 0
        }

    def _row_to_node(self, row) -> Node:
        return Node(
            id=row["id"], name=row["name"], entity_type=row["entity_type"],
            content=row["content"], metadata=json.loads(row["metadata"]),
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
            access_count=row["access_count"]
        )

    def _row_to_edge(self, row) -> Edge:
        return Edge(
            id=row["id"], source_id=row["source_id"], target_id=row["target_id"],
            relation_type=row["relation_type"], weight=row["weight"],
            metadata=json.loads(row["metadata"]),
            created_at=datetime.fromisoformat(row["created_at"]),
            last_traversed=datetime.fromisoformat(row["last_traversed"]) if row["last_traversed"] else None,
            traversal_count=row["traversal_count"]
        )

    def clear_all(self):
        """Clear all data from the database (for re-import)."""
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM edges")
        cursor.execute("DELETE FROM nodes")
        cursor.execute("DELETE FROM adaptation_events")
        cursor.execute("UPDATE schema_types SET count = 0 WHERE is_seed = 1")
        cursor.execute("DELETE FROM schema_types WHERE is_seed = 0")
        cursor.execute("UPDATE metrics SET total_queries = 0, llm_calls = 0, total_latency_ms = 0")
        self.conn.commit()

    def close(self):
        self.conn.close()
