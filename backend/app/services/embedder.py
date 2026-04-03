import numpy as np
from typing import List
from openai import AzureOpenAI
from app.config import settings

client = AzureOpenAI(
    api_key=settings.embedding_api_key,
    azure_endpoint=settings.embedding_api_endpoint,
    api_version=settings.embedding_api_version,
)

EMBEDDING_DIM = 3072

def embed_texts(texts: List[str]) -> np.ndarray:
    """Embed a list of texts. Returns normalized array of shape (N, 3072).

    Vectors are L2-normalized so cosine similarity = inner product.
    """
    if not texts:
        raise ValueError("embed_texts requires at least one text")

    response = client.embeddings.create(model=settings.embedding_deployment, input=texts)
    vectors = np.array([item.embedding for item in response.data], dtype=np.float32)

    # L2-normalize so FAISS IndexFlatIP computes cosine similarity
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    vectors = vectors / np.maximum(norms, 1e-10)

    return vectors
