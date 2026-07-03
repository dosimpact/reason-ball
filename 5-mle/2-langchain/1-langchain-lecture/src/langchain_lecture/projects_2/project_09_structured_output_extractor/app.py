"""비정형 입력을 정해진 스키마로 추출하는 구조화 출력 예제입니다. 콘솔에서 바로 실행할 수 있는 예제 진입점입니다."""

from __future__ import annotations

from langchain_lecture.projects_2.project_09_structured_output_extractor.extractor import (
    extract_meeting,
)


DEFAULT_MEETING_NOTE = (
    "Product sync: Alice will draft the launch checklist by Friday (priority: high). "
    "민수는 고객 인터뷰 질문지를 다음 주까지 준비하기로 했다. "
    "Someone should follow up on the analytics dashboard."
)


def run_app(text: str = DEFAULT_MEETING_NOTE, model=None) -> dict[str, object]:
    outcome = extract_meeting(text, model=model)
    return outcome.to_api_response()


# 예제 실행 진입점입니다.
def main() -> None:
    outcome = extract_meeting(DEFAULT_MEETING_NOTE)
    print(outcome.to_json())
    if outcome.errors:
        print({"fallback_errors": outcome.errors})


if __name__ == "__main__":
    main()
