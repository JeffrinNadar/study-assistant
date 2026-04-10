from typing import Generator, List, Union
from openai import AzureOpenAI
from app.config import settings

client = AzureOpenAI(
    api_key=settings.chat_api_key,
    azure_endpoint=settings.chat_api_endpoint,
    api_version=settings.chat_api_version,
)

SYSTEM_PROMPT = """You are a study assistant. Answer the student's question using primarily the context provided below. You may briefly explain foundational concepts if needed to clarify the material.

Use a clear, encouraging tone suitable for student learning. Break complex topics into understandable steps.

Structure your response as follows:

## Answer
[Direct, clear answer to the question in 2-3 paragraphs unless a detailed explanation is requested]

## Key Concepts
- **[Term]**: [Brief definition/explanation from context]
(List 2-5 key terms mentioned in your answer)

## Dig Deeper
- [Follow-up question 1]
- [Follow-up question 2]
- [Follow-up question 3]

If the answer is not in the context, respond: "I couldn't find this in your uploaded documents."
If the context has conflicting information, note the discrepancy and cite both sources.
Always cite sources inline: [Source: {filename}, p.{page}]"""


def build_context(chunks: list[dict | object]) -> str:
    parts = []
    for chunk in chunks:
        if isinstance(chunk, dict):
            text, file_name, page_num = chunk["text"], chunk["file"], chunk["page"]
        else:
            text, file_name, page_num = chunk.text, chunk.file_name, chunk.page_num
        parts.append(f"=== Source: {file_name}, p.{page_num} ===\n{text}")
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
