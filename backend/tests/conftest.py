import pytest
import fitz  # PyMuPDF

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
