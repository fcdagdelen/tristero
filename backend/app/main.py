"""FastAPI application entry point."""

import os
import re
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.routes import router

# Default Obsidian vault path
DEFAULT_VAULT_PATH = "/Users/cemdagdelen/Desktop/Active/Tlon"


def parse_obsidian_file(file_path: Path) -> tuple[str, str, list[str]]:
    """Parse an Obsidian markdown file and extract title, content, and tags."""
    content = file_path.read_text(encoding='utf-8')
    title = file_path.stem
    tags = []

    if content.startswith('---'):
        parts = content.split('---', 2)
        if len(parts) >= 3:
            frontmatter = parts[1]
            content = parts[2].strip()

            for line in frontmatter.split('\n'):
                if line.startswith('tags:'):
                    tag_part = line[5:].strip()
                    if tag_part.startswith('['):
                        tag_part = tag_part.strip('[]')
                        tags.extend([t.strip().strip('"\'') for t in tag_part.split(',')])
                    elif tag_part:
                        tags.append(tag_part)
                elif line.startswith('title:'):
                    title = line[6:].strip().strip('"\'')

    inline_tags = re.findall(r'#([a-zA-Z][a-zA-Z0-9_-]*)', content)
    tags.extend(inline_tags)

    wiki_links = re.findall(r'\[\[([^\]|]+)(?:\|[^\]]+)?\]\]', content)
    content = re.sub(r'\[\[([^\]|]+)\|([^\]]+)\]\]', r'\2', content)
    content = re.sub(r'\[\[([^\]]+)\]\]', r'\1', content)

    for link in wiki_links:
        if link not in tags:
            tags.append(f"linked:{link}")

    return title, content.strip(), list(set(tags))


def import_vault_sync(vault_path: str, gs):
    """Synchronously import an Obsidian vault (for startup)."""
    from .models.schema import Note

    vault = Path(vault_path)
    if not vault.exists():
        print(f"Vault not found: {vault_path}")
        return

    md_files = list(vault.rglob("*.md"))
    total = len(md_files)
    print(f"Found {total} markdown files to import...")

    imported = 0
    for i, file_path in enumerate(md_files):
        try:
            if any(part.startswith('.') for part in file_path.parts):
                continue

            title, content, tags = parse_obsidian_file(file_path)

            if not content or len(content) < 10:
                continue

            note = Note(content=content, title=title, tags=tags)
            gs.add_note(note)
            imported += 1

            if imported % 10 == 0:
                print(f"Imported {imported}/{total} notes...")

        except Exception as e:
            print(f"Error importing {file_path.name}: {e}")

    print(f"Import complete: {imported} notes imported")


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting Adaptive Knowledge Graph API...")
    print("Initializing models (this may take a moment on first run)...")

    from .api.routes import get_graph_service
    gs = get_graph_service()

    print(f"Ollama available: {gs.llm.is_available()}")

    # Check if we have data, if not, auto-import from Obsidian vault
    state = gs.get_state()
    if state.node_count == 0:
        print(f"No existing data found. Auto-importing from Obsidian vault...")
        import_vault_sync(DEFAULT_VAULT_PATH, gs)
    else:
        print(f"Existing data found: {state.node_count} nodes, {state.edge_count} edges")

    print("API ready!")

    yield

    print("Shutting down...")


app = FastAPI(
    title="Adaptive Knowledge Graph API",
    description="A personal knowledge graph with adaptive ontology using small models",
    version="0.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/")
async def root():
    return {"name": "Adaptive Knowledge Graph", "version": "0.1.0", "docs": "/docs"}
