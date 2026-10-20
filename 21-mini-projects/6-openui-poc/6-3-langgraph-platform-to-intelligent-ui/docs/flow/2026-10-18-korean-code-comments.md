# 2026-10-18 한국어 구조 주석

> 원본 Python 예제에서 복사된 주석 정리 이력(CODE-001).

- 변경: 직접 관리하는 소스·테스트·설정의 파일 역할과 함수 경계에 한국어 설명을 추가했다. tool docstring·모델 프롬프트·생성물·환경 값·데이터·잠금 파일은 유지했다.
- 당시 검증: Python AST, JS/TS 주석 제거 후 코드, TOML/JSON 값이 동일했다. Python 13 tests/Ruff 및 frontend lint/typecheck PASS.
- 범위: 동작 변경이 없어 provider 호출과 production 재빌드는 반복하지 않았다. 현재 소스·문서 기준은 [시스템 설계](../stock/system.md)를 따른다.
