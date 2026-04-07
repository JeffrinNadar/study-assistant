import pytest
import fitz  # PyMuPDF
from uuid import uuid4
from fastapi.testclient import TestClient
from app.main import app
from app.database import create_db, get_db
from app.services.auth import create_access_token, hash_password
from app.models.user import User

# Ensure all tables exist (including the new user table)
create_db()


@pytest.fixture(scope="session")
def sample_pdf_path(tmp_path_factory):
    """Generate a minimal 2-page PDF for testing."""
    tmp = tmp_path_factory.mktemp("fixtures")
    path = tmp / "sample.pdf"
    doc = fitz.open()
    for i in range(1, 3):
        page = doc.new_page()
        page.insert_text((72, 72), f"Page {i} content. " * 50)
    doc.save(str(path))
    doc.close()
    return str(path)


@pytest.fixture
def test_user():
    """Create a test user in the database and return it."""
    db = next(get_db())
    user = User(email=f"test-{uuid4()}@example.com", hashed_password=hash_password("testpass123"))
    db.add(user)
    db.commit()
    db.refresh(user)
    yield user
    # Cleanup
    existing = db.get(User, user.id)
    if existing:
        db.delete(existing)
        db.commit()


@pytest.fixture
def auth_headers(test_user):
    """Return Authorization headers with a valid JWT for the test user."""
    token = create_access_token(test_user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def client():
    return TestClient(app)
