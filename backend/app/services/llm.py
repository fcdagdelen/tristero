"""Local LLM service using Ollama."""

import json
import time
from typing import Optional
import ollama


class LLMService:
    """Interface to local LLM via Ollama."""

    def __init__(self, model: str = "phi3:mini"):
        self.model = model
        self.client = ollama

    def generate(self, prompt: str, system: Optional[str] = None,
                max_tokens: int = 500, temperature: float = 0.7) -> tuple[str, float]:
        start = time.perf_counter()

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        response = self.client.chat(
            model=self.model,
            messages=messages,
            options={"num_predict": max_tokens, "temperature": temperature}
        )

        latency_ms = (time.perf_counter() - start) * 1000
        return response["message"]["content"], latency_ms

    def synthesize_schema_type(self, entity_examples: list[str],
                              existing_types: list[str]) -> tuple[str, str]:
        system = """You are a knowledge graph schema designer. Given examples of entities,
suggest a concise type name and brief description. Respond in JSON format:
{"name": "type_name", "description": "brief description"}"""

        prompt = f"""Examples: {', '.join(entity_examples[:10])}
Existing types: {', '.join(existing_types)}
Suggest a type:"""

        response, _ = self.generate(prompt, system, max_tokens=100, temperature=0.3)

        try:
            data = json.loads(response)
            return data.get("name", "concept"), data.get("description", "")
        except json.JSONDecodeError:
            return "concept", response[:100]

    def generate_response(self, query: str, context_nodes: list[dict],
                         context_edges: list[dict]) -> str:
        system = """You are a helpful assistant answering questions based on a personal knowledge graph.
Use only the provided context. Be concise."""

        context_parts = []
        for node in context_nodes[:10]:
            context_parts.append(f"[{node.get('entity_type', 'note')}] {node.get('name', '')}: {node.get('content', '')[:200]}")

        if context_edges:
            context_parts.append("\nRelationships:")
            for edge in context_edges[:5]:
                context_parts.append(f"- {edge.get('source_name', '?')} --[{edge.get('relation_type', 'related_to')}]--> {edge.get('target_name', '?')}")

        context = "\n".join(context_parts)
        prompt = f"""Context:\n{context}\n\nQuestion: {query}\n\nAnswer:"""

        response, _ = self.generate(prompt, system, max_tokens=300, temperature=0.5)
        return response

    def is_available(self) -> bool:
        try:
            self.client.list()
            return True
        except Exception:
            return False
