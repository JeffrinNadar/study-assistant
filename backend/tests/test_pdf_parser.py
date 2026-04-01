import pytest
from app.services.pdf_parser import ParsedPage, parse_pdf

def test_parse_returns_list_of_parsed_pages(sample_pdf_path):
    pages = parse_pdf(sample_pdf_path)
    assert isinstance(pages, list)
    assert len(pages) == 2

def test_parse_pages_have_text_and_page_num(sample_pdf_path):
    pages = parse_pdf(sample_pdf_path)
    for page in pages:
        assert isinstance(page, ParsedPage)
        assert page.page_num >= 1
        assert len(page.text.strip()) > 0

def test_parse_page_numbers_are_sequential(sample_pdf_path):
    pages = parse_pdf(sample_pdf_path)
    for i, page in enumerate(pages):
        assert page.page_num == i + 1
