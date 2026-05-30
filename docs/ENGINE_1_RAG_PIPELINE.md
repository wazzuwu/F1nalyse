# Engine 1: RAG Penalty Predictor

## Overview
Retrieval-Augmented Generation pipeline that predicts FIA penalty outcomes given an incident description. Uses FIA precedent PDFs embedded in ChromaDB + Groq Llama-3.3-70B.

## Features
1. **Manual incident input** - user describes an F1 incident, predicts penalty
2. **RAG-based reasoning** - retrieves top-5 most similar precedents, builds context, LLM rules
3. **Metadata filtering** - filter by year, breach type, circuit before vector search
4. **Reranking** - BGE-reranker-v2 re-ranks retrieved chunks from 20 to 5

## Logical Flow
```
User: "What penalty for VER forcing HAM off track at Monza 2021?"
    |
    v
[LLM Router] -> identifies "penalty" intent -> calls predict_penalty(incident)
    |
    v
[Incident Parser] (optional: extract breach_type, year, circuit from description)
    |
    v
[ChromaDB Search]
  1. Embed incident description via BGE-base-en-v1.5 (768d)
  2. Metadata filter: {breach_type: "forcing_off_track", year: "2021"}
  3. Retrieve top-20 chunks by cosine similarity
    |
    v
[Reranker] BGE-reranker-v2 re-ranks 20 -> 5 most relevant
    |
    v
[Context Builder]
  Precedent 1: {year, circuit, breach, ruling, penalty}
  Precedent 2: {year, circuit, breach, ruling, penalty}
  ...
    |
    v
[Groq Llama-3.3-70B] -> "Based on precedents X, Y: likely 5-second penalty"
    |
    v
Response: {prediction, confidence, cited_precedents, reasoning}
```

## Implementation Phases
| Phase | What | Depends On |
|---|---|---|
| 1a | PDF scraper (fia_scraper.py) + parser (fia_pdf_parser.py) | - |
| 1b | Chunker + embedding + ChromaDB builder (build_db.py, chunker.py) | 1a |
| 1c | RAG service (rag_engine.py) + penalty router | 1b |
| 1d | Test with sample queries | 1c |

## API Endpoints
```
POST /api/penalty/predict
  Body: { "incident": "...", "filters": {"year": 2021} }
  Response: { "prediction": "...", "confidence": 0.85, "precedents": [...], "reasoning": "..." }
```

## Data Sources
- FIA PDFs: data/fia_pdfs/ (2015, 2019-2025)
- ChromaDB: data/chroma_db/
- Precedents JSONL: data/precedents.jsonl
