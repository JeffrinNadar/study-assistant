from dataclasses import dataclass
from typing import List
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.services.pdf_parser import ParsedPage


@dataclass
class TextChunk:
    text: str
    page_num: int
    chunk_index: int  # 0-indexed within the source page


def chunk_pages(
    pages: List[ParsedPage],
    chunk_size: int = 512,
    overlap: int = 50,
) -> List[TextChunk]:
    """Split each page's text into overlapping token-approximate chunks."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        length_function=len,
    )
    all_chunks: List[TextChunk] = []
    for page in pages:
        if not page.text.strip():
            continue
        texts = splitter.split_text(page.text)
        for idx, text in enumerate(texts):
            all_chunks.append(TextChunk(text=text, page_num=page.page_num, chunk_index=idx))
    return all_chunks
