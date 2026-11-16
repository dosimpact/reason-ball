# SEC 금융 수치 basis 검산 — 2026-11-16

상태: SEC API Agent의 research/OpenUI 경계 구현·API 회귀 검증·자원 정리 완료. 브라우저는 사용자 지시로 제외. 커밋·사용자 서비스 재시작은 상위 담당자 소유.

## SEC-FIN-BASIS-002: 배경과 변경

이전 회귀에서는 원금 786.78+CP19.97=806.75와 장부금액 781.14+CP19.97=801.11을 혼용했다. 앞선 조사에서 미해결로 남긴 SEC-FIN-BASIS-001을 프롬프트 변경만으로 해결하지 않고, 기존 /api/sec-deep-agent/research와 /chat의 두 단계 사이에 구조화 근거·결정적 계산 경계를 추가한다. 특정 회사나 해당 수치를 제품 코드에 넣지 않았다.

1. research가 실제 get_sec_filing_content 도구로 보여준 excerpt만 sourceId(CIK:accession)별로 보관한다. 서로 떨어진 excerpt를 연결해 만든 인용은 허용하지 않는다.
2. 금융 금액/배수 문맥에 한정해 structured model call로 facts와 calculations를 추출한다(최대60초). 단순 설립 연도·주식수만 있는 보고서는 기존 경로를 유지한다.
3. fact는 numeric value/valueToken, currency, scale, principal/carrying/fair_value/cash basis, full asOf date, sourceId, exact quote/unitQuote/dateQuote를 요구한다. 원문 substring·수치 경계/일치·통화와 단위·명시 basis·기준일을 코드로 확인한다. 한 인용에 여러 basis가 섞이면 보수적으로 거부한다.
4. Decimal이 base currency로 단위를 환산하고 sum/subtract/ratio를 계산한다. 합계/차는 동일 basis, 모든 입력은 동일 통화·기준일이어야 한다. ratio는 numeratorBasis/denominatorBasis를 명시하며 0 분모·미검증/전방 참조·중복 입력을 거부한다. claimedValue가 틀리면 검산값을 표시하고 정정을 알린다.
5. 금융 숫자가 있는 원래 문단은 검산 표·계산·확인 불가 안내로 대체한다. 잘못된 본문을 검산 배지 옆에 방치하지 않는다. 비금융 설명과 확인한 공시 CIK/accession/date/link를 남기며, 분석을 대체했다는 안내를 표시한다. 검증불가 수치 자체는 보고서에 표시하지 않는다.
6. financialVerification이 있는 답변의 최종 UI는 server-authored root=Markdown(report)로 만든 후 기존 Host parser로 검사한다. 2차 composer가 검산 금액/기준을 다시 바꾸지 못한다. 비금융 답변은 기존 자유 구성 composer 경로를 유지한다. 연구 JSON은 financialVerification을 추가 반환한다.

## 범위와 한계

원문 인용과 산술의 대조이며 회계 의미 추출의 완전한 감사나 모든 재무항목 파서가 아니다. 지원 basis/currency/scale/date 형식 밖의 데이터, 컬럼 의미가 불명확한 표, 숫자·단위·일자를 명시하지 않은 근거는 검증 불가로 처리한다. 모델이 추출한 관계의 의미 자체를 보장하지 않는다. 추출 실패·누락은 확인 불가 안내로 닫고 원래 금융 주장으로 복귀하지 않는다. 금액 합계의 claimedValue는 base currency, ratio는 unitless이며 Decimal 기본 반올림을 사용한다. 실패/경계 밖이면 숫자 시각화보다 검증불가 안내를 우선한다.

보호 범위는 회귀가 발생한 SEC API Agent /research 및 /chat이다. LangGraph에 직접 등록된 raw sec_deep_agent 자유형 메시지 경로는 이번 변경으로 보호되지 않는다. 사용자 승인 범위를 유지해 raw graph에 새 후처리 노드를 추가하지 않았다. 금융 추출 품질에 대한 실제 외부 모델/SEC 실측 검증은 하지 않았다.

## 실행 증거

- uv pytest tests/test_sec_financial_verification.py tests/test_sec_admin_chat.py -q: 15 PASS(신규13+기존2,1.28초). 원금/장부 혼용 정정, USD million→base units, 다른 값/scale, source/valueToken/basis/unit/date 오류와 transitive 계산 차단, 중복 입력/ratio basis, 비금융 연도·주식수 보존 확인.
- Bruno 29-sec-financial-verification: 최종10 requests/10 tests/10 assertions PASS(499ms), /tmp/sec-financial-http-final.json. corrected/mixed/source/unit/date/no-evidence/extraction-failure/nonfinancial/research→chat SSE/final actual Host parser를 검증했다. 원금80675000000와1.70을 표시하며80111000000 본문은 남지 않는다. 실제 production routers·research 함수·presentation graph를 경유하고 모델/공시 도구만 fixture이다. 마지막 parser는 실제 소유 Next /api/sec-ui/validate로 valid=true/errors=[]를 확인했다.
- 변경 Python 파일 scoped Ruff PASS. 신규 verifier와 수정 router/presentation scoped Pyright0 errors/0 warnings. git diff --check PASS.
- 실제 모델/Yahoo/SEC 호출0, DB 변경0. 브라우저·Storybook 실행은 사용자 명시 예외로 SKIP. 외부 모델 자연어 추출 성공을 fixture PASS로 주장하지 않는다.

적용 스킬: ../../.agentic-playbook-rc/apb-bruno-api-tests/SKILL.md의 기존 collection/numbered folder/assert+tests/실제 HTTP 원칙. DB 작업이 없어 PG 자원/스킬 적용은 없다.

## VAL-CLEANUP-001

소유 Python fixture PID10369(초기)/11559(최종), Next PGID10370를 기록하고 TERM 종료했다. 최종 두 process group 잔존 없음,3981/3194 listener 없음 확인. .next-sec-financial-6y6ol5t3만 삭제하고 next-env/tsconfig의 해당 dist 참조만 baseline으로 복원했다. 사용자 서비스·공유 MCP·브라우저는 건드리지 않았다. 로그/결과는 임시 경로에 보존하며 커밋 대상이 아니다. human-docs는 읽기 전용, 기존 flow는 변경하지 않았다.

## 영향받는 stock

- docs/stock/sec-chat.md: SEC-FIN-BASIS-002 현재 보호 범위/제약.
- docs/INDEX.md: 본 기록 링크.
