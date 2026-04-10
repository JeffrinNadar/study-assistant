import time
from app.services.rate_limiter import RateLimiter


def test_allows_requests_under_limit():
    limiter = RateLimiter(max_requests=3, window_seconds=60)
    assert limiter.check("user1") is True
    assert limiter.check("user1") is True
    assert limiter.check("user1") is True


def test_blocks_requests_over_limit():
    limiter = RateLimiter(max_requests=2, window_seconds=60)
    assert limiter.check("user1") is True
    assert limiter.check("user1") is True
    result = limiter.check("user1")
    assert result is False


def test_returns_retry_after():
    limiter = RateLimiter(max_requests=1, window_seconds=60)
    limiter.check("user1")
    limiter.check("user1")  # over limit
    retry_after = limiter.retry_after("user1")
    assert retry_after > 0
    assert retry_after <= 60


def test_separate_users():
    limiter = RateLimiter(max_requests=1, window_seconds=60)
    assert limiter.check("user1") is True
    assert limiter.check("user2") is True


def test_window_expires():
    limiter = RateLimiter(max_requests=1, window_seconds=0.1)
    assert limiter.check("user1") is True
    assert limiter.check("user1") is False
    time.sleep(0.15)
    assert limiter.check("user1") is True
