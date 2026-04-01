from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    openai_api_key: str
    database_url: str = "sqlite:///./data/study_assistant.db"
    faiss_index_dir: str = "./data/faiss_indices"
    upload_dir: str = "./uploads"

    class Config:
        env_file = ".env"

settings = Settings()

# Ensure runtime directories exist
os.makedirs(settings.faiss_index_dir, exist_ok=True)
os.makedirs(settings.upload_dir, exist_ok=True)
os.makedirs("./data", exist_ok=True)
