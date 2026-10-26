# OpenUI vs A2UI — FE 도입 검토

검토일: 2026-10-18 · 대상: Chat + Canvas 기반 웹 대시보드

## 결론

**현재 요구에는 OpenUI를 권장한다.** UI 생성뿐 아니라 데이터 조회, 반응형 상태, 액션 실행 기능을 함께 제공하여 대시보드 구현 부담을 줄인다. LangChain·LangGraph는 선택 사항이다.

A2UI도 같은 UX를 구현할 수 있다. 다만 서로 다른 에이전트·렌더러 간 공통 프로토콜이 핵심 요구일 때 선택 이유가 더 크다. **둘 다 완성된 대시보드나 Canvas 제품은 아니다.**

## 기본 동작과 차이

두 방식 모두 모델이 UI를 선언하고, 클라이언트가 등록된 컴포넌트로 렌더링한다. 모델이 만든 임의의 JavaScript를 실행하는 방식은 아니다.

| 항목 | OpenUI | A2UI |
|---|---|---|
| 성격 | UI 언어 + 렌더링·실행 라이브러리 | UI 교환 프로토콜 + 렌더러 구현 |
| UI 표현 | OpenUI Lang: 컴포넌트 호출과 변수 참조 | JSON: surface·component ID와 속성 |
| 부분 수정 | 같은 statement ID를 `mergeStatements`로 병합 | 같은 component ID를 `updateComponents`로 갱신 |
| 로컬 상태 | `$변수`, 폼 바인딩, 반응형 계산 | 데이터 모델과 경로 바인딩 |
| 조회·저장 | `Query`·`Mutation`과 `toolProvider` | 앱/렌더러에 데이터 조회·실행 로직 연결 |
| 이벤트·확장 | `@Run`, `@Set`, 도구·컴포넌트 등록 | 서버 이벤트, 클라이언트 함수·커스텀 카탈로그 |
| 데이터 시각화 | 기본 차트·테이블 컴포넌트 활용 | 선택한 카탈로그·렌더러의 지원 범위에 따름 |
| Canvas UX | 호스트 앱에서 구현 | 호스트 앱에서 구현 |

A2UI v0.9에도 클라이언트 함수 확장이 있다. 차이는 확장 가능 여부보다 **조회·재조회·결과 반영 규칙을 얼마나 기본 제공하는가**에 있다.

## OpenUI에서 FE가 구현하는 흐름

```text
모델 → OpenUI Lang → Renderer → 등록한 React 컴포넌트
                         ↓
                   toolProvider → fetch → 업무 API
```

```text
sales = Query("get_sales", {days: $days}, {rows: []})
refresh = Button("새로고침", @Run(sales))
```

- `Query`: 등록된 도구를 호출하고 결과를 UI에 반영한다. `$days`가 바뀌면 재조회한다.
- `@Run(sales)`: 런타임이 해당 조회를 다시 실행한다. 실제 `fetch`는 개발자가 `toolProvider`에 구현한다.
- `Mutation`: 저장·수정 요청을 선언하고 `@Run`으로 실행한다.
- 폼 입력·조회·새로고침마다 LLM을 호출할 필요는 없다. 에이전트에게 전달할 액션은 별도로 연결한다.
- API 인증·권한·인자 검증은 서버가 담당한다.

## 별도로 개발할 앱 레이어

Chat 메시지 목록과 Canvas의 현재 문서를 분리해서 관리한다. Canvas에는 최소한 `id`, `program`, `revision`, `formState`를 저장한다.

- **UI 구조 변경:** 모델이 만든 패치를 현재 프로그램에 병합한다. OpenUI의 statement ID는 DOM ID가 아니다.
- **데이터 변경:** Query 결과와 상태를 갱신한다. 숫자만 바뀔 때 UI를 다시 생성할 필요는 없다.
- **제품 기능:** 저장·복원, 버전 충돌 처리, 패널 고정·드래그 배치, 권한은 직접 구현한다.

깜빡임은 라이브러리 선택만으로 해결되지 않는다. Renderer를 매번 재마운트하지 않고 ID를 유지하며, 완료된 패치를 병합하는 방식으로 시작한다. 실제 입력값·포커스 유지 여부는 PoC에서 확인해야 한다.

## 전환 비용과 검증 범위

OpenUI ↔ A2UI 전환은 렌더러 교체만으로 끝나지 않는다. 생성 프롬프트, UI 스키마, 상태·액션 연결, 저장된 UI 문서를 옮겨야 한다. 특히 OpenUI의 Query 실행 규칙에 의존할수록 이전 작업이 늘어난다.

**업무 API·대시보드 저장·버전 관리는 앱이 소유하고, 라이브러리 연결부를 분리한다.** 처음부터 범용 UI 중간 언어를 새로 만들 필요는 없다.

앞선 논의의 전환 추정은 숙련 개발자 1명, 컴포넌트 15~20개·주요 흐름 5개 기준 약 **14~29인일**이다. 실측 견적이 아니며 저장 데이터와 커스텀 기능에 따라 달라진다.

이번 판단은 문서·소스 검토 기반이다. 운영 안정성, 성능, 깜빡임을 실서비스에서 검증한 결과는 아니다. 인기도·성숙도는 별도 정량 비교하지 않았으며, OpenUI 자체 벤치마크만으로 우위를 단정하지 않는다.

**다음 단계:** 필터 → API 조회 → 차트 갱신 → 특정 패널 수정 → 저장·복원까지 이어지는 작은 OpenUI PoC로 결정의 적합성을 확인한다.

## 참고

- [OpenUI 저장소](https://github.com/thesysdev/openui)
- [OpenUI 비교 문서 — 공급사 관점](https://www.openui.com/docs/openui-lang/comparison)
- [OpenUI Query·Mutation 문서](openui/docs/content/docs/openui-lang/queries-mutations.mdx)
- [A2UI 저장소](https://github.com/a2ui-project/a2ui)
- [A2UI 액션·클라이언트 함수](https://a2ui.org/concepts/actions/)
