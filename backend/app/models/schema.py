"""Pydantic models for the knowledge graph."""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class EntityType(str, Enum):
    """Built-in entity types (seed schema + evolved)."""
    NOTE = "note"
    PERSON = "person"
    PLACE = "place"
    THING = "thing"
    CONCEPT = "concept"
    PROJECT = "project"


class Node(BaseModel):
    """A node in the knowledge graph."""
    id: str
    name: str
    entity_type: str
    content: Optional[str] = None
    metadata: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    access_count: int = 0

    class Config:
        from_attributes = True


class Edge(BaseModel):
    """An edge (relation) between nodes."""
    id: str
    source_id: str
    target_id: str
    relation_type: str
    weight: float = 1.0
    metadata: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_traversed: Optional[datetime] = None
    traversal_count: int = 0

    class Config:
        from_attributes = True


class Note(BaseModel):
    """User input note (before processing)."""
    content: str
    title: Optional[str] = None
    tags: list[str] = Field(default_factory=list)


class ExtractedEntity(BaseModel):
    """Entity extracted from text by GLiNER."""
    text: str
    label: str
    start: int
    end: int
    score: float


class QueryResult(BaseModel):
    """Result from a graph query."""
    nodes: list[Node]
    edges: list[Edge]
    traversed_path: list[str]
    response: Optional[str] = None
    latency_ms: float
    used_llm: bool = False


class SchemaType(BaseModel):
    """A schema type (evolved or seed)."""
    name: str
    count: int
    is_seed: bool = False
    evolved_from: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class GraphState(BaseModel):
    """Current state of the knowledge graph."""
    node_count: int
    edge_count: int
    schema_types: list[SchemaType]
    total_queries: int
    llm_calls: int
    avg_latency_ms: float


class AdaptationEvent(BaseModel):
    """Record of a schema adaptation."""
    event_type: str
    description: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    details: dict = Field(default_factory=dict)
