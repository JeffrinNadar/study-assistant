"""
Benchmark script for measuring RAG pipeline response latency.

Usage:
    cd backend
    source venv/bin/activate
    python eval/benchmark_latency.py --session_id <id> --token <jwt>

Options:
    --base_url    Backend URL (default: http://localhost:8000)
    --session_id  Session with uploaded PDFs to query against
    --token       JWT access token
    --questions   Path to JSON file with questions (default: eval/test_set.json)
    --runs        Number of times to repeat each question (default: 1)
"""

import argparse
import json
import statistics
import time
from pathlib import Path

import requests


def parse_args():
    parser = argparse.ArgumentParser(description="Benchmark RAG chat latency")
    parser.add_argument("--base_url", default="http://localhost:8000")
    parser.add_argument("--session_id", required=True)
    parser.add_argument("--token", required=True)
    parser.add_argument("--questions", default=None, help="JSON file with questions array")
    parser.add_argument("--runs", type=int, default=1, help="Repeat each question N times")
    return parser.parse_args()


def load_questions(path: str | None) -> list[str]:
    if path:
        with open(path) as f:
            data = json.load(f)
    else:
        default = Path(__file__).parent / "test_set.json"
        if default.exists():
            with open(default) as f:
                data = json.load(f)
        else:
            data = []

    # Support both [{"question": "..."}, ...] and ["question", ...]
    questions = []
    for item in data:
        if isinstance(item, str):
            questions.append(item)
        elif isinstance(item, dict) and "question" in item:
            questions.append(item["question"])
    return questions


def benchmark_chat(base_url: str, session_id: str, token: str, question: str) -> dict:
    """Send a chat request and measure TTFB + total time."""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload = {"session_id": session_id, "question": question}

    start = time.perf_counter()
    resp = requests.post(
        f"{base_url}/chat",
        json=payload,
        headers=headers,
        stream=True,
    )

    if resp.status_code != 200:
        return {"error": f"HTTP {resp.status_code}: {resp.text}", "question": question}

    ttfb = None
    token_count = 0
    for chunk in resp.iter_content(chunk_size=1):
        if ttfb is None:
            ttfb = (time.perf_counter() - start) * 1000
        token_count += 1

    total = (time.perf_counter() - start) * 1000

    return {
        "question": question[:60],
        "ttfb_ms": round(ttfb or 0, 1),
        "total_ms": round(total, 1),
    }


def percentile(data: list[float], p: float) -> float:
    """Calculate the p-th percentile (0-100)."""
    sorted_data = sorted(data)
    idx = int(len(sorted_data) * p / 100)
    idx = min(idx, len(sorted_data) - 1)
    return sorted_data[idx]


def main():
    args = parse_args()
    questions = load_questions(args.questions)

    if not questions:
        print("No questions found. Provide a JSON file with --questions or populate eval/test_set.json.")
        print('Expected format: [{"question": "..."}, ...] or ["question1", "question2", ...]')
        return

    print(f"Benchmarking {len(questions)} questions x {args.runs} run(s) against {args.base_url}")
    print(f"Session: {args.session_id}\n")
    print(f"{'#':<4} {'TTFB':>8} {'Total':>8}  Question")
    print("-" * 70)

    all_ttfb = []
    all_total = []
    errors = 0

    n = 0
    for run in range(args.runs):
        for q in questions:
            n += 1
            result = benchmark_chat(args.base_url, args.session_id, args.token, q)

            if "error" in result:
                print(f"{n:<4} {'ERROR':>8} {'':>8}  {result['question']}...")
                print(f"     {result['error']}")
                errors += 1
                continue

            all_ttfb.append(result["ttfb_ms"])
            all_total.append(result["total_ms"])
            print(f"{n:<4} {result['ttfb_ms']:>7.0f}ms {result['total_ms']:>7.0f}ms  {result['question']}...")

    if not all_ttfb:
        print("\nNo successful requests. Check your token and session_id.")
        return

    print("\n" + "=" * 70)
    print(f"Results: {len(all_ttfb)} successful, {errors} errors\n")

    print(f"{'Metric':<20} {'Median':>10} {'Mean':>10} {'P95':>10} {'Min':>10} {'Max':>10}")
    print("-" * 70)
    for label, data in [("TTFB (ms)", all_ttfb), ("Total (ms)", all_total)]:
        print(
            f"{label:<20} "
            f"{statistics.median(data):>9.0f} "
            f"{statistics.mean(data):>9.0f} "
            f"{percentile(data, 95):>9.0f} "
            f"{min(data):>9.0f} "
            f"{max(data):>9.0f}"
        )

    # Save results to CSV
    output_path = Path(__file__).parent / "latency_results.csv"
    with open(output_path, "w") as f:
        f.write("question,ttfb_ms,total_ms\n")
        for i, q in enumerate(questions * args.runs):
            if i < len(all_ttfb):
                f.write(f'"{q[:80]}",{all_ttfb[i]:.1f},{all_total[i]:.1f}\n')
    print(f"\nDetailed results saved to {output_path}")


if __name__ == "__main__":
    main()
