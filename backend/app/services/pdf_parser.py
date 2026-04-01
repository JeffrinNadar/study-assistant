from dataclasses import dataclass
from typing import List
import fitz  # PyMuPDF

@dataclass
class ParsedPage:
    page_num: int   # 1-indexed
    text: str

def parse_pdf(file_path: str) -> List[ParsedPage]:
    """Extract text from each page of a PDF, preserving page numbers."""
    pages: List[ParsedPage] = []
    with fitz.open(file_path) as doc:
        for i, page in enumerate(doc):
            text = page.get_text()
            pages.append(ParsedPage(page_num=i + 1, text=text))
    return pages
