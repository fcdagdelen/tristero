"""Entity extraction using GLiNER for zero-shot NER."""

from typing import Optional
from gliner import GLiNER
from ..models.schema import ExtractedEntity


class EntityExtractor:
    """Zero-shot named entity recognition using GLiNER."""

    DEFAULT_LABELS = [
        "person", "organization", "location", "concept",
        "project", "technology", "date", "event",
    ]

    def __init__(self, model_name: str = "urchade/gliner_small-v2.1"):
        self.model = GLiNER.from_pretrained(model_name)
        self.model_name = model_name

    def extract(self, text: str, labels: Optional[list[str]] = None,
                threshold: float = 0.3) -> list[ExtractedEntity]:
        labels = labels or self.DEFAULT_LABELS
        entities = self.model.predict_entities(text, labels, threshold=threshold)

        results = []
        for ent in entities:
            results.append(ExtractedEntity(
                text=ent["text"], label=ent["label"],
                start=ent["start"], end=ent["end"], score=ent["score"]
            ))
        return results

    def extract_with_context(self, text: str, query_context: Optional[str] = None,
                            threshold: float = 0.3) -> list[ExtractedEntity]:
        labels = list(self.DEFAULT_LABELS)

        if query_context:
            query_lower = query_context.lower()
            if any(w in query_lower for w in ["who", "person", "people"]):
                labels = ["person", "organization"] + labels
            elif any(w in query_lower for w in ["where", "place", "location"]):
                labels = ["location", "organization"] + labels
            elif any(w in query_lower for w in ["when", "date", "time"]):
                labels = ["date", "event"] + labels

            seen = set()
            labels = [x for x in labels if not (x in seen or seen.add(x))]

        return self.extract(text, labels, threshold)

    def merge_overlapping(self, entities: list[ExtractedEntity]) -> list[ExtractedEntity]:
        if not entities:
            return []

        sorted_ents = sorted(entities, key=lambda e: (e.start, -e.score))
        merged = []
        current = sorted_ents[0]

        for ent in sorted_ents[1:]:
            if ent.start < current.end:
                if ent.score > current.score:
                    current = ent
            else:
                merged.append(current)
                current = ent

        merged.append(current)
        return merged

    def extract_clean(self, text: str, labels: Optional[list[str]] = None,
                     threshold: float = 0.3) -> list[ExtractedEntity]:
        entities = self.extract(text, labels, threshold)
        return self.merge_overlapping(entities)


def normalize_entity_text(text: str) -> str:
    return " ".join(text.lower().split())
