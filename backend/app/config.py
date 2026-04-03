from pydantic_settings import BaseSettings
from pathlib import Path
import os

# Resolve paths relative to the backend/ directory (parent of this file's parent)
BACKEND_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    # Azure OpenAI — chat (GPT-4.1)
    chat_api_key: str = ""
    chat_api_endpoint: str = ""
    chat_deployment: str = "gpt-4.1"
    chat_api_version: str = "2024-12-01-preview"

    # Azure OpenAI — embeddings (text-embedding-3-large)
    embedding_api_key: str = ""
    embedding_api_endpoint: str = ""
    embedding_deployment: str = "text-embedding-3-large"
    embedding_api_version: str = "2024-12-01-preview"

    database_url: str = f"sqlite:///{BACKEND_DIR}/data/study_assistant.db"
    faiss_index_dir: str = str(BACKEND_DIR / "data" / "faiss_indices")
    upload_dir: str = str(BACKEND_DIR / "uploads")

    class Config:
        env_file = str(BACKEND_DIR / ".env")

settings = Settings()

# Ensure runtime directories exist
os.makedirs(settings.faiss_index_dir, exist_ok=True)
os.makedirs(settings.upload_dir, exist_ok=True)
os.makedirs(str(BACKEND_DIR / "data"), exist_ok=True)
