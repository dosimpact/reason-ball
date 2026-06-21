from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

from ..core.config import AppConfig


def _base_codex_cmd(config: AppConfig) -> list[str]:
    cmd = [
        config.codex_cli_path.strip() or "codex",
        "--sandbox",
        config.codex_sandbox.strip() or "read-only",
    ]
    profile = config.codex_profile.strip()
    if profile:
        cmd.extend(["--profile", profile])
    return cmd


def run_codex_exec_json(config: AppConfig, prompt: str, schema: dict) -> str:
    with tempfile.TemporaryDirectory(prefix="parser-codex-") as temp_dir:
        schema_path = Path(temp_dir) / "schema.json"
        output_path = Path(temp_dir) / "response.json"
        schema_path.write_text(json.dumps(schema, ensure_ascii=False, indent=2), encoding="utf-8")

        instruction = (
            "Return only JSON that matches the provided schema. "
            "Do not wrap the response in markdown fences."
        )
        cmd = [
            *_base_codex_cmd(config),
            "exec",
            "--skip-git-repo-check",
            "--color",
            "never",
            "--output-schema",
            str(schema_path),
            "--output-last-message",
            str(output_path),
            "-",
        ]

        try:
            completed = subprocess.run(
                cmd,
                input=f"{instruction}\n\n{prompt}",
                text=True,
                capture_output=True,
                check=False,
                timeout=max(1, config.codex_exec_timeout_sec),
            )
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError(
                f"codex exec timed out after {max(1, config.codex_exec_timeout_sec)}s"
            ) from exc
        if completed.returncode != 0:
            stderr = (completed.stderr or "").strip()
            stdout = (completed.stdout or "").strip()
            detail = stderr or stdout or f"codex exec exited with code {completed.returncode}"
            raise RuntimeError(detail)

        if not output_path.exists():
            raise RuntimeError("codex exec did not write the expected output file")

        return output_path.read_text(encoding="utf-8")


def run_codex_chat(config: AppConfig, initial_prompt: str | None = None, cwd: Path | None = None) -> int:
    cmd = _base_codex_cmd(config)
    if cwd is not None:
        cmd.extend(["--cd", str(cwd)])
    if initial_prompt:
        cmd.append(initial_prompt)

    process = subprocess.Popen(
        cmd,
        stdin=sys.stdin,
        stdout=sys.stdout,
        stderr=sys.stderr,
        text=True,
        cwd=str(cwd) if cwd is not None else None,
    )
    return process.wait()
