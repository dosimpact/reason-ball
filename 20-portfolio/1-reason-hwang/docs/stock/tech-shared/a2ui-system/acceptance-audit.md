# 요구사항별 완료 감사

2026-09-21. 사용자의 OAuth 한정 검증 결정에 따라 현재 코드·실행 기록을 대조한다. 세부 결과와 기록 링크는 [운영과 검증](operations-and-validation.md)에 있다.

| 요구사항 | 구현/실행 증거 | 판정 |
| --- | --- | --- |
| feature/a2ui-demo 브랜치 | 현재 git branch 확인 | 충족 |
| A2UI-REG-001 / UI-01 |61파일/66어댑터 check 및 전체 어댑터 stories | 충족 증거 있음 |
| A2UI-CAT-001 / CAT-01 |4카탈로그 생성물 drift 검사, wheel25파일 동일성 | 충족 증거 있음 |
| A2UI-VER-001 / VER-01 |v0.9/manifest 고정, 다른 hash422, 계약 수용·거절 테스트 | 충족 증거 있음 |
| A2UI-DYN-001 / DYN-01 |6종 실모델 질문 및 facts 검증 | OAuth 범위 충족 |
| A2UI-FIX-001 / FIX-01 |고정 flight schema와 실제 도구 호출/선택 | OAuth 범위 충족 |
| A2UI-ACT-001 / BIND-01 / ACT-01 |입력 바인딩 stories, 반복 지역 조회, 항공편 선택 | 충족 증거 있음 |
| A2UI-STATE-001 / STATE-01 / CANCEL-01 |gate/격리 검사, Dynamic·SEC 취소 재시도, 오류 UI | action 취소 보정 후 HTTP 회귀 PASS |
| A2UI-MODEL-001 / MODEL-01 |OAuth 실증, API-key 설정 검사 | OAuth 범위 충족; API-key 실모델은 범위 밖 |
| A2UI-CATALOG-EDIT-001 |JSON 변경·오류 보존·초기화·모바일 브라우저 및 story | 충족 증거 있음 |
| A2UI-PROGRESS-001 |실제 CUSTOM 진행, 취소/오류/완료 브라우저 | 충족 증거 있음 |
| SEC-A2UI-01 |실제 회사 검색·빈 결과·페이지 이동 | 충족 증거 있음 |
| SEC-A2UI-02 |CIK 강제, 공시 필터·페이지·원본/수정본 관계 | 충족 증거 있음 |
| SEC-A2UI-03 |선택 공시 ID로 원문 재조회, 실제 보고서 | 충족 증거 있음 |
| SEC-A2UI-04 |정확 인용 검증, 범위·한계·24,000자·조회 시각 표시 | 충족 증거 있음 |
| SEC-A2UI-05 |빈 원문/client 오류 단위 검사, API503/모델 장애 graph복구, 미저장/취소/통신/SSE 오류 브라우저 | 계층별 증거 있음; 실제 상위 장애 전체 경로 증거는 없음 |
| SEC-A2UI-06 |stale/cross-thread422, 회사/공시 변경 시 초기화 | 충족 증거 있음 |
| SEC-A2UI-07 |SEC manifest/stories/실제 Bruno/브라우저 | action 취소 보정 후 HTTP 회귀 PASS |
| A2UI-VAL-001 |143 Python,69계약,75story, build/typecheck 등 | OAuth 범위 충족 |
| 기술 문서 통합 |전용 INDEX와8개 기술문서, 링크 검사 | 충족 |
| 검증 후 commit |최종 검토 후 A2UI 변경만 커밋 | 무관한 사용자 문서 제외 |

## 검증 범위와 제한

1. action 요청 messages 정리 이후 Dynamic/Fixed/SEC Bruno HTTP 회귀는 순차 재실행하여 모두 통과했다.
2. 사용자 “지금 OAuth만 검증” 결정으로 API-key 실모델 실행은 현재 완료 조건에서 제외한다. 구현 지원과 실증 완료는 구분한다.
3. 전체 lint는 변경 없는18파일의48오류로 실패한다. 변경 범위 lint/typecheck PASS와 구분해 최종 보고한다. 무관한 파일을 자동 수정하지 않는다.
4. 기존 사용자 변경을 보존하면서 최종 diff/문서/검증 증거를 확인하고 작업 범위만 commit한다.

이 표의 ‘충족 증거 있음’은 적힌 범위만 뜻한다. 외부 서비스의 모든 가능한 장애를 검증했다는 뜻이 아니며, API-key 실모델 검증은 사용자 범위 변경에 의해 제외되었다.

범위 변경 근거: [OAuth 검증 범위 및 완료 기록](../../../flow/2026-09-21-a2ui-oauth-scope-and-completion.md).
