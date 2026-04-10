import time
from collections import defaultdict
from threading import Lock


class RateLimiter:
    """In-memory sliding-window rate limiter. No external dependencies."""

    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def _cleanup(self, key: str, now: float) -> None:
        cutoff = now - self.window_seconds
        self._requests[key] = [t for t in self._requests[key] if t > cutoff]

    def check(self, key: str) -> bool:
        now = time.time()
        with self._lock:
            self._cleanup(key, now)
            if len(self._requests[key]) >= self.max_requests:
                return False
            self._requests[key].append(now)
            return True

    def retry_after(self, key: str) -> int:
        now = time.time()
        with self._lock:
            self._cleanup(key, now)
            if not self._requests[key]:
                return 0
            oldest = self._requests[key][0]
            return max(1, int(self.window_seconds - (now - oldest)) + 1)


# Shared instances
chat_limiter = RateLimiter(max_requests=20, window_seconds=60)
upload_limiter = RateLimiter(max_requests=10, window_seconds=3600)
