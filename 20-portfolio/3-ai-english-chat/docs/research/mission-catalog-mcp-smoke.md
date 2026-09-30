# 미션 카탈로그 Playwright MCP smoke

2026-09-21 KST. MISSION-CATALOG-01 / MISSION-CURRICULUM-01/02/03 / MISSION-PROBLEM-SOLVING-01.

## 검증 범위와 결과

**실제 MCP 카탈로그·배정·대화 smoke PASS.** 원격 DB 적재 검증은 별도 `docs/flow/2026-09-21-mission-remote-validation.json`을 참조한다. 이 검증은 752개 전체의 학습 효과나 모든 대화 경로를 보증하지 않는다.

| 검증 | 실제 결과 |
|---|---|
| 업로드 전 기준 | 기존 호텔 미션 1개, 검색→상세 정상 |
| 준비 전 프로필 | learner UI에서 B1 + 직장 저장 후 readiness=false 요청은 `catalog-empty`, 0개 |
| 관리자 전체 조회 | 기존 seed 1개 + 신규 카탈로그 752개 = 753개; 작성 원본에서 계산한 752개 ID 전부 포함 |
| 비공개 필드 | 전체 manager API 응답에 `catalogImport`, `source`, `directorPrompt`, `evaluatorPrompt` 키 없음 |
| 대표 5개 UI | pre-A1 물 요청, 개발자 버그 재현, 디자이너 모바일 핸드오프, IT 로그인 문의, 회의 우선순위: 제목 검색→해당 ID 상세→level 1 제목 확인 |
| 전문 상세 | 문제·사실·제약·권한·상대 입장·결과·기준을 한국어로 확인; `professionalRole`/`caseBrief` 원본 JSON 문법 미노출 |
| 자연 배정 | B1 + 직장 learner에게 5개, 재요청 후에도 5개. 테스트가 배정 행을 임의 삽입하지 않음 |
| 입력 경계 | ownerId·count 752 위조는 400, 외부 Origin은 403 |
| 미배정 미션 | UI `미션을 찾을 수 없어요.`, 상세 API 404, 시작 API 404, learner JWT 직접 Data API 결과 0행 |
| 실제 AI | 배정된 업무 실수 미션 시작→영어 한 문장→실제 모델 응답 수신 |
| 새로고침 | 동일 conversation ID, 사용자 1개·assistant 1개와 본문 복원; 입력창 다시 활성화 |

자동 스크립트의 25개 MCP 호출이 통과했다. AI 대화는 별도 수동 MCP 호출로 검사했으며 자동화 옵션 `MCP_RUN_AI=1`을 다시 실행해 중복 비용을 만들지 않았다. 미션 완료 평가·보상 지급은 이번 smoke 범위가 아니다.

실제 대화:

- 미션: `9fd84ec5-6752-8396-a5c5-e24d7db4a840` — 업무 실수를 알리고 복구 제안하기
- 사용자: “I used the old date by mistake, and I will send a corrected copy now.”
- AI: “Thanks for letting me know. Who received the old file—only our team, or the customer too?”
- 복원 확인 conversation: `26bcc4aa-0400-446d-9951-01109c877214` (검증 종료 시 임시 계정과 함께 정리)

## 실행 환경과 실제 MCP 경로

- 대상: `http://dodonet.iptime.org:13000`, 기존 Next.js 서버. 해당 서버를 기동·종료하지 않았다.
- `/tmp/mission-playwright-mcp`에 `@playwright/mcp@0.0.82`, `@modelcontextprotocol/sdk@1.30.0`을 설치했다. 저장소 의존성은 변경하지 않았다.
- SDK `StdioClientTransport` → `Client.connect` → `listTools` → `callTool`. 서버 이름 `Playwright`, 보고 버전 `1.64.0-alpha-1789764292000`.
- Chrome headless/isolated. `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_run_code_unsafe`, `browser_take_screenshot` 사용. 일반 Playwright 실행을 MCP 실행으로 대체 표기하지 않는다.
- 셀렉터는 먼저 실제 snapshot에서 확인했다. 상세 이동 중 카드 제목이 먼저 일치하는 검사 경합은 `waitForURL` + level 1 heading으로 수정했다. 자동 대화 제목과 사용자 본문 중복은 message-user test ID로 구분했다.
- 최초 비로그인 `/api/me/learning` 401 및 의도적인 404/400/403이 있어 콘솔 오류 0개로 보고하지 않는다.
- 그래프 MCP 미노출로 project/generation/coverage 미확인. 명시된 stock 문서와 live fixture/config를 직접 읽었다.

## 성능 발견과 재검증

초기 전체 관리자 조회가 기본 30초 제한을 넘겨 실패했다. 제한을 120초로 명시한 후속 측정은 26,111ms / 753개였다. projection 변경 후 측정은 JSON 읽기까지 30,074ms / 753개로 경계였다. 이 실패 이력은 성공으로 덮어쓰지 않는다. 부모 에이전트가 이후 parent RLS 확인을 유지하며 게시 버전·단계·공개 자산 읽기를 최적화했다. 최종 최적화 측정은 아래 완료 기록과 증거 JSON을 참조한다.

## 증거와 재현

[선별한 MCP 결과](../flow/evidence/2026-09-21-mission-mcp/mcp-result.json), [학습자 직접 RLS](../flow/evidence/2026-09-21-mission-mcp/learner-rls.json).

- [관리자 753개](../flow/evidence/2026-09-21-mission-mcp/manager-catalog.png)
- [학습자 배정 5개](../flow/evidence/2026-09-21-mission-mcp/learner-five.png)
- [실제 AI 답변 복원](../flow/evidence/2026-09-21-mission-mcp/learner-ai-restored.png)
- [전문 과업 상세](../flow/evidence/2026-09-21-mission-mcp/professional-detail.png)
- [미배정 상세 차단](../flow/evidence/2026-09-21-mission-mcp/unassigned-denied.png)

```sh
npm install --prefix /tmp/mission-playwright-mcp --no-audit --no-fund @playwright/mcp@0.0.82 @modelcontextprotocol/sdk@1.30.0
```

`scripts/missions/playwright-mcp-session.mjs`는 stdin JSONL MCP 호출을 전달하는 연결 도구다. `scripts/missions/smoke-profile-catalog-mcp.mjs`는 위 카탈로그·프로필 시나리오를 실행한다. 필수 환경 변수는 `PLAYWRIGHT_MCP_HOME`, `MISSION_CATALOG_OWNER_ID`, `MCP_LEARNER_STORAGE_STATE`, `MCP_MANAGER_STORAGE_STATE`다. storage state는 mode 0600의 별도 테스트 계정 파일이어야 한다. 생성과 관리 권한 등록은 서버 전용 fixture에서 수행한다. 계정 생성/삭제와 직접 Data API 검사는 자동 MCP 스크립트 바깥의 fixture 책임이다.

`MCP_RUN_AI=1`은 추가로 실제 AI 전송·복원을 실행한다. `MCP_FINAL_VERIFICATION=1`은 대표 상세 반복을 생략하고 최종 전체 ID/필드와 learner 경계를 재확인한다. `PLAYWRIGHT_MCP_EVIDENCE`로 증거 디렉터리를 지정한다. 두 스크립트 `node --check` 통과.

## 증거 보안과 정리

MCP의 API timeout call log가 임시 계정 쿠키 헤더를 포함하는 것을 발견했다. 해당 세션을 로그아웃하고 임시 manager 계정을 삭제한 뒤 새 계정으로 검증했다. 두 연결/시나리오 스크립트에 cookie/authorization 헤더 redaction을 추가했다. 저장소에는 선별한 결과와 UI 캡처만 보존하며 원시 오류 로그·storage state·암호는 넣지 않는다. 최종 임시 계정·대화·세션 정리 결과는 아래 완료 기록에 남긴다.

## 참고와 스킬

- [Microsoft Playwright MCP 공식 저장소](https://github.com/microsoft/playwright-mcp)
- [Supabase Auth createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser)
- 적용: `/Users/dosimpact/workspace/focus/reason-ball/.codex/skills/apb-playwright-e2e/SKILL.md`, `/Users/dosimpact/.agents/skills/supabase/SKILL.md`.

## 최종 완료 기록

- 최종 최적화 코드에서 기본 API timeout 30,000ms로 manager 조회를 재실행했다: **15,146ms, 총 753개, 작성 ID 752개 모두 포함, 누락 0, 비공개 필드 없음**. learner 5개·위조 입력·외부 Origin·미배정 404도 재확인했다. 이때 10개 MCP 호출 PASS. 15.1초는 이번 개발 서버 단일 측정이며 부하 테스트나 지연 시간 SLO 통과를 뜻하지 않는다.
- 초기 폐기 manager를 포함한 임시 Auth 3개를 삭제했고 각각 Auth 조회 404, 소유 대화 0개를 확인했다. manager 등록과 배정은 Auth FK cascade로 제거된다. 실제 사용자·752개 게시 카탈로그는 정리 대상에 넣지 않았다.
- mode 0600 계정 암호 파일 2개와 storage state 2개를 제거했다. MCP 연결을 닫았다. [정리 확인 JSON](../flow/evidence/2026-09-21-mission-mcp/cleanup.json)을 보존한다.
