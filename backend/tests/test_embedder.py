import numpy as np
import pytest
from unittest.mock import patch, MagicMock
from app.services.embedder import embed_texts

def make_mock_openai(n: int):
    """Return a mock OpenAI client that yields dummy 1536-dim vectors."""
    mock = MagicMock()
    mock.embeddings.create.return_value = MagicMock(
        data=[MagicMock(embedding=[0.1] * 1536) for _ in range(n)]
    )
    return mock

def test_embed_returns_ndarray():
    texts = ["hello world", "second chunk"]
    with patch("app.services.embedder.client", make_mock_openai(2)):
        vectors = embed_texts(texts)
    assert isinstance(vectors, np.ndarray)

def test_embed_shape_is_correct():
    texts = ["hello world", "second chunk"]
    with patch("app.services.embedder.client", make_mock_openai(2)):
        vectors = embed_texts(texts)
    assert vectors.shape == (2, 1536)

def test_embed_vectors_are_normalized():
    texts = ["hello world"]
    with patch("app.services.embedder.client", make_mock_openai(1)):
        vectors = embed_texts(texts)
    norms = np.linalg.norm(vectors, axis=1)
    assert np.allclose(norms, 1.0, atol=1e-5)

def test_embed_empty_raises():
    with pytest.raises(ValueError, match="at least one text"):
        embed_texts([])
