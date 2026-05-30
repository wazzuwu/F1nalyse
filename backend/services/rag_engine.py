"""
RAG engine for FIA penalty prediction.

Pipeline:
  1. Embed user's incident description with FastEmbed BGE-base
  2. ChromaDB metadata-filtered similarity search (top-20)
  3. Take top-5 from vector search results
  4. Build structured context from retrieved precedents
  5. Groq Llama-3.3-70B infers the penalty prediction
  6. Return structured response with cited precedents
"""

from pathlib import Path

import chromadb
from chromadb.config import Settings
from fastembed import TextEmbedding

from backend.config import CHROMA_DB_DIR, settings

COLLECTION_NAME = "fia_precedents"
EMBEDDING_MODEL = "BAAI/bge-base-en-v1.5"
MODEL_CACHE_DIR = Path(__file__).resolve().parent.parent / "models"

# ChromaDB search — retrieve top-N before taking top-K
SEARCH_N = 20
RESULT_K = 5


SYSTEM_PROMPT ="""You are an expert F1 analyst and experienced steward . Your role is to analyse 
an F1 incident using historical FIA steward precedents and predict the likely 
penalty — the way a seasoned F1 journalist would.

You will be given:
1. An incident description from a user or a query about a specific incident
2. The incident could involve one or more drivers with details like circuit, 
   year, nature of breach, and team name
3. A set of similar historical precedents from the FIA database

EMPHASIS HIERARCHY:
1. Current incident analysis (55% of reasoning)
   - Specific details: circuit, lap, driver actions, rule violated
   - Context: race situation, steward's likely view of intent/severity
   - Outcome factors: how this differs from routine incidents
   
2. Historical validation (45% of reasoning)
   - Cite 1-2 precedents that directly support your prediction
   - Explain why they apply or differ briefly (1 sentence each)
   - Do NOT list every similar case

INCIDENT:
{incident}

RELEVANT PRECEDENTS (most similar first):
{precedents}

Respond with a JSON object containing:

- "prediction": A clear, confident sentence stating the predicted penalty 
  (or "No penalty" if none), with brief reasoning why

- "confidence": A float between 0.0 and 1.0 indicating confidence level

- "reasoning": A detailed paragraph (5-7 sentences) written like a sports 
  journalist. Structure: (1) Describe the incident in detail — what happened, 
  why it matters at THIS race, specific circuit/race context. (2) Explain the 
  rule breach and relevant factors (track conditions, driver intent if relevant, 
  severity). (3) Reference ONE similar precedent briefly to anchor your logic. 
  (4) State the predicted outcome with justification.

- "cited_precedents": A list of 1-2 most directly relevant precedent metadata 
  objects only (sufficient to support the decision, not exhaustive). Include 
  driver, circuit, year, and outcome.

RULES:
- Base your analysis ONLY on provided precedents and standard FIA penalty guidelines
- Lead with incident-specific analysis; use precedents as validation, not the focus
- Refer to precedents by driver, circuit, and outcome — not by index
- If inconsistencies exist across precedents, note only if relevant to THIS case
- Do NOT make up penalties or cite unprovided precedents
- Prioritize race context (track, lap, race situation) over broader patterns
- Keep precedent references minimal and directly applicable

Return raw JSON only, no markdown formatting."""

def _get_chroma_collection():
    client = chromadb.PersistentClient(
        path=str(CHROMA_DB_DIR),
        settings=Settings(anonymized_telemetry=False),
    )
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


def _get_embedding_model():
    return TextEmbedding(
        model_name=EMBEDDING_MODEL,
        cache_dir=str(MODEL_CACHE_DIR),
    )


_CIRCUIT_SYNONYMS = {
    "british grand prix": ["70th anniversary grand prix"],
    "austrian grand prix": ["styrian grand prix"],
    "bahrain grand prix": ["sakhir grand prix"],
    "turkish grand prix": ["2021 turkish grand prix"],
    "italian grand prix": ["2020 italian grand prix", "2022 italian grand prix"],
    "sao paulo grand prix": ["brazilian grand prix"],
    "mexico city grand prix": ["mexican grand prix"],
}

def _match_circuit(meta_circuit: str, circuit_filter: str) -> bool:
    mc = meta_circuit.lower().strip()
    cf = circuit_filter.lower().strip()
    if cf in mc or mc.endswith(cf):
        return True
    core = cf.replace(" grand prix", "").strip()
    if core and core in mc:
        return True
    for variant in _CIRCUIT_SYNONYMS.get(cf, []):
        if variant in mc:
            return True
    return False


def query(incident: str, filters: dict | None = None) -> dict:
    """
    Full RAG query: embed incident → search ChromaDB → build context → LLM → response.

    Args:
      incident: Natural language description of the F1 incident.
      filters: Optional metadata filters for ChromaDB, e.g. {"year": 2025}.

    Returns:
      Structured dict with prediction, confidence, reasoning, cited_precedents.
    """
    # Step 1: Load collection + model
    collection = _get_chroma_collection()
    model = _get_embedding_model()

    # Step 2: Embed the incident
    query_vector = list(model.embed([incident]))[0]

    # Separate circuit from other filters — we handle circuit via post-filter
    circuit_filter = None
    if filters and "circuit" in filters:
        circuit_filter = filters.pop("circuit")

    # Step 3: ChromaDB search with optional metadata filter
    where = None
    if filters:
        where = {}
        for key, val in filters.items():
            if val is not None:
                where[key] = val

    results = collection.query(
        query_embeddings=[query_vector],
        n_results=SEARCH_N,
        where=where,
        include=["metadatas", "documents", "distances"],
    )

    if not results["ids"][0]:
        return {
            "prediction": "Insufficient precedent data to make a prediction.",
            "confidence": 0.0,
            "reasoning": "No similar precedents found in the database.",
            "cited_precedents": [],
        }

    # Step 4: Post-filter by circuit (case-insensitive substring match)
    if circuit_filter:
        zipped = list(zip(results["ids"][0], results["metadatas"][0], results["documents"][0], results["distances"][0]))
        filtered = [
            (idx, m, doc, dist) for idx, m, doc, dist in zipped
            if _match_circuit(str(m.get("circuit", "")), circuit_filter)
        ]
        if filtered:
            results["ids"][0] = [f[0] for f in filtered]
            results["metadatas"][0] = [f[1] for f in filtered]
            results["documents"][0] = [f[2] for f in filtered]
            results["distances"][0] = [f[3] for f in filtered]

    # Step 5: Take top-K results
    top_k = min(RESULT_K, len(results["ids"][0]))
    metadatas = results["metadatas"][0][:top_k]
    documents = results["documents"][0][:top_k]
    distances = results["distances"][0][:top_k]

    # Step 5: Build structured precedent context
    precedent_lines = []
    for i in range(top_k):
        m = metadatas[i]
        precedent_lines.append(
            f"[Precedent {i+1}] "
            f"Year: {m.get('year', 'N/A')} | "
            f"Circuit: {m.get('circuit', 'N/A')} | "
            f"Driver: {m.get('driver_name', 'N/A')} | "
            f"Breach: {m.get('breach_category', 'N/A')} | "
            f"Penalty: {m.get('penalty_value', 'N/A')} ({m.get('penalty_type', 'N/A')}) | "
            f"Section: {m.get('section_label', 'N/A')}\n"
            f"  {documents[i][:500]}"
        )

    precedents_text = "\n\n".join(precedent_lines)

    # Step 6: Call Groq Llama-3.3-70B with RAG prompt
    from backend.services.llm_client import chat_completion

    user_prompt = SYSTEM_PROMPT.format(
        incident=incident,
        precedents=precedents_text,
    )

    response = chat_completion(
        messages=[{"role": "user", "content": user_prompt}],
        temperature=0.3,
    )

    content = response.choices[0].message.content.strip()
    import json

    # Strip potential markdown code blocks
    if content.startswith("```"):
        content = content.strip("`")
        if content.startswith("json"):
            content = content[4:]
        content = content.strip()

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        parsed = {"prediction": content}

    # Handle LLM stuffing structured content into prediction string
    if isinstance(parsed.get("prediction"), str) and len(parsed["prediction"]) > 200:
        raw_pred = parsed["prediction"]
        # Check if it looks like structured content with keys
        if '"prediction"' in raw_pred or '"reasoning"' in raw_pred or '"confidence"' in raw_pred:
            try:
                inner = json.loads(raw_pred)
                if isinstance(inner, dict):
                    parsed.update(inner)
            except json.JSONDecodeError:
                # Malformed inner JSON — extract fields via simple pattern matching
                import re
                p = re.search(r'"prediction"\s*:\s*(.+?)(?:,?\s*"(?:confidence|reasoning))', raw_pred, re.DOTALL)
                c = re.search(r'"confidence"\s*:\s*([\d.]+)', raw_pred)
                r = re.search(r'"reasoning"\s*:\s*(.+?)(?:,?\s*"(?:confidence|cited_precedents))', raw_pred, re.DOTALL)
                if p:
                    parsed["prediction"] = p.group(1).strip().strip('"').strip(',').strip()
                if c:
                    try:
                        parsed["confidence"] = float(c.group(1))
                    except ValueError:
                        pass
                if r:
                    parsed["reasoning"] = r.group(1).strip().strip('"').strip(',').strip()

    # Ensure required keys exist
    parsed.setdefault("prediction", content[:200])
    parsed.setdefault("confidence", 0.0)
    parsed.setdefault("reasoning", "")

    # Attach the actual precedent metadata for reference
    parsed["cited_precedents"] = []
    for i in range(top_k):
        m = metadatas[i]
        parsed["cited_precedents"].append({
            "year": m.get("year"),
            "circuit": m.get("circuit"),
            "driver": m.get("driver_name"),
            "breach": m.get("breach_category"),
            "penalty": m.get("penalty_value"),
            "penalty_type": m.get("penalty_type"),
        })

    return parsed


def test_query(incident: str) -> None:
    """Quick test helper to see what the RAG engine returns."""
    result = query(incident)
    print(f"Prediction: {result['prediction']}")
    print(f"Confidence: {result['confidence']}")
    print(f"Reasoning:  {result['reasoning']}")
    print(f"Cited:      {len(result['cited_precedents'])} precedents")


if __name__ == "__main__":
    test_query("did lewis get a penalty in 2021 silverstone?")
