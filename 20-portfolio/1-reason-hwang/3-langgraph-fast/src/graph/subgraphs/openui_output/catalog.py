"""Read the generated frontend catalog at composition time, never at import time."""
from pathlib import Path

CATALOG_PATH = Path(__file__).parent / "generated" / "system-prompt.txt"


def load_openui_catalog() -> str:
    """Use the packaged, generator-synchronized artifact for each new composition."""
    return CATALOG_PATH.read_text(encoding="utf-8")
