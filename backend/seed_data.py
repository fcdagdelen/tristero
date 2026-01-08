"""Seed the knowledge graph with demo data."""

import time
from app.models.schema import Note
from app.services.graph import GraphService


SAMPLE_NOTES = [
    {
        "title": "AI Conference Notes",
        "content": "Met John Smith at the AI conference in Berlin. He's working on transformer architectures at OpenAI. Really interesting conversation about attention mechanisms and their applications in knowledge graphs."
    },
    {
        "title": "Coffee with Sarah",
        "content": "Had coffee with Sarah Chen today. She's a data scientist at Google working on recommendation systems. We discussed how graph neural networks could improve their models. She mentioned a paper by Yann LeCun that I should read."
    },
    {
        "title": "Project Idea",
        "content": "Idea for a new project: Build a personal knowledge graph that adapts its schema based on usage patterns. Use small models for fast operations, only call LLMs when necessary. Could be useful for researchers and writers."
    },
    {
        "title": "Reading Notes",
        "content": "Finished reading 'Attention Is All You Need' paper. Key insight: self-attention allows models to look at all positions in the input sequence. This is foundational for modern NLP. Need to understand multi-head attention better."
    },
    {
        "title": "Berlin Trip Planning",
        "content": "Planning a trip to Berlin in March. Want to visit the Technical University and meet with the AI research group there. Also interested in visiting the Computer History Museum. Should book hotel near Alexanderplatz."
    },
    {
        "title": "Machine Learning Course",
        "content": "Started Andrew Ng's machine learning course on Coursera. Covering supervised learning basics - linear regression and logistic regression. The math is more intuitive than I expected. Stanford has great teaching methods."
    },
    {
        "title": "Graph Database Research",
        "content": "Researching graph databases for the knowledge graph project. Neo4j seems popular but might be overkill. SQLite with proper indexing could work for a PoC. ChromaDB for embeddings, HDBSCAN for clustering."
    },
    {
        "title": "Meeting Notes - Team Sync",
        "content": "Team sync with Alex and Maria. Alex is finishing the API endpoints. Maria is working on the frontend visualization. We agreed to use React with Vite for the web interface. Next milestone: demo by end of month."
    },
]


def seed_database(graph_service: GraphService = None):
    """Add sample notes to the knowledge graph."""
    if graph_service is None:
        graph_service = GraphService()

    print("Seeding knowledge graph with demo data...")
    print("-" * 50)

    for note_data in SAMPLE_NOTES:
        note = Note(
            content=note_data["content"],
            title=note_data["title"],
            tags=[]
        )

        print(f"\nAdding: {note_data['title']}")
        start = time.perf_counter()

        note_node, entities, edges = graph_service.add_note(note)

        elapsed = (time.perf_counter() - start) * 1000
        print(f"  - Created note: {note_node.name}")
        print(f"  - Extracted {len(entities)} entities: {[e.name for e in entities[:5]]}")
        print(f"  - Created {len(edges)} edges")
        print(f"  - Took {elapsed:.0f}ms")

        # Small delay to avoid overwhelming the system
        time.sleep(0.5)

    print("\n" + "-" * 50)
    state = graph_service.get_state()
    print(f"\nFinal state:")
    print(f"  - Nodes: {state.node_count}")
    print(f"  - Edges: {state.edge_count}")
    print(f"  - Schema types: {[t.name for t in state.schema_types]}")
    print("\nDone! The knowledge graph is ready for demo.")


if __name__ == "__main__":
    seed_database()
