#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT_DIR / ".env"


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if value and len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        os.environ.setdefault(key, value)


def _effective_cwd(raw_cwd: str | None) -> Path:
    return Path(raw_cwd).resolve() if raw_cwd else ROOT_DIR


def _effective_prompt(args: argparse.Namespace) -> str:
    prompt = " ".join(args.prompt).strip()
    if not prompt:
        raise SystemExit("prompt is required, e.g. `python3 scripts/chatbot.py hi`")
    return prompt


def _build_codex_cmd(args: argparse.Namespace, output_path: Path) -> list[str]:
    codex_path = (args.codex_path or os.getenv("CODEX_CLI_PATH", "codex")).strip() or "codex"
    sandbox = (args.sandbox or os.getenv("CODEX_SANDBOX", "read-only")).strip() or "read-only"
    model = (args.model or os.getenv("CHATBOT_MODEL", "")).strip()
    profile = args.profile if args.profile is not None else os.getenv("CODEX_PROFILE", "")
    cwd = _effective_cwd(args.cd)

    cmd = [
        codex_path,
        "exec",
        "--skip-git-repo-check",
        "--sandbox",
        sandbox,
        "--color",
        "never",
        "--output-last-message",
        str(output_path),
        "--cd",
        str(cwd),
    ]
    if model:
        cmd.extend(["--model", model])
    profile = profile.strip()
    if profile:
        cmd.extend(["--profile", profile])
    if args.ephemeral:
        cmd.append("--ephemeral")
    cmd.append(_effective_prompt(args))
    return cmd


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="chatbot.py",
        description="Standalone one-shot local Codex CLI chatbot.",
    )
    parser.add_argument("prompt", nargs="+", help="Prompt to send to Codex")
    parser.add_argument("--model", help="Override Codex model")
    parser.add_argument("--profile", help="Override Codex profile", default=None)
    parser.add_argument(
        "--sandbox",
        choices=["read-only", "workspace-write", "danger-full-access"],
        default=None,
        help="Override Codex sandbox mode",
    )
    parser.add_argument("--cd", help="Working directory for the Codex session", default=None)
    parser.add_argument("--codex-path", help="Path to the local codex CLI binary", default=None)
    parser.add_argument("--ephemeral", action="store_true", help="Run without persisting Codex session files")
    parser.add_argument("--print-cmd", action="store_true", help="Print the resolved Codex command as JSON and exit")
    return parser


def main(argv: list[str] | None = None) -> int:
    _load_dotenv(ENV_PATH)
    parser = build_parser()
    args = parser.parse_args(argv)
    cwd = _effective_cwd(args.cd)

    with tempfile.TemporaryDirectory(prefix="chatbot-codex-") as temp_dir:
        output_path = Path(temp_dir) / "last-message.txt"
        cmd = _build_codex_cmd(args, output_path=output_path)

        if args.print_cmd:
            print(json.dumps({"cmd": cmd, "cwd": str(cwd)}, ensure_ascii=False, indent=2))
            return 0

        completed = subprocess.run(
            cmd,
            cwd=str(cwd),
            text=True,
            capture_output=True,
            check=False,
        )
        if completed.returncode != 0:
            detail = (completed.stderr or "").strip() or (completed.stdout or "").strip()
            if detail:
                print(detail, file=sys.stderr)
            return completed.returncode

        if output_path.exists():
            sys.stdout.write(output_path.read_text(encoding="utf-8"))
            return 0

        text = (completed.stdout or "").strip()
        if text:
            print(text)
            return 0

        print("codex exec completed but produced no output", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
