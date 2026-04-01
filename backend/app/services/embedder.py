import numpy as np
from typing import List
from openai import OpenAI
from app.config import settings

client = OpenAI(api_key=settings.openai_api_key)

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536

def embed_texts(texts: List[str]) -> np.ndarray:
    """Embed a list of texts. Returns normalized array of shape (N, 1536).

    Vectors are L2-normalized so cosine similarity = inner product.
    """
    if not texts:
        raise ValueError("embed_texts requires at least one text")

    response = client.embeddings.create(model=EMBEDDING_MODEL, input=texts)
    vectors = np.array([item.embedding for item in response.data], dtype=np.float32)

    # L2-normalize so FAISS IndexFlatIP computes cosine similarity
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    vectors = vectors / np.maximum(norms, 1e-10)

    return vectors
