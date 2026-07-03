"""가장 단순한 프롬프트-모델 체인 흐름을 보여주는 예제입니다. 콘솔에서 바로 실행할 수 있는 예제 진입점입니다."""

from __future__ import annotations

from langchain_lecture.projects.project_01_hello_world.chain import summarize_person
from langchain_lecture.projects.project_01_hello_world.prompts import SAMPLE_INFORMATION


# 예제 실행 진입점입니다.
def main() -> None:
    print(summarize_person(SAMPLE_INFORMATION))


if __name__ == "__main__":
    main()

