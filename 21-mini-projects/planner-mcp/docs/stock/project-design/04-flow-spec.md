# Flow Spec

상태: 구현 기준. v1 문법·공통 트리는 채택했으며 추가 관계·편집은 [10](10-completion.md)을 따른다.

## 목적 (REQ-014)

코드 흐름에서 중요한 처리 단계와 호출 경로를 들여쓰기로 표현하는 문서입니다.
Flow Spec Overview와 Flow Spec Detail을 별도 카탈로그 문서 타입으로 관리합니다.

실행 코드의 전체 내용을 옮길 필요는 없습니다. 설계 판단에 필요한 주요 단계를
선택하고 단계 간 순서, 조건 및 포함 관계를 드러냅니다.

다른 문서와 동일하게 프로젝트에 소속되며 AI가 MCP로 작성·수정하고 UI가 변경을 실시간으로 반영합니다.

## Overview와 Detail

| 타입               | 목적                                              | 내용                                             |
| ------------------ | ------------------------------------------------- | ------------------------------------------------ |
| Flow Spec Overview | 비즈니스 핵심 개념과 주요 호출 경로를 한눈에 파악 | 중요한 업무 대상·동작과 계층 간 처리 책임을 요약 |
| Flow Spec Detail   | 선택한 핵심 동작의 상세 흐름을 설명               | 동작 내부 단계·호출과 필요한 규칙을 구체화       |

- 타입 ID는 `flow-spec-overview`, `flow-spec-detail`을 사용합니다.
- 사용자가 말한 비즈니스의 '1급 객체'는 문서에서 중심적으로 다뤄야 할 업무 개념·대상·동작을 뜻합니다.
  특정 언어의 first-class value나 반드시 클래스·DB 엔티티로 구현할 대상을 뜻하지 않습니다.
- Overview는 중요도가 같은 비즈니스 책임을 중심으로 단계를 선택합니다. 구현 함수를 단순히 짧게 나열하는 방식에 한정하지 않습니다.
- 예: 구글 광고 예산 추천에서 `캠페인`, `현재 예산`, `예산 추천`, `추천 적용`을 중심에 두고 조회·판단·적용 경로를 설명합니다.
- API·함수 이름은 그 업무 책임을 구현하는 위치를 연결하는 보조 정보로 사용합니다.
- Detail에 필요한 조건·실패 처리를 기술할 수 있으나 모든 실행 분기를 엄밀히 표현하거나 실행 가능성을 보장하는 형식으로 확정하지 않습니다.
- 두 타입은 공통 JSON 트리·문법·파서·접기/펼치기 렌더러를 사용합니다. 깊이 제한만으로 타입을 구분하지 않습니다.
- scope로 같은 업무 범위를 표시할 수 있습니다. scope가 같다는 이유로 Overview와 Detail이 자동 연결되지는 않습니다.
- Detail은 `overviewDocumentId`, `overviewRevision`, 선택적 `overviewNodeId`로 Overview를 참조할 수 있습니다. 관계는 선택이며 검증·버전 고정·이동은 [10](10-completion.md)을 따릅니다.
- Overview 하나에 여러 Detail을 연결할 수 있으며 Detail 없이 Overview만 작성할 수도 있습니다.
- UI는 Overview/Detail 타입과 scope를 표시하고 문서 관계 패널에서 연결된 문서로 이동합니다.
- 핵심 업무 개념은 노드 label로 표현합니다. 별도 businessObjects 스키마는 추가하지 않습니다.

## 표현 규칙

- `[Upstream API]`, `[BFF Endpoint]`, `[Frontend Biz Logic]` 세 계층으로 구성합니다.
- `->`는 주요 API, 엔드포인트, 함수 호출, 상태 변경 및 UI 처리 경로를 표시합니다.
- `(+)`는 해당 경로의 변경점, 추가 필드 또는 핵심 비즈니스 규칙을 표시합니다.
- 들여쓰기로 엔드포인트 아래의 처리 함수와 단계에 딸린 설명을 연결합니다. 공백 두 칸 단위를 사용합니다.
- API·함수·필드 이름을 포함하고 중요한 조건은 해당 단계 아래에 짧게 서술합니다.
- 계층 나열 순서는 Upstream → BFF → Frontend입니다. 실제 시간 순서나 하나의 직렬 실행을 의미하지 않습니다.
- 같은 계층에서도 조회·적용 등 서로 다른 진입점은 구분해 읽습니다.
- 모든 저수준 코드를 나열하기보다 설계상 중요한 호출과 변경 지점을 선택합니다.
- 전용 텍스트 문법을 파싱해 트리를 만들고 UI가 렌더링합니다. 실행 언어는 아닙니다.

## Flow Spec v1 문법 (REQ-015)

Mermaid처럼 원문 → 파서 → 렌더러로 이어지는 전용 문서 형식을 정의합니다.
Flow Spec은 자체 파서를 사용하며 Mermaid 문법이나 플러그인으로 취급하지 않습니다.

| 구문                          | 노드 종류 | 허용 위치                             |
| ----------------------------- | --------- | ------------------------------------- |
| `flow-spec 1`                 | 버전 선언 | 원문의 첫 번째 줄                     |
| `[Upstream API]` 등 계층 제목 | `layer`   | 들여쓰기 없는 최상위                  |
| `-> 설명`                     | `step`    | 계층 또는 다른 step의 바로 아래       |
| `(+) 설명`                    | `note`    | step의 바로 아래; 자식 없는 말단 노드 |

- 버전 선언 뒤 세 계층을 위에서 정의한 순서로 각각 한 번 작성합니다. 비어 있는 계층은 허용합니다.
- 계층 아래 첫 노드는 공백 두 칸, 자식은 부모보다 공백 두 칸 더 들여씁니다.
- 부모는 현재 줄보다 한 단계 얕은 깊이에서 가장 가까운 이전 노드입니다.
- 빈 줄은 트리 구조에 영향을 주지 않습니다. 줄바꿈은 LF와 CRLF를 모두 허용합니다.
- 들여쓰기 증가 시 한 단계를 건너뛸 수 없고, 감소 시 현재 조상 깊이로 돌아갑니다.
- 탭 들여쓰기, 홀수 공백 들여쓰기, 알 수 없는 표식·계층, 중복 계층은 오류입니다.
- 표식 뒤에는 공백 한 칸과 비어 있지 않은 한 줄 설명이 필요합니다.
- 설명 안의 괄호·화살표·코드 기호는 일반 텍스트입니다. 행 시작의 구조 표식만 파싱합니다.
- v1에는 여러 줄 설명, 주석, 임의 HTML, 노드 간 참조 문법을 도입하지 않습니다.
- Markdown 코드 펜스는 예시 표시용이며 저장할 원문에는 포함하지 않습니다.

note는 항상 바로 위 줄에 붙는 것이 아니라 들여쓰기로 찾은 부모 step에 붙습니다.
예를 들어 컨트롤러와 서비스 호출 옆에 같은 깊이로 작성한 `(+)`는 둘을 포함하는
엔드포인트 step의 규칙입니다. note가 있는 step은 접어서 규칙도 함께 숨길 수 있습니다.

## 표현 예시

아래는 Overview 표현 예시입니다. 사용자 참고 형식을 구글 광고 캠페인 예산 추천 도메인으로 변환했습니다.
아래 API·함수·필드명은 가상 설계용이며 실제 Google Ads API 계약이 아닙니다.
광고 도메인은 표현 예시이며 Planner MCP의 제품 기능 요구사항이 아닙니다.

```text
flow-spec 1
[Upstream API]
  -> 캠페인 예산 추천 조회 — Google Ads 연동 서비스: getCampaignBudgetRecommendations(customerId, campaignIds)
    (+) 추천 유형에 SEARCH_CAMPAIGN_BUDGET_INCREASE 포함
    (+) 추천 정보에 recommendedDailyBudget / estimatedAdditionalClicks 포함
  -> 현재 캠페인 예산 조회 — Google Ads 연동 서비스: getCampaignBudgets(customerId, campaignIds)
  -> 선택한 예산 추천 적용 — Google Ads 연동 서비스: applyCampaignBudgetRecommendation(customerId, recommendationId)

[BFF Endpoint]
  -> 캠페인별 예산 추천 제공 — POST /google-ads/recommendations/campaign-budgets
    -> campaignBudgetRecommendationController.getRecommendations()
    -> campaignBudgetRecommendationService.rankRecommendations()
    (+) CAMPAIGN_EDIT에서는 검색 캠페인 예산 증액 추천을 우선 표시
  -> 선택한 예산 추천 적용 요청 — POST /google-ads/recommendations/:recommendationId/apply
    -> campaignBudgetRecommendationController.applyRecommendation()
    (+) 적용 전 최신 예산과 추천 유효성을 재확인
  -> 여러 예산 추천 일괄 적용 — POST /google-ads/recommendations/apply-batch
    -> campaignBudgetRecommendationController.applyRecommendations()
    (+) 추천별 적용 성공·실패 결과 반환

[Frontend Biz Logic]
  -> useGoogleAdsBudgetRecommendation() in Campaign Edit
  -> googleAdsRecommendationApi.getCampaignBudgets({ customerId, campaignIds, placement: CAMPAIGN_EDIT })
  -> setRecommendationType / setRecommendedDailyBudget / setEstimatedAdditionalClicks / setRawRecommendation
    (+) 추천 카드에 현재 일일 예산, 추천 일일 예산, 예상 추가 클릭 수 표시
  -> 예산 추천 UI가 hook 반환값을 표시하고 googleAdsRecommendationApi의 적용 API 호출
    (+) 이 예시의 증액 추천에서는 현재 예산 이하인 추천의 적용을 비활성화
    (+) 적용 성공 후 캠페인 예산과 추천 목록 재조회
```

## 파서와 저장 계약

### FSD feature 경계

`src/features/flow-spec-syntax/`를 독립 feature로 관리하는 것은 확정 설계 원칙입니다.
이 feature는 Flow Spec 문법의 해석·시각화·순수 노드 편집을 책임집니다. 아래는 현재 내부 파일 배치입니다.

```text
src/features/flow-spec-syntax/
  model/
    types.ts                 # JSON 트리, 구문 트리, 버전, 진단 타입
  lib/
    parse-flow-spec.ts       # 원문 → AST 또는 진단; 순수함수
    validate-tree.ts         # JSON 트리 구조와 ID 검증
    traverse-tree.ts         # DFS, 인덱스, 접힘 정리, 표시 목록, 텍스트 출력
    edit-tree.ts             # 순수 노드 추가·변경·이동·삭제
  ui/
    flow-spec-viewer.tsx     # 원문·트리 보기와 전체 접기/펼치기
    flow-spec-editor.tsx     # 노드 편집 폼; 저장은 외부 콜백
  parser.ts                  # 서버·클라이언트 공용 파서/타입 공개 진입점
  index.ts                   # UI 공개 진입점
```

- 이 feature가 소유하는 것: 문법 규칙, 파싱, 오류 진단, 트리 렌더링, 접힘 상태 처리.
- 외부에서 담당하는 것: 프로젝트·문서 조회 및 저장, 카탈로그 등록, MCP 요청 처리, SSE 구독.
- 외부 조합 계층은 JSON 트리를 viewer에 전달하고, 저장 전에는 공개 순수 로직 진입점으로 구조를 검증합니다.
- feature 내부에서 다른 문서 관리 feature를 직접 가져오지 않습니다. 필요한 값은 입력으로 전달합니다.
- 서버는 `parser.ts`를 사용하며 이 진입점은 React·DOM·UI 모듈을 가져오지 않습니다.
- UI는 같은 파서를 사용합니다. 서버 검증과 UI 표시를 위한 문법 구현을 따로 만들지 않습니다.
- 접힘 상태의 계산은 순수하게 유지하고 React 상태 연결은 UI에서 처리합니다.
- 문법 확장 시 이 feature의 규칙·파서·진단·렌더러를 함께 검토합니다.

### JSON 트리 저장과 검증

- 원본은 구조화된 JSON 트리입니다. 모델·안정적인 ID·탐색·검증의 원본은 [JSON 트리 설계](05-flow-spec-tree.md)입니다.
- 텍스트 문법은 가져오기·내보내기 표현이며 독립적인 저장 원본으로 유지하지 않습니다.
- 서버와 UI는 같은 순수 트리 검증기 및 텍스트 파서를 사용합니다. 파일·DOM·네트워크 접근은 포함하지 않습니다.
- JSON 오류는 경로와 노드 ID를, 텍스트 오류는 줄·열 번호를 제공합니다.
- v1 텍스트에는 노드 ID가 없으므로 전체 텍스트 재가져오기는 새 ID를 생성합니다.

## Collapsible UI 계약

- 자식이 있는 layer와 step에 접기·펼치기 버튼을 제공합니다.
- 접으면 해당 노드의 제목은 남고 모든 하위 step·note가 숨겨집니다. 다시 펼치면 하위 내용을 보여줍니다.
- note와 자식 없는 step에는 접기 버튼을 표시하지 않습니다.
- 전체 펼치기와 전체 접기 동작을 제공합니다. 전체 접기에서는 세 계층 제목을 남깁니다.
- 들여쓰기와 가이드선으로 계층을 표시하고 `->` 경로와 `(+)` 설명을 시각적으로 구분합니다.
- JSON 트리에서 도출한 텍스트 보기와 트리 보기를 제공합니다. 접힘 상태는 UI 상태이며 저장 JSON을 변경하지 않습니다.
- 버튼은 키보드로 조작할 수 있게 하고 펼침 상태를 `aria-expanded`로 전달합니다.
- 설명은 텍스트로 렌더링하며 HTML이나 코드를 실행하지 않습니다.
- 최초 조회는 모두 펼칩니다. SSE 갱신 후 안정적인 ID를 기준으로 접힘 상태를 유지하는 정책은 [JSON 트리 설계](05-flow-spec-tree.md)를 따릅니다.
- 노드별 편집 UI와 문서 간 링크를 제공합니다. 상세 계약은 [10](10-completion.md)을 따릅니다.
- Figma Requirements의 UI Funnel Spec은 사용자 화면 이동을, Flow Spec은 내부 처리 논리를 다룹니다.

## 검증 기준

- 카탈로그에서 Flow Spec Overview 또는 Detail을 선택해 프로젝트 문서를 생성할 수 있습니다.
- Overview는 비즈니스 핵심 대상·동작과 주요 호출 경로를 파악할 수 있어야 합니다.
- 두 타입이 같은 트리 스키마와 렌더러를 사용하면서 문서 타입과 scope를 구분해 표시합니다.
- 저장 후 조회해도 노드 ID·내용·부모 관계·형제 순서가 보존됩니다. 텍스트 출력의 들여쓰기는 정규화합니다.
- UI에서 주요 단계와 중첩 경로를 구분해 읽을 수 있습니다.
- 세 계층과 `->`, `(+)` 표기가 저장·조회와 UI 표시에서 보존됩니다.
- 같은 원문을 서버와 UI에서 파싱하면 같은 계층·노드 순서·부모 관계가 만들어집니다.
- 깊이 건너뛰기, note 아래 자식, 타입 없는 줄, 중복 계층, 미지원 버전은 줄·열 번호가 포함된 오류를 반환합니다.
- 부모를 접으면 그 아래 모든 노드가 숨겨지고 펼치면 다시 표시됩니다. 말단 노드는 접기 버튼이 없습니다.
- 전체 접기·펼치기와 키보드 조작이 가능하고 접힘 상태 변경은 저장 원문에 영향을 주지 않습니다.
- AI가 MCP로 흐름을 수정하면 열린 문서의 UI가 최신 흐름으로 갱신됩니다.
