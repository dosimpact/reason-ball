# Flow Spec JSON 트리와 탐색

상태: 구현 기준. 필드·검증·탐색 계약은 채택했으며 추가 편집은 [10](10-completion.md)을 따른다.

## 원본과 표현

Flow Spec의 원본은 구조화된 JSON 트리입니다. `->`, `(+)`, 들여쓰기 문법은
트리를 가져오거나 내보내는 텍스트 표현입니다. 텍스트와 트리를 각각 수정 가능한
원본으로 저장하지 않습니다. 기존 문자열 원본 제안은 이 설계로 대체합니다.

프로젝트 ID, 문서 ID, 제목, 문서 타입 등은 공통 Document에 두고,
아래 JSON은 해당 문서의 `content`입니다. 문서 타입 ID는 `flow-spec-overview` 또는
`flow-spec-detail`을 사용하며 공통 내용의 `format: flow-spec`과 구분합니다.
두 타입의 차이는 문서 목적에 있고 동일한 노드 구조와 탐색 전략을 사용합니다.

## JSON 예시

구글 광고 연동 기능을 가정한 예시이며 실제 Google Ads API 계약이 아닙니다.

```json
{
  "format": "flow-spec",
  "schemaVersion": 1,
  "layers": [
    {
      "id": "layer-upstream",
      "kind": "layer",
      "layerType": "upstream-api",
      "children": [
        {
          "id": "step-fetch-recommendations",
          "kind": "step",
          "label": "Google Ads 연동 서비스: getCampaignBudgetRecommendations()",
          "children": []
        }
      ]
    },
    {
      "id": "layer-bff",
      "kind": "layer",
      "layerType": "bff-endpoint",
      "children": [
        {
          "id": "step-budget-endpoint",
          "kind": "step",
          "label": "POST /google-ads/recommendations/campaign-budgets",
          "children": [
            {
              "id": "step-rank-recommendations",
              "kind": "step",
              "label": "campaignBudgetRecommendationService.rankRecommendations()",
              "children": []
            },
            {
              "id": "note-ranking-rule",
              "kind": "note",
              "label": "캠페인 편집에서는 검색 캠페인 예산 증액 추천을 우선 표시",
              "children": []
            }
          ]
        }
      ]
    },
    {
      "id": "layer-frontend",
      "kind": "layer",
      "layerType": "frontend-biz-logic",
      "children": [
        {
          "id": "step-budget-hook",
          "kind": "step",
          "label": "useGoogleAdsBudgetRecommendation()",
          "children": []
        }
      ]
    }
  ]
}
```

## 모델 제약

- 문서는 세 layer를 `upstream-api`, `bff-endpoint`, `frontend-biz-logic` 순서로 각각 한 번 갖습니다.
- layer 제목은 layerType에서 도출합니다. 별도 label을 저장하지 않아 제목과 타입이 어긋나지 않게 합니다.
- layer의 자식은 step, step의 자식은 step 또는 note이며 note는 항상 말단입니다.
- children 배열의 순서가 표시 순서입니다. 부모 ID, depth, sibling order는 중복 저장하지 않고 탐색 시 계산합니다.
- step과 note의 label은 비어 있지 않은 한 줄 일반 텍스트입니다. 줄바꿈과 앞뒤 공백은 허용하지 않습니다.
- id는 문서 내에서 모든 노드에 걸쳐 고유하고 비어 있지 않은 문자열입니다. 타입·라벨·배열 위치와 독립적입니다.
- 노드를 수정·이동할 때 ID를 유지하고 복사·새 생성 시 새 ID를 부여합니다. 삭제된 ID를 다른 노드에 재사용하지 않습니다.
- ID 생성은 외부 경계에서 수행합니다. 순수 트리 함수에는 생성된 ID를 전달합니다.
- 임의 필드와 미지원 schemaVersion을 거부합니다. 향후 확장은 버전별 스키마로 정의합니다.
- 최대 원문 크기·노드 수·깊이를 제한하고 초과 시 거부합니다. 실제 제한 수치는 [09](../tech-shared/planner-mcp/implementation.md)를 따릅니다.
- JSON에 순환 참조는 표현할 수 없지만, 런타임 객체 입력 검증에서는 순환·동일 객체 중복 참조도 거부합니다.
- 이 트리의 부모·자식은 구조적 포함 관계입니다. 계층 간 호출 연결을 암묵적 트리 간선으로 해석하지 않습니다.

## 탐색 전략

N은 전체 노드 수, V는 현재 표시할 노드 수, H는 트리 높이입니다.

| 작업                  | 전략                                | 비용 및 목적                                         |
| --------------------- | ----------------------------------- | ---------------------------------------------------- |
| 전체 검증·텍스트 출력 | 반복형 전위 DFS                     | O(N); 부모를 먼저 보고 children 순서 유지            |
| 인덱스 생성           | DFS 한 번으로 Map 생성              | O(N) 시간·메모리; 노드와 부모 관계를 함께 수집       |
| ID로 노드 조회        | `byId.get(id)`                      | 평균 O(1); 매번 전체 DFS하지 않음                    |
| 조상 경로 찾기        | parentById를 따라 루트로 이동       | O(H); 검색 결과의 부모를 펼칠 때 사용                |
| 화면 표시 목록        | 접힌 노드의 자식을 건너뛰는 DFS     | O(V); `{ id, depth, kind, label, hasChildren }` 생성 |
| 내용 검색             | 접힘과 무관한 전체 DFS              | O(N); 숨겨진 노드도 검색                             |
| 전체 접기             | 전체 노드 중 자식 있는 노드 ID 수집 | O(N); 전체 펼치기는 접힘 Set을 비움                  |

DFS는 스택에 자식을 역순으로 넣어 꺼낼 때 원래 배열 순서를 유지합니다.
반복형 탐색과 깊이 제한으로 깊은 입력의 호출 스택 초과를 방지합니다.
순회 스택은 최악 O(N), 인덱스와 표시 목록도 각 크기에 비례한 메모리를 사용합니다.
현재 화면은 전위 순서가 필요하므로 BFS는 기본 전략으로 사용하지 않습니다.

### 파생 인덱스

- `byId: Map<NodeId, Node>`
- `parentById: Map<NodeId, NodeId | null>` — layer의 부모는 null.
- `locationById: Map<NodeId, { parentId, index }>` — 부모 배열 내 위치. layer는 layers 배열 내 위치.
- 위 인덱스는 메모리 파생 데이터이며 JSON 파일에 중복 저장하지 않습니다.
- 유효성 검사에 성공한 트리만 게시합니다. 새 문서 스냅샷을 받으면 트리와 인덱스를 함께 교체합니다.
- 변경마다 O(N) 재검증·인덱스 재생성을 수행합니다. 증분 인덱싱은 현재 필요하지 않은 최적화 후보입니다.

### 편집과 탐색의 연결

- 노드 편집은 안정적인 ID를 대상으로 하며 입력 트리를 변경하지 않고 새 트리를 반환합니다.
- 이동 시 대상 부모에서 조상 경로를 따라 이동 노드가 있는지 확인해 자기 자신·자손 아래 이동을 거부합니다.
- 부모 종류 제약도 재검증합니다. O(1) ID 조회가 전체 트리 갱신도 O(1)임을 의미하지는 않습니다.
- MCP `edit_flow_node`와 UI가 같은 편집·저장 경계를 사용합니다. 충돌·재시도·ID 재사용 검사는 [10](10-completion.md)을 따릅니다.

## 접힘 상태와 SSE

- `collapsedIds: Set<NodeId>`는 문서 ID별 UI 상태이며 저장 JSON에 포함하지 않습니다.
- 워크스페이스가 문서별 상태를 소유해 문서·탭 이동에도 보존합니다. 역사 버전은 별도 상태를 사용하고 페이지 새로고침 시 초기화합니다.
- 최초 조회는 모두 펼칩니다. 자식이 있는 layer/step만 토글합니다.
- 새 JSON을 받으면 검증하고 인덱스를 재생성합니다. 기존 접힘 ID 중 새 트리에 존재하고 자식도 있는 ID만 유지합니다.
- 새 노드는 기본 펼침, 삭제 노드는 접힘 Set에서 제거합니다. 라벨 변경·순서 변경은 ID가 같으면 상태를 유지합니다.
- 검색 결과 선택 시 parentById로 조상들을 찾아 펼친 뒤 대상 노드로 이동합니다.
- 외부 편집 결과가 잘못되면 오류를 표시하고 마지막 정상 트리를 유지할 수 있습니다. 이때 최신 데이터가 아님을 표시합니다.

## 텍스트 가져오기·내보내기

- parseFlowSpec(text)는 ID 없는 구문 트리와 줄 위치 진단을 만드는 순수함수입니다.
- 가져오기 경계에서 ID를 부여해 JSON 모델로 변환하고 구조를 검증한 뒤 저장합니다.
- serializeFlowSpec(tree)는 정규화된 텍스트를 생성합니다. UI는 이를 텍스트 보기로 제공합니다.
- v1 텍스트에는 ID가 없으므로 전체 재가져오기는 새 ID를 만듭니다. 텍스트나 배열 위치로 기존 ID를 추측해 매칭하지 않습니다.
- 따라서 전체 재가져오기 시 접힘 상태가 초기화됩니다. 직접 JSON 수정 시에는 기존 ID를 유지해야 합니다.
- 텍스트 왕복은 kind·label·순서·부모 관계를 보존합니다. ID와 원래 공백·빈 줄은 보존 대상이 아닙니다.
- JSON 오류는 JSON 경로·노드 ID를, 텍스트 파싱 오류는 줄·열 번호를 제공합니다.

## 검증 기준

- JSON 예시가 스키마 제약을 만족하고 각 노드 ID가 한 번씩 등장합니다.
- DFS 결과의 형제 순서, 부모 Map, 표시 depth가 중첩 JSON과 일치합니다.
- 부모 접기 시 하위 노드가 표시 목록에서 제외되고 전체 검색에는 포함됩니다.
- 삭제·이동·라벨 변경·SSE 갱신 후 인덱스와 접힘 상태가 정의된 정책을 따릅니다.
- 중복 ID, 잘못된 부모, note의 자식, 중복/누락 layer, 미지원 버전, 크기·깊이 제한 초과를 거부합니다.
- 텍스트 출력 후 재파싱한 구조가 원본과 ID를 제외하고 동등합니다.
