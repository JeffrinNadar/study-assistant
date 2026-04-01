import pytest
from app.services.chunker import TextChunk, chunk_pages
from app.services.pdf_parser import ParsedPage

@pytest.fixture
def sample_pages():
    return [
        ParsedPage(page_num=1, text="word " * 300),
        ParsedPage(page_num=2, text="word " * 300),
    ]

def test_chunk_produces_multiple_chunks(sample_pages):
    chunks = chunk_pages(sample_pages, chunk_size=512, overlap=50)
    assert len(chunks) > 2  # 600 words > one 512-token chunk

def test_chunk_fields_are_populated(sample_pages):
    chunks = chunk_pages(sample_pages, chunk_size=512, overlap=50)
    for chunk in chunks:
        assert isinstance(chunk, TextChunk)
        assert len(chunk.text.strip()) > 0
        assert chunk.page_num >= 1
        assert chunk.chunk_index >= 0

def test_chunk_index_is_sequential_per_page(sample_pages):
    chunks = chunk_pages(sample_pages, chunk_size=512, overlap=50)
    page1_chunks = [c for c in chunks if c.page_num == 1]
    indices = [c.chunk_index for c in page1_chunks]
    assert indices == list(range(len(page1_chunks)))

def test_empty_page_produces_no_chunks():
    pages = [ParsedPage(page_num=1, text="   ")]
    chunks = chunk_pages(pages)
    assert chunks == []
