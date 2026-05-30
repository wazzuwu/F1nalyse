from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # Groq
    groq_api_key: str = ""
    # Google Gemini
    gemini_api_key: str = ""
    # LLM provider: "groq" or "gemini"
    llm_provider: str = "groq"
    # Extraction model (used by PDF parser)
    extraction_model: str = "llama-3.1-8b-instant"
    # RAG inference model (used by rag_engine)
    llm_model: str = "llama-3.3-70b-versatile"
    llm_temperature: float = 0.3
    # Paths
    fastf1_cache_dir: str = "data/fastf1_cache"
    chroma_db_dir: str = "data/chroma_db"
    fia_pdfs_dir: str = "data/fia_pdfs"
    precedents_file: str = "data/precedents.jsonl"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

BASE_DIR = Path(__file__).resolve().parent.parent
FASTF1_CACHE_DIR = BASE_DIR / settings.fastf1_cache_dir
CHROMA_DB_DIR = BASE_DIR / settings.chroma_db_dir
FIA_PDFS_DIR = BASE_DIR / settings.fia_pdfs_dir
PRECEDENTS_FILE = BASE_DIR / settings.precedents_file
