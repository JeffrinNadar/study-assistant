import numpy as np
import pytest
from app.services.vector_store import VectorStore

def normalized_vectors(n: int, dim: int = 1536) -> np.ndarray:
    vecs = np.random.randn(n, dim).astype(np.float32)
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    return vecs / norms

@pytest.fixture
def store(tmp_path):
    return VectorStore(index_path=str(tmp_path / "test.index"))

def test_add_and_search_returns_ids(store):
    vecs = normalized_vectors(5)
    ids = list(range(10, 15))  # simulate SQLite chunk IDs
    store.add_vectors(vecs, external_ids=ids)
    result_ids, scores = store.search(vecs[0:1], k=3)
    assert 10 in result_ids  # query matches itself
    assert len(result_ids) == 3

def test_scores_are_cosine_similarities(store):
    vecs = normalized_vectors(3)
    store.add_vectors(vecs, external_ids=[1, 2, 3])
    _, scores = store.search(vecs[0:1], k=1)
    assert 0.99 <= scores[0] <= 1.01  # query ≈ self

def test_remove_by_ids_excludes_from_results(store):
    vecs = normalized_vectors(3)
    store.add_vectors(vecs, external_ids=[1, 2, 3])
    store.remove_by_ids([1])
    result_ids, _ = store.search(vecs[0:1], k=3)
    assert 1 not in result_ids

def test_save_and_load_persists_index(store, tmp_path):
    vecs = normalized_vectors(3)
    store.add_vectors(vecs, external_ids=[1, 2, 3])
    store.save()
    store2 = VectorStore(index_path=str(tmp_path / "test.index"))
    store2.load()
    result_ids, _ = store2.search(vecs[0:1], k=1)
    assert 1 in result_ids

def test_total_vectors(store):
    vecs = normalized_vectors(4)
    store.add_vectors(vecs, external_ids=[10, 11, 12, 13])
    assert store.total_vectors() == 4
