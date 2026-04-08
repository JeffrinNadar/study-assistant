from typing import Generator, List, Union
from openai import AzureOpenAI
from app.config import settings

client = AzureOpenAI(
    api_key=settings.chat_api_key,
    azure_endpoint=settings.chat_api_endpoint,
    api_version=settings.chat_api_version,
)

SYSTEM_PROMPT = """You are a study assistant. Answer the student's question using ONLY the context provided below.
If the answer is not in the context, respond: "I couldn't find this in your uploaded documents."
Always cite sources inline: [Source: {filename}, p.{page}]"""

def build_context(chunks: List[Union[dict, object]]) -> str:
    parts = []
    for chunk in chunks:
        if isinstance(chunk, dict):
            text = chunk["text"]
            file_name = chunk["file"]
            page_num = chunk["page"]
        else:
            text = chunk.text
            file_name = chunk.file_name
            page_num = chunk.page_num
        parts.append(f"{text} [Source: {file_name}, p.{page_num}]")
    return "\n\n".join(parts)

def stream_answer(
    question: str,
    chunks: List[Union[dict, object]],
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
        model=settings.chat_deployment,
        messages=messages,
        stream=True,
    ) as stream:
        for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
