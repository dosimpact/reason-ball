# A2UI 계약·어댑터·실제 모델 API 검증

- 날짜: 2026-09-21 (KST)
- 범위: tech-shared / 1-fe-host / 3-langgraph-fast
- 원본: [A2UI 시스템 설계](../stock/tech-shared/a2ui-system.md)
- 상태: 구현 진행 중. 이 기록은 전체 완료 판정이 아니다.

## 구현과 결정

- A2UI-REG-001/CAT-001: 61개 UI 파일을 61개 조합형 어댑터로 대응하고 Row/Column/Text/Metric/InfoRow를 추가했다. 세 정적 카탈로그와 manifest를 React/Python에 함께 생성한다.
- Input 계열은 ComponentContext의 DataContext.set으로 값을 쓰며, action 전송 직전에 resolveAction으로 최신 바인딩을 평가한다. 최초 Storybook 실행이 경로 객체의 원형 전송을 발견했고 수정 후 재검증했다.
- A2UI-DYN-001: 실제 모델의 generate_a2ui 도구와 하위 render_a2ui planner를 사용한다. 모델 분석 아래 서버 소유의 지역 조회 패널을 결합한다. 조회 action은 이 패널을 갱신한다.
- A2UI-FIX-001/ACT-001: 사전 JSON 항공편 트리와 display_flight 도구를 구현했다. 선택은 권위 있는 서버 surface 데이터를 갱신한다.
- A2UI-STATE-001: 클라이언트가 제출한 surfaces를 무시하고 checkpoint에서 복원한다. 큐에 들어가기 전에 thread를 예약하며 연결 종료/취소에서 실행 슬롯을 반환한다.
- Runtime의 a2uiToolNames를 빈 배열로 설정하여 미검증 하위 모델 스트림이 화면을 그리지 않게 했다. 최종 검증된 도구 결과만 렌더링하며 AG-UI 모델 이벤트 자체는 스트리밍한다.
- OAuth Responses 호환성: 실제 HTTP 비교에서 typed system message는 400, typed developer message는 200이었다. A2UI 전용 OAuthResponsesChatOpenAI에서 system→developer를 변환한다. 기존 채팅 provider와 API-key 모델은 변경하지 않는다.

## 실행 증거

| 요구사항 | 실행 | 결과 |
| --- | --- | --- |
| CAT-01/VER-01 | `pnpm a2ui:check` | 61 sources / 66 adapters / 3 catalogs PASS |
| 계약·상태 | `uv run pytest tests/test_a2ui_contract.py tests/test_a2ui_workflow.py -q` | 14 PASS (통제된 모델) |
| VAL-VIEW-001, BIND-01 | `vitest run --project storybook src/lib/a2ui/registry.stories.tsx` | 69 PASS: 전체 어댑터 렌더, Select/Input 최신값 action, Dialog 조립 |
| 공식 스키마와 Zod | `pnpm --filter reason-hwang-fe-host test:a2ui` | 68 PASS: 66 fixtures와 거절 사례 |
| VAL-API-001 | Bruno `13-a2ui`, 실제 FastAPI 18080 + OAuth 프록시 2890 | 요청 7/7, tests 7/7, assertions 8/8 PASS |
| MODEL-01 일부 | gpt-5.6-luna / OAuth, Fixed와 Dynamic 실제 도구 호출 | 생성 PASS; 전체 API-key 제공자 검증은 아님 |

Bruno는 버전 manifest, stale hash 거절, 항공편 생성/선택, 교차 thread 거절, Dynamic 생성 및 부산 매출 조회를 확인했다. 전체 매출 $680,000, 부산 $320,000/3개 거래처, 선택 이후 항공편 가격 $289 유지가 관찰됐다.

공식 스키마의 untyped JSON value에 additionalProperties가 있는 것은 유효한 JSON Schema이지만 Ajv의 선택적 strictTypes lint와 충돌한다. 공식 스키마 비교 테스트에서 strictTypes만 해제하고 실제 wire/props 검증은 유지했다. 자체 생성 카탈로그는 strict 검사한다.

## 남은 검증

- MCP 브라우저에서 실제 Fixed 선택·Dynamic 조회 및 오류/취소/새 대화 확인.
- 여섯 Dynamic 질문 유형과 실제 API-key 제공자 실증.
- 변경 이후 전체 필수 정적 검사/회귀/빌드, 패키지 문서·stock 동기화, 최종 검토와 커밋.
- 사용자의 요청에 따라 브라우저 E2E/Storybook/빌드는 병렬 실행하지 않는다.

## 환경 사건

명령 실행 중 일시적으로 ENOSPC가 발생했다. 다음 확인에서 사용 가능 공간은 17 GiB였으며 원본이나 사용자 파일은 삭제하지 않았다. 종료된 검증 서버는 PID/포트 부재를 확인한 후 재시작했다. 테스트 소유 FastAPI는 18080, Next.js는 2815를 사용한다.
