"""
Run RAGAS evaluation against the live backend.

Usage:
    python eval/evaluate.py --session_id <id>

Requires:
    pip install ragas datasets sseclient-py
    Backend running at http://localhost:8000
"""
import json
import argparse
import requests

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
        from datasets import Dataset
        from ragas import evaluate
        from ragas.metrics import answer_relevancy, context_precision, faithfulness
    except ImportError:
        print("ERROR: Install evaluation dependencies first:")
        print("  pip install ragas datasets sseclient-py")
        return

    with open(args.test_set) as f:
        test_set = json.load(f)

    print(f"Running evaluation on {len(test_set)} questions for session {args.session_id}...")
    rows = []
    for i, item in enumerate(test_set):
        print(f"  [{i+1}/{len(test_set)}] {item['question'][:60]}...")
        result = get_chat_response(args.session_id, item["question"])
        rows.append({
            "question": item["question"],
            "answer": result["answer"],
            "contexts": result["contexts"],
            "ground_truth": item["ground_truth"],
        })

    dataset = Dataset.from_list(rows)
    result = evaluate(dataset, metrics=[answer_relevancy, context_precision, faithfulness])
    print("\n=== RAGAS Results ===")
    print(result)

    df = result.to_pandas()
    df.to_csv(args.output, index=False)
    print(f"\nSaved detailed results to {args.output}")

    print("\n=== Targets ===")
    scores = result.scores if hasattr(result, 'scores') else {}
    for metric, target in [("answer_relevancy", 0.80), ("context_precision", 0.75), ("faithfulness", 0.90)]:
        score = scores.get(metric, "N/A")
        status = "✅" if isinstance(score, float) and score >= target else "❌"
        print(f"  {status} {metric}: {score} (target: >{target})")


if __name__ == "__main__":
    main()
