"""FastAPI routes for the knowledge graph API."""

import os
import re
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from pydantic import BaseModel

from ..models.schema import Note, QueryResult, GraphState, Node, Edge
from ..services.graph import GraphService
from .websocket import manager

router = APIRouter()
graph_service: Optional[GraphService] = None


def get_graph_service() -> GraphService:
    global graph_service
    if graph_service is None:
        graph_service = GraphService()
    return graph_service


class NoteRequest(BaseModel):
    content: str
    title: Optional[str] = None
    tags: list[str] = []


class QueryRequest(BaseModel):
    query: str
    use_llm: bool = True
    max_results: int = 10


class MergeRequest(BaseModel):
    keep_id: str
    merge_ids: list[str]


class EdgeActionRequest(BaseModel):
    edge_id: str


class ObsidianImportRequest(BaseModel):
    vault_path: str
    clear_existing: bool = False


class AddNoteResponse(BaseModel):
    note: Node
    entities: list[Node]
    edges: list[Edge]


class GraphResponse(BaseModel):
    nodes: list[Node]
    edges: list[Edge]


@router.get("/health")
async def health_check():
    gs = get_graph_service()
    return {"status": "healthy", "ollama_available": gs.llm.is_available()}


@router.post("/notes", response_model=AddNoteResponse)
async def add_note(request: NoteRequest):
    gs = get_graph_service()
    note = Note(content=request.content, title=request.title, tags=request.tags)
    note_node, entity_nodes, edges = gs.add_note(note)

    await manager.send_graph_update("note_added", {
        "note": note_node.model_dump(),
        "entities": [e.model_dump() for e in entity_nodes],
        "edges": [e.model_dump() for e in edges]
    })

    state = gs.get_state()
    await manager.send_state_update(state.model_dump())

    return AddNoteResponse(note=note_node, entities=entity_nodes, edges=edges)


@router.post("/query", response_model=QueryResult)
async def query_graph(request: QueryRequest):
    gs = get_graph_service()

    # Use streaming query to broadcast traversal events in real-time
    result = await gs.query_streaming(
        query_text=request.query,
        broadcast=manager.broadcast,
        use_llm=request.use_llm,
        max_results=request.max_results
    )

    await manager.send_graph_update("query_executed", {
        "query": request.query, "traversed_path": result.traversed_path,
        "latency_ms": result.latency_ms, "used_llm": result.used_llm
    })

    return result


@router.get("/graph", response_model=GraphResponse)
async def get_full_graph():
    gs = get_graph_service()
    nodes, edges = gs.get_full_graph()
    return GraphResponse(nodes=nodes, edges=edges)


@router.get("/state", response_model=GraphState)
async def get_state():
    gs = get_graph_service()
    return gs.get_state()


@router.get("/adaptations")
async def get_adaptations(limit: int = 10):
    gs = get_graph_service()
    events = gs.get_recent_adaptations(limit)
    return {"events": [e.model_dump() for e in events]}


@router.post("/merge")
async def merge_entities(request: MergeRequest):
    gs = get_graph_service()
    try:
        result = gs.merge_entities(request.keep_id, request.merge_ids)
        await manager.send_adaptation_event({
            "type": "entities_merged", "kept": request.keep_id, "merged": request.merge_ids
        })
        nodes, edges = gs.get_full_graph()
        await manager.send_graph_update("graph_changed", {
            "nodes": [n.model_dump() for n in nodes],
            "edges": [e.model_dump() for e in edges]
        })
        return {"success": True, "result": result.model_dump()}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/edges/confirm")
async def confirm_edge(request: EdgeActionRequest):
    gs = get_graph_service()
    gs.confirm_edge(request.edge_id)
    await manager.send_adaptation_event({"type": "edge_confirmed", "edge_id": request.edge_id})
    return {"success": True}


@router.post("/edges/reject")
async def reject_edge(request: EdgeActionRequest):
    gs = get_graph_service()
    gs.reject_edge(request.edge_id)
    await manager.send_adaptation_event({"type": "edge_rejected", "edge_id": request.edge_id})
    return {"success": True}


@router.get("/schema")
async def get_schema():
    gs = get_graph_service()
    types = gs.db.get_schema_types()
    return {"types": [t.model_dump() for t in types]}


def parse_obsidian_file(file_path: Path) -> tuple[str, str, list[str]]:
    """Parse an Obsidian markdown file and extract title, content, and tags."""
    content = file_path.read_text(encoding='utf-8')
    title = file_path.stem  # Use filename as default title
    tags = []

    # Extract YAML frontmatter if present
    if content.startswith('---'):
        parts = content.split('---', 2)
        if len(parts) >= 3:
            frontmatter = parts[1]
            content = parts[2].strip()

            # Extract tags from frontmatter
            for line in frontmatter.split('\n'):
                if line.startswith('tags:'):
                    tag_part = line[5:].strip()
                    if tag_part.startswith('['):
                        # YAML array format: tags: [tag1, tag2]
                        tag_part = tag_part.strip('[]')
                        tags.extend([t.strip().strip('"\'') for t in tag_part.split(',')])
                    elif tag_part:
                        tags.append(tag_part)
                elif line.strip().startswith('- ') and 'tags' in frontmatter[:frontmatter.find(line)]:
                    # YAML list format
                    tags.append(line.strip()[2:].strip())
                elif line.startswith('title:'):
                    title = line[6:].strip().strip('"\'')

    # Extract inline tags from content (#tag)
    inline_tags = re.findall(r'#([a-zA-Z][a-zA-Z0-9_-]*)', content)
    tags.extend(inline_tags)

    # Extract wiki-links [[link]] as potential related concepts
    wiki_links = re.findall(r'\[\[([^\]|]+)(?:\|[^\]]+)?\]\]', content)

    # Clean content - remove wiki-link syntax but keep the text
    content = re.sub(r'\[\[([^\]|]+)\|([^\]]+)\]\]', r'\2', content)  # [[link|alias]] -> alias
    content = re.sub(r'\[\[([^\]]+)\]\]', r'\1', content)  # [[link]] -> link

    # Add wiki links as metadata tags
    for link in wiki_links:
        if link not in tags:
            tags.append(f"linked:{link}")

    return title, content.strip(), list(set(tags))


async def import_obsidian_background(vault_path: str, clear_existing: bool):
    """Background task to import Obsidian vault with real-time updates."""
    gs = get_graph_service()

    # Optionally clear existing data
    if clear_existing:
        gs.db.clear_all()
        gs.embeddings.clear_all()
        gs._type_counts.clear()
        gs._refresh_type_counts()
        await manager.broadcast({"type": "import_status", "status": "cleared", "message": "Cleared existing data"})

    vault = Path(vault_path)
    md_files = list(vault.rglob("*.md"))
    total = len(md_files)

    await manager.broadcast({
        "type": "import_status",
        "status": "started",
        "total": total,
        "message": f"Found {total} markdown files to import"
    })

    imported = 0
    errors = []

    for i, file_path in enumerate(md_files):
        try:
            # Skip hidden files and folders
            if any(part.startswith('.') for part in file_path.parts):
                continue

            title, content, tags = parse_obsidian_file(file_path)

            # Skip empty files
            if not content or len(content) < 10:
                continue

            note = Note(content=content, title=title, tags=tags)
            note_node, entity_nodes, edges = gs.add_note(note)
            imported += 1

            # Send real-time update for each note
            await manager.broadcast({
                "type": "import_progress",
                "current": i + 1,
                "total": total,
                "imported": imported,
                "file": file_path.name,
                "note": note_node.model_dump(),
                "entities": [e.model_dump() for e in entity_nodes],
                "edges": [e.model_dump() for e in edges]
            })

        except Exception as e:
            errors.append({"file": str(file_path), "error": str(e)})

    # Send completion status
    state = gs.get_state()
    await manager.broadcast({
        "type": "import_status",
        "status": "completed",
        "imported": imported,
        "total": total,
        "errors": errors,
        "final_state": state.model_dump()
    })


@router.post("/import/obsidian")
async def import_obsidian(request: ObsidianImportRequest, background_tasks: BackgroundTasks):
    """Import notes from an Obsidian vault directory."""
    vault_path = Path(request.vault_path).expanduser()

    if not vault_path.exists():
        raise HTTPException(status_code=404, detail=f"Vault path not found: {vault_path}")

    if not vault_path.is_dir():
        raise HTTPException(status_code=400, detail="Path must be a directory")

    md_files = list(vault_path.rglob("*.md"))
    if not md_files:
        raise HTTPException(status_code=400, detail="No markdown files found in vault")

    # Start background import
    background_tasks.add_task(import_obsidian_background, str(vault_path), request.clear_existing)

    return {
        "status": "started",
        "vault_path": str(vault_path),
        "files_found": len(md_files),
        "message": "Import started. Watch WebSocket for real-time progress."
    }


@router.post("/clear")
async def clear_graph():
    """Clear all data from the graph."""
    gs = get_graph_service()
    gs.db.clear_all()
    gs.embeddings.clear_all()
    gs._type_counts.clear()
    gs._refresh_type_counts()

    await manager.broadcast({"type": "graph_cleared", "message": "All data cleared"})

    return {"success": True, "message": "Graph cleared"}


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        gs = get_graph_service()
        state = gs.get_state()
        await websocket.send_json({"type": "initial_state", "data": state.model_dump(mode='json')})

        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
