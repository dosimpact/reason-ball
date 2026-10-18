"""uv run python -m agent.fixtures seed|correct — 로컬 합성 데이터 관리."""

import argparse

from agent.analysis import correct_fixture, seed

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["seed", "correct"])
    parser.add_argument("--delta", type=float, default=1000)
    args = parser.parse_args()
    if args.command == "seed":
        seed(reset=True)
    else:
        correct_fixture(args.delta)
    print("Synthetic dataset updated")
