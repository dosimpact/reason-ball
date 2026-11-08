"""실제 CLI 진입점 18개를 새 프로세스로 실행. 외부 모델/API를 호출하지 않는다."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main():
    env = {**os.environ, "DEEP_AGENTS_MODE": "scripted", "LANGSMITH_TRACING": "false"}
    paths = sorted((ROOT / "graphs/deep_agents").rglob("[0-9]*.py"))
    failed = []
    for path in paths:
        module = ".".join(path.relative_to(ROOT).with_suffix("").parts)
        command = [sys.executable, "-m", module]
        if path.stem.startswith("14_"):
            command += ["--decision", "reject"]
        try:
            result = subprocess.run(
                command,
                cwd=ROOT,
                env=env,
                capture_output=True,
                check=False,
                text=True,
                timeout=45,
            )
        except subprocess.TimeoutExpired:
            failed.append(path.stem)
            print("FAIL", path.stem, "timeout")
            continue
        if result.returncode:
            failed.append(path.stem)
            print("FAIL", path.stem, result.stderr[-3000:])
        else:
            print("PASS", path.stem)
    print(f"{len(paths) - len(failed)}/{len(paths)} CLI passed")
    return bool(failed)


if __name__ == "__main__":
    raise SystemExit(main())
