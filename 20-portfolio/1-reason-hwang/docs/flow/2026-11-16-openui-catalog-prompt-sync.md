# OpenUI 카탈로그 생성·동기화 검사

- 날짜: 2026-11-16
- 상태: 구현·정적 검증 완료. 브라우저 검증은 사용자 지시로 미실행.
- 결정 ID: OPENUI-CATALOG-SYNC-001, OPENUI-CATALOG-001

## 맥락과 확인한 경계

사용자가 `technical_analysis_catalog` handler를 찾지 못하고 Available 목록에 chart만 보이는 오류를 보고했다. 현재 Host의 `/fastapi-chat`·`/langgraph-dev-chat` HTTP 응답이 참조하는 JS에서는 chart/catalog 두 handler가 확인됐다. 남아 있는 과거 번들은 chart만 포함해 오류와 일치하지만, 열린 사용자 탭을 관찰하지 않았으므로 구버전 탭 사용은 추정이다. 두 runtime의 Host catalog GET은 HTTP200, schemaVersion2, catalogVersion ta20-1, 지표20개였다. 이 확인으로 runtime handler 등록을 generate로 고칠 문제와 구분했다.

컴포넌트 원본 library에는58개가 있고 FE txt/spec과 Python prompt 사본은 이미 일치했다. 이후 모든 등록 graph를 조사하며 Canvas의 별도 DSL 모델 prompt만 최신 공통 카탈로그를 읽지 않는 실제 누락을 발견했다. Python 수정·graph10개별 적용 범위·API5/5와 자원 정리는 [prompt 감사 기록](2026-11-16-openui-catalog-prompt-audit.md)을 따른다. 일반 텍스트·상태 계산 graph의 출력 계약을 OpenUI로 강제로 바꾸지 않았다.

## FE 변경

기존 `sec-ui:generate`는 유지한다. 새 `openui:check`는 같은 generator로 OS 임시 디렉터리에 txt/spec을 생성해 FE txt/spec과 Python 공통 prompt 사본을 바이트 비교한다. 저장된 artifact를 수정하지 않으며 임시 디렉터리는 성공·실패 모두 정리한다. 불일치·빈 생성 결과는 명확히 실패하고 `pnpm -C 1-fe-host sec-ui:generate`를 안내한다.

Host build는 이 검사를 먼저 실행한다. 개발 서버 요청마다 generator를 실행하지 않으며 새 graph별 prompt 사본도 만들지 않는다. 현재 artifact가 이미 최신이므로 강제 재생성·provider 변경·서비스 재시작을 하지 않았다.

## 검증

- `pnpm -C 1-fe-host test:openui-sync`:5/5 PASS. 정상 사본, 오래된 FE txt/spec·Python 사본 및 빈 결과를 확인했다.
- `pnpm -C 1-fe-host openui:check`:PASS, 현재 원본58개 컴포넌트와 세 저장 산출물 일치.
- `pnpm -C 1-fe-host typecheck`:PASS.
- 변경 script/test의 ESLint:PASS.
- 실제 Host의 두 화면 JS와 두 catalog GET을 HTTP로 확인했다. 사용자 브라우저는 열지 않았다.
- Python62개 회귀·ruff·pyright 및 API5/5 결과와 소유 자원 정리는 위 prompt 감사 기록에 연결한다. full build는 실행하지 않았다.

## 영향 stock

- [Host OpenUI](../stock/tech-shared/1-fe-host/open-ui.md#openui-catalog-sync-001-생성-원본과-공통-prompt-일치)
- [Python OpenUI](../stock/tech-shared/3-langgraph-fast/open-ui.md#openui-catalog-001-실제-생성-프롬프트와-최신-카탈로그)

기존 SEC 채팅 작업·human-docs·환경 파일은 수정하거나 이번 변경에 포함하지 않는다.
