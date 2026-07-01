from __future__ import annotations

from langchain_lecture.projects.project_01_hello_world.chain import summarize_person
from langchain_lecture.projects.project_01_hello_world.prompts import SAMPLE_INFORMATION


def main() -> None:
    print(summarize_person(SAMPLE_INFORMATION))


if __name__ == "__main__":
    main()

