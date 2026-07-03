"""MCP 형태의 도구 발견과 호출을 에이전트에 연결하는 예제입니다. 콘솔에서 바로 실행할 수 있는 예제 진입점입니다."""

from __future__ import annotations

from langchain_lecture.projects_2.project_13_mcp_tools_agent.agent import build_mcp_agent


# 예제 실행 진입점입니다.
def main() -> None:
    agent = build_mcp_agent()
    print(agent.discover())
    print(agent.invoke("프로젝트 폴더의 파일 목록을 알려줘").answer)


if __name__ == "__main__":
    main()
