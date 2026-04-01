from typing import Generator, List
from openai import OpenAI
from app.config import settings
from app.models.chunk import Chunk

client = OpenAI(api_key=settings.openai_api_key)

SYSTEM_PROMPT = """You are a study assistant. Answer the student's question using ONLY the context provided below.
If the answer is not in the context, respond: "I couldn't find this in your uploaded documents."
Always cite sources inline: [Source: {filename}, p.{page}]"""

def build_context(chunks: List[Chunk]) -> str:
    parts = []
    for chunk in chunks:
        parts.append(f"{chunk.text} [Source: {chunk.file_name}, p.{chunk.page_num}]")
    return "\n\n".join(parts)

def stream_answer(
    question: str,
    chunks: List[Chunk],
    history: List[dict],
) -> Generator[str, None, None]:
    """Yield GPT-4o-mini tokens. `history` is list of {role, content} dicts."""
    context = build_context(chunks)
    messages = [
        {"role": "system", "content": f"{SYSTEM_PROMPT}\n\nCONTEXT:\n{context}"},
        *history[-10:],  # last 10 turns
        {"role": "user", "content": f"QUESTION: {question}"},
    ]
    with client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        stream=True,
    ) as stream:
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
