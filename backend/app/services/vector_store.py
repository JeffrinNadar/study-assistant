import faiss
import numpy as np
from typing import List, Tuple
import os

EMBEDDING_DIM = 1536

class VectorStore:
    """FAISS IDMap wrapper. Maps SQLite Chunk.id (external_id) to vectors.

    Uses IndexFlatIP (inner product) on L2-normalized vectors → cosine similarity.
    """

    def __init__(self, index_path: str):
        self.index_path = index_path
        self._index = faiss.IndexIDMap(faiss.IndexFlatIP(EMBEDDING_DIM))

    def add_vectors(self, vectors: np.ndarray, external_ids: List[int]) -> None:
        """Add vectors with their corresponding SQLite chunk IDs."""
        ids = np.array(external_ids, dtype=np.int64)
        self._index.add_with_ids(vectors, ids)

    def search(self, query: np.ndarray, k: int = 5) -> Tuple[List[int], List[float]]:
        """Return (external_ids, cosine_scores) for top-k most similar chunks.

        Filters out FAISS sentinel value -1 (returned when k > index size).
        """
        k = min(k, self._index.ntotal)
        if k == 0:
            return [], []
        scores, ids = self._index.search(query, k)
        valid = [(int(i), float(s)) for i, s in zip(ids[0], scores[0]) if i != -1]
        result_ids = [v[0] for v in valid]
        result_scores = [v[1] for v in valid]
        return result_ids, result_scores

    def remove_by_ids(self, external_ids: List[int]) -> None:
        """Remove vectors by their external SQLite chunk IDs."""
        id_selector = faiss.IDSelectorArray(np.array(external_ids, dtype=np.int64))
        self._index.remove_ids(id_selector)

    def save(self) -> None:
        os.makedirs(os.path.dirname(self.index_path) or ".", exist_ok=True)
        faiss.write_index(self._index, self.index_path)

    def load(self) -> None:
        self._index = faiss.read_index(self.index_path)

    def total_vectors(self) -> int:
        return self._index.ntotal
