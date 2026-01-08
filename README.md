# Tristero

> *"The secret underground postal network that reveals hidden connections."*
> — Named after the Tristero system in Thomas Pynchon's *The Crying of Lot 49*

An adaptive knowledge graph with real-time traversal visualization. Uses small specialized models (<50M params) for fast operations, with local LLM for synthesis.

## Core Thesis

Personal knowledge graph ("Second Brain") where the **ontology adapts based on query and usage patterns** using only tiny models, reserving local LLM calls for synthesis only.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FAST LAYER (10-50ms)                      │
├─────────────────────────────────────────────────────────────┤
│  e5-small (33M)          │  Embeddings for semantic search  │
│  GLiNER-small (~50M)     │  Zero-shot NER, no fine-tuning   │
│  Edge Weight Heuristics  │  Decay unused, boost traversed   │
│  HDBSCAN Clustering      │  Group similar entities          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  SLOW LAYER (Local LLM)                      │
├─────────────────────────────────────────────────────────────┤
│  Ollama (phi-3/llama3.2) │  Response synthesis, schema naming│
│  Goal: <5% of operations │  Used sparingly for complex tasks │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- **macOS** with Apple Silicon (or any machine with ~8GB RAM)
- **Python 3.10+**
- **Node.js 18+**
- **Ollama** (for local LLM)

## Quick Start

### 1. Install Ollama

```bash
brew install ollama
ollama serve  # Start Ollama server
ollama pull phi3:mini  # Pull a small model
```

### 2. Start the Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
python run.py
```

The backend will start on `http://localhost:8000`. First run will download models (~100MB).

### 3. Start the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run the dev server
npm run dev
```

Open `http://localhost:5173` in your browser.

## Usage

### Adding Notes

1. Type a note in the input box (e.g., "Met John at the AI conference in Berlin. He works on transformer architectures at OpenAI.")
2. Click "Add"
3. Watch as entities are automatically extracted and linked

### Querying

1. Ask a question (e.g., "Who do I know who works in AI?")
2. See the graph highlight traversed paths
3. Get a synthesized response from the local LLM

### Observing Adaptation

- **Schema Evolution Panel**: Watch as new entity types emerge from usage patterns
- **Adaptation Log**: See real-time feed of what the system learned
- **Metrics Panel**: Track latency, LLM usage, and graph growth

## Demo Script

### Scene 1: Cold Start
Start with empty graph, add a few notes:
- "Had coffee with Sarah, she's a data scientist at Google"
- "Reading about transformers and attention mechanisms"
- "Project idea: build a knowledge graph that learns from usage"

### Scene 2: Query-Driven Evolution
- Query: "What have I been thinking about AI?"
- Query: "Who do I know in tech?"
- Watch schema evolve as patterns emerge

### Scene 3: Manual Feedback
- Merge similar entities
- Confirm or reject suggested links

## Project Structure

```
tristero/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI routes and WebSocket
│   │   ├── models/       # Pydantic models and SQLite DB
│   │   └── services/     # Core services (embeddings, NER, graph)
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom hooks
│   │   ├── api/          # API client
│   │   └── types/        # TypeScript types
│   └── package.json
└── README.md
```

## Key Technologies

| Component | Technology | Size/Latency |
|-----------|-----------|--------------|
| Embeddings | e5-small | 33M params, ~16ms |
| Entity Extraction | GLiNER | ~50M params, ~30ms |
| Vector Store | ChromaDB | Embedded |
| Graph Store | SQLite | Single file |
| Local LLM | Ollama (phi-3) | ~3.8B params |
| Frontend | React + Vite | react-force-graph |

## Success Metrics

- **Graph operations**: <50ms on CPU
- **LLM call ratio**: <10% of operations
- **Schema evolution**: 3+ new entity types should emerge
- **Auto-link accuracy**: >80% of suggestions correct

## Future Directions

- Time-based graph snapshots (before/after toggle)
- Entity clustering visualization
- Export/import knowledge bases
- Multi-user support with personalized ontologies

---

Built as a PoC for [Dynamic Adaptive Knowledge Graphs](https://fcdagdelen.github.io/latent-digest/dynamic-knowledge-graphs)
