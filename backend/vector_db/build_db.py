"""
ChromaDB builder — takes chunked precedent records, embeds them via
FastEmbed (BGE-base-en-v1.5), and stores in a persistent ChromaDB collection.

Usage:
  python -m backend.vector_db.build_db

This will:
  1. Run the chunker on precedents.jsonl
  2. Load (or download once) the BGE-base ONNX model via FastEmbed
  3. Create/get a ChromaDB collection named "fia_precedents"
  4. Add any new chunks, skipping existing ones by content hash
  5. Report counts of added vs skipped chunks
"""

import hashlib
import json
from pathlib import Path

import chromadb
from chromadb.config import Settings
from fastembed import TextEmbedding

from backend.config import CHROMA_DB_DIR

# ChromaDB collection name — used in the RAG engine for retrieval
COLLECTION_NAME = "fia_precedents"

# FastEmbed model — same BGE-base weights as the original plan
# ONNX runtime is lighter than PyTorch with identical output
EMBEDDING_MODEL = "BAAI/bge-base-en-v1.5"

# Cache the model weights somewhere persistent (not temp)
MODEL_CACHE_DIR = Path(__file__).resolve().parent.parent / "models"
MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _get_embedding_model() -> TextEmbedding:
    """Load the FastEmbed BGE-base model (cached after first download)."""
    return TextEmbedding(
        model_name=EMBEDDING_MODEL,
        cache_dir=str(MODEL_CACHE_DIR),
    )


def _chunk_id(source_file: str, driver_name: str, driver_number: str, section_label: str) -> str:
    """Generate a deterministic unique ID for each chunk.

    Uses source_file + driver_number + section_label to avoid collisions
    when multiple drivers in the same document have the same name (N/A).
    """
    raw = f"{source_file}|{driver_number}|{driver_name}|{section_label}"
    return hashlib.md5(raw.encode()).hexdigest()


def _existing_ids(collection) -> set[str]:
    """Fetch all existing chunk IDs from the ChromaDB collection.

    This is how we skip already-embedded chunks on subsequent runs.
    """
    try:
        existing = collection.get(limit=10**9)  # Fetch all IDs
        return set(existing["ids"])
    except Exception:
        return set()


def build_vector_db() -> None:
    """
    Main entry point:
      1. Import and run the chunker on precedents.jsonl
      2. Embed each chunk and store in ChromaDB
      3. Skip chunks that already exist (by ID)
    """
    from backend.vector_db.chunker import chunk_precedents

    # Step 1: Chunk the precedents
    chunks = chunk_precedents()
    if not chunks:
        print("Nothing to embed.")
        return

    print(f"\nChunks to process: {len(chunks)}")

    # Step 2: Initialise ChromaDB (persistent)
    client = chromadb.PersistentClient(
        path=str(CHROMA_DB_DIR),
        settings=Settings(anonymized_telemetry=False),
    )

    # Create or get the collection
    # We manage embeddings ourselves via FastEmbed, not via ChromaDB's EF
    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )

    # Step 3: Determine which chunks are new
    existing = _existing_ids(collection)
    new_chunks = [c for c in chunks if _chunk_id(
        c["metadata"]["source_file"],
        c["metadata"]["driver_name"],
        c["metadata"].get("driver_number", "0"),
        c["metadata"]["section_label"],
    ) not in existing]

    if not new_chunks:
        print("All chunks already in ChromaDB — nothing to add.")
        return

    print(f"New chunks to embed: {len(new_chunks)}/{len(chunks)}")

    # Step 4: Embed in batches and add to ChromaDB
    model = _get_embedding_model()
    batch_size = 64
    total_added = 0

    for i in range(0, len(new_chunks), batch_size):
        batch = new_chunks[i:i + batch_size]

        # Prepare data for ChromaDB
        ids: list[str] = []
        texts: list[str] = []
        metadatas: list[dict] = []

        for chunk in batch:
            source = chunk["metadata"]["source_file"]
            driver = chunk["metadata"]["driver_name"]
            section = chunk["metadata"]["section_label"]

            driver_num = chunk["metadata"].get("driver_number", "0")
            cid = _chunk_id(source, driver, driver_num, section)
            ids.append(cid)
            texts.append(chunk["embedding_text"])
            metadatas.append(chunk["metadata"])

        # Embed using FastEmbed (returns iterator of numpy arrays)
        embeddings = list(model.embed(texts))

        # Use upsert to handle any missed duplicates from the check
        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            metadatas=metadatas,
            documents=texts,
        )

        total_added += len(batch)
        print(f"  Added {total_added}/{len(new_chunks)} chunks...")

    print(f"\n{'='*60}")
    print(f"  DONE — {total_added} new chunks added to ChromaDB")
    print(f"  Total in collection: {collection.count()}")
    print(f"{'='*60}")


def get_collection() -> chromadb.Collection:
    """Get the ChromaDB collection for querying (used by rag_engine.py)."""
    client = chromadb.PersistentClient(
        path=str(CHROMA_DB_DIR),
        settings=Settings(anonymized_telemetry=False),
    )
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


def count_chunks() -> int:
    """Quick helper to see how many chunks are stored."""
    try:
        col = get_collection()
        return col.count()
    except Exception:
        return 0


if __name__ == "__main__":
    build_vector_db()
