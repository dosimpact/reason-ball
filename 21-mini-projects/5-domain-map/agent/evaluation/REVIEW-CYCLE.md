# 서브에이전트 평가·개선 — 2026-10-06

## 범위와 절차

사용자 요청에 따라 독립 평가자 3명을 사용했다. 평가자는 제품 코드를 수정하지 않았고, 메인이 재현·수정·회귀 테스트를 적용한 뒤 같은 평가자에게 재평가를 요청했다. 실제 기업 데이터·외부 서비스는 사용하지 않았다.

| 평가자 | 방법 | 최초 관찰 |
| --- | --- | --- |
| workflow_review | 지침·계약 검토, 검증기 최소 재현 | clean→dirty 갱신 차단, unchanged 완료 조건 모순, 도메인 소속 표현 부족 |
| cli_review | 독립 임시 저장소의 실제 CLI 호출 | clean→dirty 갱신 차단, 빈 path+URL로 등록 불가능한 세션 생성 |
| behavior_eval | 임시 Git 저장소 2개의 bootstrap→continue→deepen | 47회 CLI 호출 성공, 0회 실패, v1→v3/doctor PASS. 예산·반환 계약 보완 권고 |

## 발견과 조치

| ID | 중요도 | 발견·재현 | 개선 | 재평가 |
| --- | --- | --- | --- | --- |
| REV-01 | 높음: 정상 refresh 차단 | clean revision-only 근거를 유지하면 현재 dirty hash 검사 실패; 과거에 hash를 추가하면 immutable 실패 | 직전 모델을 기준으로 과거/신규 근거 구분. put/doctor/독립 validate 경로 일치 | 두 검토자 해결 확인. clean→dirty→clean, 신규 hash 누락/과거 변조 거부 PASS |
| REV-02 | 중간 | path=""와 URL을 함께 넣으면 세션 생성은 성공하지만 모델 source 대조 실패 | 정확히 한 source 필드만 허용, 빈/null/잘못된 타입 거부 | CLI 평가자 독립 재현 PASS, URL-only 정상 |
| REV-03 | 낮음 | 변경 없음에도 사용 사례가 새 버전을 요구 | unchanged 보고서·체크포인트로 완료, 기존 버전 유지 | 워크플로 평가자 해결 확인, CLI 회귀 PASS |
| REV-04 | 개선 | inventory와 본문 조사 예산 경계 및 이력 집계 불명확 | 레포/파일/줄/검색 집계 규칙, scope 소비량 및 불변 artifact 기록 | 행동 재평가 PASS: 3개 배치의 읽기 범위·소비량 artifact와 최신 체크포인트 확인 |
| REV-05 | 개선 | audit 최소 형식, 결과 증분/누적 여부, 단독 역할 반환 계약 발견성 부족 | 각 역할에서 handoff 연결, baseModelVersion/outputMode, audit 형식·병합 책임 | 행동 재평가 PASS: 6개 작업의 반환·병합 계약과 audit 참조 확인 |
| REV-06 | 개선 | repoIds 중첩만으로 시스템의 도메인 소속을 결정할 수 없음 | 근거 있는 system→domain supports, 미확인은 가설/질문 | 워크플로 평가자 문서 일치 확인 |
| REV-07 | 낮음 | hash는 임의 문자열, 일부 배열 원소는 비문자열도 허용 | SHA-256 형식과 문자열 원소 검사 | placeholder hash/질문 원소 회귀 PASS |

REV-01의 우선순위는 workflow 평가자 P1, CLI 평가자 P2로 달랐다. 실제 증분 조사 차단이라는 동일 재현을 기준으로 우선 수정했다. 나머지 개선 권고는 기능 실패와 구분했다.

## 검증 결과와 한계

- 전체 회귀 테스트: `pnpm -C agent test` **14/14 PASS**.
- 코드 구문·문서 링크·스킬 링크: `pnpm -C agent check` PASS.
- 역할 스킬 6개: skill-creator quick_validate PASS.
- 독립 CLI/워크플로 재평가: 원 지적 해결, 검토한 흐름에서 새로운 확정적 P1/P2 미발견.
- [최초 행동 평가 요약](review-cycle/initial-behavior.json): orders 본문만 조사한 partial에서 시작해 payments를 이어 조사하고, amount_minor/amount_cents의 문서·코드 충돌을 disputed로 보존했다. 배포/변환 계층은 미확인 질문으로 유지했다.
- [개선 후 행동 재평가](review-cycle/recheck-behavior.json): 새 임시 저장소에서 CLI **56회 성공 / 실패 0**, 모델 **v1→v2→v3**, doctor healthy=true. 같은 시나리오에서 개선된 반환 계약·audit 형식·예산 집계와 `--previous` 사전 검증을 실제 사용했다.
- 배치 소비량(레포/파일/줄/파일명검색): bootstrap **1/2/5/0**, continue **1/1/3/0**, deepen **1/1/5/0**. 전체 inventory는 2개 레포에 수행했다. 세 배치 보고서를 등록하여 이전 소비량도 보존했다.
- system→domain 소속 근거가 없는 부분은 `q-membership` 질문으로 남기고 supports를 임의 생성하지 않았다. 업무 영역 가설과 운영 여부 미확인을 유지했다.

판정: 발견→재현→개선→독립 재평가 사이클을 완료했다. 검토한 CLI/합성 조사 흐름에서 남은 차단 결함은 발견하지 못했다. 예산 자동 계측과 역할 payload의 의미 검증은 여전히 에이전트 책임이며 CLI가 자동 보증하지 않는다.

합성 자료 평가이며 실제 기업 업무 경계의 정확성, 대규모 입력의 편중, LikeC4 문법·빌드·브라우저는 검증하지 않았다. `model validate --previous`는 제공받은 사전 검증 기준이며 실제 model put의 신뢰 기준은 관리 저장소의 직전 등록 모델이다.

원시 평가 산출물 경로는 JSON에 기록했다. 해당 OS 임시 경로는 향후 삭제될 수 있으므로 핵심 결과를 이 문서와 JSON에 별도로 보존한다.
