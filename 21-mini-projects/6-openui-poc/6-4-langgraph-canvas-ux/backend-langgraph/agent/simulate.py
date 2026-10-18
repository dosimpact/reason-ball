"""Local-only synthetic source update; server drains requests on the next refresh."""

import os
from pathlib import Path
from uuid import uuid4


def main():
    directory = Path(os.getenv("CANVAS_DATA_DIR", "data/canvas"))
    directory.mkdir(parents=True, exist_ok=True)
    (directory / f"advance-{uuid4()}.request").write_text("synthetic sales correction")
    print("Queued a synthetic sales correction. Refresh a widget to apply it.")


if __name__ == "__main__":
    main()
