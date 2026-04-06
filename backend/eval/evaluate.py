"""
Run RAGAS evaluation against the live backend.

Usage:
    python eval/evaluate.py --session_id <id>

Requires:
    pip install ragas langchain-openai
    Backend running at http://localhost:8000
"""
import json
import argparse
import sys
import requests
from pathlib import Path
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Load .env from backend root so Azure keys are available for RAGAS
load_dotenv(BACKEND_DIR / ".env")


def get_chat_response(session_id: str, question: str) -> dict:
    """Call POST /chat (SSE stream) and collect the full response."""
    resp = requests.post(
        "http://localhost:8000/chat",
        json={"session_id": session_id, "question": question, "history": []},
        stream=True,
        headers={"Accept": "text/event-stream"},
    )
    answer = ""
    contexts = []
    buffer = ""
    for chunk in resp.iter_content(chunk_size=None, decode_unicode=True):
        buffer += chunk
        parts = buffer.split("\n\n")
        buffer = parts.pop()
        for part in parts:
            lines = part.strip().split("\n")
            event_type = None
            data_str = None
            for line in lines:
                if line.startswith("event: "):
                    event_type = line[len("event: "):]
                elif line.startswith("data: "):
                    data_str = line[len("data: "):]
            if event_type and data_str:
                payload = json.loads(data_str)
                if event_type == "token":
                    answer += payload.get("content", "")
                elif event_type == "citations":
                    contexts = [c["text"] for c in payload.get("citations", [])]
    return {"answer": answer, "contexts": contexts}


def main():
    parser = argparse.ArgumentParser(description="Run RAGAS evaluation against the study assistant backend")
    parser.add_argument("--session_id", required=True, help="Session ID with uploaded documents")
    parser.add_argument("--test_set", default="eval/test_set.json", help="Path to test set JSON file")
    parser.add_argument("--output", default="eval/results.csv", help="Output CSV path")
    args = parser.parse_args()

    try:
        from ragas import evaluate, EvaluationDataset, SingleTurnSample
        try:
            from ragas.metrics.collections import Faithfulness, ResponseRelevancy, LLMContextPrecisionWithoutReference
        except ImportError:
            from ragas.metrics import Faithfulness, ResponseRelevancy, LLMContextPrecisionWithoutReference
        from ragas.llms import LangchainLLMWrapper
        from ragas.embeddings import LangchainEmbeddingsWrapper
        from langchain_openai import AzureChatOpenAI, AzureOpenAIEmbeddings
    except ImportError:
        print("ERROR: Install evaluation dependencies first:")
        print("  pip install ragas langchain-openai")
        return

    from app.config import settings

    with open(args.test_set) as f:
        test_set = json.load(f)

    print(f"Running evaluation on {len(test_set)} questions for session {args.session_id}...")
    samples = []
    for i, item in enumerate(test_set):
        print(f"  [{i+1}/{len(test_set)}] {item['question'][:60]}...")
        result = get_chat_response(args.session_id, item["question"])
        samples.append(SingleTurnSample(
            user_input=item["question"],
            response=result["answer"],
            retrieved_contexts=result["contexts"],
            reference=item["ground_truth"],
        ))

    dataset = EvaluationDataset(samples=samples)

    llm = LangchainLLMWrapper(AzureChatOpenAI(
        azure_endpoint=settings.chat_api_endpoint,
        api_key=settings.chat_api_key,
        azure_deployment=settings.chat_deployment,
        api_version=settings.chat_api_version,
    ))
    embeddings = LangchainEmbeddingsWrapper(AzureOpenAIEmbeddings(
        azure_endpoint=settings.embedding_api_endpoint,
        api_key=settings.embedding_api_key,
        azure_deployment=settings.embedding_deployment,
        api_version=settings.embedding_api_version,
    ))

    metrics = [ResponseRelevancy(), LLMContextPrecisionWithoutReference(), Faithfulness()]
    result = evaluate(dataset=dataset, metrics=metrics, llm=llm, embeddings=embeddings)

    print("\n=== RAGAS Results ===")
    print(result)

    df = result.to_pandas()
    df.to_csv(args.output, index=False)
    print(f"\nSaved detailed results to {args.output}")

    print("\n=== Targets ===")
    targets = [
        ("answer_relevancy", 0.80),
        ("llm_context_precision_without_reference", 0.75),
        ("faithfulness", 0.90),
    ]
    for metric, target in targets:
        score = result.get(metric, "N/A") if hasattr(result, 'get') else "N/A"
        if isinstance(score, (int, float)):
            status = "✅" if score >= target else "❌"
            print(f"  {status} {metric}: {score:.4f} (target: >{target})")
        else:
            print(f"  ❌ {metric}: {score} (target: >{target})")


if __name__ == "__main__":
    main()
