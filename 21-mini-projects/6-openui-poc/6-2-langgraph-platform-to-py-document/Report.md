# Open UI (React) + Langgraph  



### LangGraph JS → Python: 마이그레이션 주요 라이브러리  

openui/examples/agent-frameworks 에서 JS langgraph를 사용했는데 py langgraph로 이동하면서 2가지 라이브러리 python패키지가 없어 별도로 구현해야 한다.  

| JS 라이브러리 | 원본 역할 | 현재 Python 구현 |
| --- | --- | --- |
| `@openuidev/langchain` | `openUIStreamTransformer`로 LangGraph 이벤트를 OpenUI 스트림으로 변환 | `OpenUIStreamTransformer`로 직접 구현 |
| `@openuidev/lang-core` | `generateSystemPrompt()`로 컴포넌트 명세를 시스템 프롬프트로 변환 | 컴포넌트 카탈로그 SSOT는 FE에 있고, FE에서 Autogen으로 생성한 system-prompt.txt`를 읽어 사용 |
| `deepagents` | `createDeepAgent()`로 모델·도구·프롬프트를 결합한 에이전트 그래프 생성 | Python `deepagents` 패키지의 `create_deep_agent()` 사용 |

*deepagents 패키지란?  
-  LangChain·LangGraph 기반 deepagents는 LLM이 도구를 사용하며 여러 단계의 작업을 수행하도록 에이전트를 구성해 주는 라이브러리   
- https://github.com/langchain-ai/deepagents  
- create_react_agent와의 차이점 (langchain.agents.create_agent ) - 파일, 컨텍스트 관리, 서브에이전트 위임 별도 구성이 필요없다. deepagents가 상위호환.
- *js, py 모두 LangChain 팀에서 관리하는 공식 에이전트 프레임워크   

### About langgraph system prompt

`backend-langgraph/agent/system-prompt.txt`는 JS `@openuidev/lang-core`의 `generateSystemPrompt()` 결과를 정적으로 추출한 것으로, LLM이 **선언형 UI 언어(`openui-lang`)로만 응답하도록 강제하는 프롬프트**이다.

### 1. 역할 및 제약
- **순수 UI 코드 강제**: 일반 텍스트나 마크다운 설명 없이 전체 출력이 100% 유효한 `openui-lang`이어야 함.
- **위치 기반 인자 (Positional Arguments)**: 키워드 인자(`key: value`)는 파싱을 깨뜨리므로 철저히 위치 기반 인자만 허용.
- **루트 도달성**: 진입점은 항상 `root = Stack(...)`이며, `root`에서 참조되지 않는 변수는 렌더링에서 자동 탈락.

### 2. 스트리밍 최적화 (Shell-First & Hoisting)
- **호이스팅(Hoisting) 전제**: 참조를 정의보다 먼저 사용할 수 있도록 파서가 지원.
- **점진적 렌더링 순서**: 
  1. `root = Stack(...)` (최상단 배치로 UI 골격을 즉시 렌더링)
  2. 컴포넌트 레이아웃 정의
  3. 리프 데이터 값 (스트리밍되면서 점진적으로 데이터 주입)

### 3. 컴포넌트 & 상태/액션 규칙
- **열 지향 테이블**: `Table`은 행(Row) 단위가 아닌 `Col` 단위의 열 중심 배열 구조 사용 (차트와의 데이터 연동 용이).
- **폼(Form) 규칙**: Form 중첩 금지, 스트리밍 지연 방지를 위해 각 `FormControl`을 개별 변수로 분리, 명시적 `Buttons` 필수.
- **반응형 상태 & 액션**: `$variable` 양방향 바인딩, 컬렉션 연산(`@Filter`, `@Sort`, `@Count`), 이벤트 트리거(`@ToAssistant`, `@OpenUrl`) 지원.
- **카드 전용 인라인 요소 제약**: `Text`, `BoldText`, `IconText`, `MetricIndicatorInline` 등은 카드 블록 내부에서만 사용 가능 (루트 직접 배치 불가).
## 2026-10-18 재검토 결과

판정: 현재 Chat Completions + mock 도구 범위의 주요 경로는 원본과 대응한다. 패키지 전체 동등성이나 실제 provider/browser 통합을 이번 검토로 보장하지는 않는다.

- 설치된 원본 JS 변환기와 Python 변환기에 각 언어의 입력 형식(JS 객체, Python 이벤트/metadata 튜플)을 적용하여 비교했다. 텍스트, 도구 인자 snapshot 및 결과, 도구 오류, 사용자 메시지 제외의 4개 시나리오는 출력이 일치했다.
- 원본 spec와 promptOptions로 생성한 프롬프트는 Python 자산과 끝 줄바꿈 하나만 달랐다(36,113자 / 36,114자).
- 원본 설치 패키지의 `generateSystemPrompt()`는 전달한 `instructions`를 반영하지 않았다. Python은 기본 프롬프트 뒤에 에이전트 지시문과 mock 데이터 고지를 명시적으로 추가한다. 따라서 최종 프롬프트 전체가 동일한 것은 아니다.
- 차이: 빈 텍스트 블록에 대해 JS는 START/END를 내보내지만 Python은 생략한다. 도구 출력 조각(`tool-output-delta`)만 있고 최종 output이 없는 경우 JS는 누적 문자열, Python은 빈 문자열을 반환한다. 현재 mock 도구는 완성된 문자열을 반환하므로 후자 경로를 사용하지 않는다.
- 코드 대조: provider/서버 실행 도구 결과 처리는 Python에서 제외되어 있다. 현재 `use_responses_api=False`이고 해당 도구를 설정하지 않아 현재 범위에는 필요하지 않다.
- `uv run python -m pytest`: 13개 통과. `uv run python -m ruff check agent tests`: 통과.
- 환경 문제: `uv run pytest` 실행 파일의 shebang에 이동 전 프로젝트 경로가 남아 실패했다. 이번 검토는 Python 모듈 실행으로 우회했으며 환경 재생성은 수행하지 않았다.
- 실제 OpenAI 호출과 브라우저 검증은 이번에 수행하지 않았다. 구현 코드는 수정하지 않았다.

검증 기록: [재검토 기록](docs/flow/2026-10-18-openui-port-recheck.md).

### UI 컴포넌트 카탈로그와 langgraph system prompt sync방법

LLM이 생성할 OpenUI 컴포넌트를 추가하거나 이름·인자·사용 규칙을 변경하면, 프런트엔드 렌더링 카탈로그와 백엔드 시스템 프롬프트를 함께 갱신해야 한다. 일반적인 화면 내부 React 컴포넌트 변경은 그 자체로 동기화 대상이 아니다.

#### 현재 방식: 생성 후 명시적으로 복사

1. 새 컴포넌트 구현과 명세를 OpenUI 라이브러리에 등록하고, 실제 렌더러와 `frontend/src/library.ts`의 생성용 export가 같은 카탈로그를 사용하도록 맞춘다. 현재 생성 진입점은 기본 `@openuidev/react-ui/genui-lib`를 재노출하므로, 컴포넌트 파일만 추가해서는 자동 반영되지 않는다.
2. `frontend`에서 프롬프트를 생성하고 백엔드 자산으로 복사한다.

   ```bash
   # 6-langgraph-platform-to-py/frontend에서 실행
   npm run generate
   cp src/generated/system-prompt.txt ../backend-langgraph/agent/system-prompt.txt
   cmp src/generated/system-prompt.txt ../backend-langgraph/agent/system-prompt.txt
   ```

3. 변경된 프롬프트에 새 컴포넌트의 이름·인자·규칙이 포함됐는지 확인한다. `agent/graph.py`에서 붙이는 에이전트 지시문은 별도로 유지한다.
4. 백엔드를 재시작하거나 재배포한다. 프롬프트는 그래프를 로드할 때 읽으므로 실행 중 파일 교체만으로 반영된다고 가정하지 않는다. 프런트엔드도 변경된 카탈로그로 배포한다.
5. 두 서버가 실행된 상태에서 `frontend`의 `npm run test:smoke`로 기존 통합 경로를 확인하고, 새 컴포넌트를 요청하는 시나리오를 추가해 실제 브라우저 렌더링까지 검증한다. 기존 smoke 테스트만으로 새 컴포넌트 지원을 증명할 수는 없다.

이 복사는 개발·배포 준비 단계의 자산 갱신이다. 백엔드 실행 시 프런트엔드 파일을 읽거나 Node.js를 실행하지 않는다. 현재 생성과 복사는 자동으로 연결되어 있지 않으므로 복사를 빠뜨리면 모델의 컴포넌트 명세가 오래된 상태로 남는다.

#### 개선안: 갱신 자동화와 CI 검사 (미구현)

- 생성과 백엔드 자산 복사를 하나의 명시적인 갱신 명령으로 묶는다.
- CI에서 카탈로그로 프롬프트를 재생성한 뒤, 커밋된 백엔드 자산과 비교하여 불일치 시 실패시킨다. 검사 단계에서는 백엔드 파일을 먼저 덮어쓰지 않아야 갱신 누락을 발견할 수 있다.
- 카탈로그/프롬프트 변경과 새 컴포넌트 렌더링 검증을 함께 리뷰하고, 서로 호환되는 프런트엔드와 백엔드를 배포한다.

정적 프롬프트 방식 자체는 유지할 수 있다. 핵심은 카탈로그 변경 시 재생성·반영·검증을 빠뜨리지 않는 것이다. 현재 설계 근거는 [시스템 설계 PY-008](docs/stock/system.md#py-008-openui-프롬프트-자산)이다.


### '데이터 조작 내장 함수: @Filter, @Sort, @Count, @Each 등' 확장 기능이 있는가 ? 

**있다. `defineFunction()`으로 사용자 정의 함수를 만들고 라이브러리에 등록하면, OpenUI Lang에서 `@함수명(...)`으로 호출할 수 있다.** 내장 함수 자체를 수정할 필요는 없다.

2026-10-18 기준 본진 `openui/packages/lang-core/src/functions.ts`, `library.ts`, `runtime/evaluator.ts`와 현재 프런트엔드의 설치 패키지 export를 확인했다. 아래 코드는 설명용이며, 이 프로젝트에 새 함수를 구현하거나 실행 검증한 것은 아니다.

#### 정의와 등록

```ts
import { defineFunction } from "@openuidev/react-lang";
import { openuiLibrary, openuiPromptOptions } from "@openuidev/react-ui/genui-lib";
import { z } from "zod/v4";

const DiscountPrice = defineFunction({
  name: "DiscountPrice",
  description: "가격에 할인율(0~100%)을 적용한 금액",
  params: z.object({
    price: z.number(),
    discountPercent: z.number().min(0).max(100),
  }),
  returns: z.number(),
  fn: ({ price, discountPercent }) => price * (1 - discountPercent / 100),
});

export const library = openuiLibrary.extend({
  functions: { add: [DiscountPrice] },
});
export const promptOptions = openuiPromptOptions;
```

기존 라이브러리는 `extend({ functions: { add: [...] } })`로 확장할 수 있다. 새 라이브러리를 구성할 때는 `createLibrary({ components: [...], functions: [...] })`에 등록한다. 위 예제를 실제 적용할 경우 `zod`를 프런트엔드의 직접 의존성으로 추가해야 한다. 현재 `frontend/package.json`에는 직접 선언되어 있지 않다.

OpenUI Lang에서는 다음과 같이 계산값을 정의하여 UI에서 참조할 수 있다. 아래는 전체 UI 프로그램이 아닌 계산 부분이다.

```text
$price = 10000
$discount = 20
discounted = @DiscountPrice($price, $discount)
```

`params` 객체의 키 순서가 위치 기반 인자 순서다. 위 호출은 `fn({ price: 10000, discountPercent: 20 })`로 실행되어 `8000`을 반환한다. 상태가 바뀌면 해당 상태를 참조하는 표현식이 다시 평가된다. 이 앱에서 계산은 브라우저의 OpenUI 런타임이 수행하며, 매번 LLM이나 Python 백엔드를 호출하지 않는다.

| 정의 항목 | 역할 |
| --- | --- |
| `name` | OpenUI Lang에서 호출할 함수 이름 |
| `description` | 모델에 전달할 함수 용도 |
| `params` | 입력 스키마와 인자 순서 |
| `returns` | 선택적 반환값 스키마. 지정하면 런타임 검증에도 사용 |
| `fn` | 개발자가 작성한 실제 실행 코드 |

#### 현재 Python 프로젝트에 적용할 때

1. `frontend/src/library.ts`에서 확장한 라이브러리를 export한다. 현재는 기본 `openuiLibrary`를 그대로 재노출한다.
2. `frontend/src/app/page.tsx`도 그 라이브러리를 import하여 `componentLibrary`에 전달한다. 현재 페이지는 패키지의 기본 `openuiLibrary`를 직접 사용하므로, 생성 진입점만 바꾸면 실행 시 새 함수가 연결되지 않는다.
3. 앞 절의 방식대로 `frontend`에서 `npm run generate`를 실행하고 생성된 프롬프트를 `backend-langgraph/agent/system-prompt.txt`에 명시적으로 복사한다. 새 함수 이름·설명·인자·반환형이 반영됐는지 확인한다.
4. 백엔드를 재시작하고 변경된 프런트엔드를 실행한다. 새 함수 호출과 입력 상태 변경을 실제 브라우저에서 검증한다.

**프롬프트에는 함수의 사용 계약이 들어가고, 실행 구현인 `fn`은 프런트엔드에 남는다.** Python에 같은 계산 함수를 옮길 필요는 없다. 다만 서버의 데이터 조회나 업무 처리가 필요한 기능은 별도 백엔드 도구/API로 설계해야 한다.

#### 제약과 액션의 차이

- 내장 함수나 기존 컴포넌트·함수·액션과 같은 이름은 등록할 수 없다. 예를 들어 `Filter`를 같은 이름으로 덮어쓰려 하면 라이브러리 생성 시 충돌 오류가 발생한다.
- 함수 평가기는 `fn`을 동기로 호출한다. 계산용 함수는 부작용 없이 작성하는 것이 적합하며, 비동기 API 조회는 Query/tool 경로로 분리한다.
- 인자·반환값 검증 실패 또는 함수 실행 중 예외는 평가 결과 `null`로 처리된다.
- `defineFunction()`은 값을 계산하는 확장이다. 클릭 시 복사·외부 동작을 수행하는 확장은 `defineAction()`으로 정의하고 `onAction`에서 처리한다. 두 기능 모두 `@이름(...)` 문법을 쓰지만 실행 목적은 다르다.

실제 확장 사례는 [open-intelligent-ui의 numbers.ts](../../22-reverse-engineering/open-intelligent-ui/src/lib/functions/numbers.ts)에 있는 `Pow`, `Clamp`, `Percent`, `Allocate` 등이다. [functions/index.ts](../../22-reverse-engineering/open-intelligent-ui/src/lib/functions/index.ts)에서 모으고 [library.ts](../../22-reverse-engineering/open-intelligent-ui/src/lib/library.ts)에서 등록한다. 이 별도 앱의 `npm run generate` / `npm run prompt`와 현재 Python 프로젝트의 `npm run generate` / 프롬프트 자산 복사 절차는 구분해야 한다.

본진 근거: [함수 정의 계약](../../22-reverse-engineering/openui/packages/lang-core/src/functions.ts), [라이브러리 등록과 이름 충돌 검사](../../22-reverse-engineering/openui/packages/lang-core/src/library.ts), [함수 평가](../../22-reverse-engineering/openui/packages/lang-core/src/runtime/evaluator.ts), [React 렌더러의 등록 함수 테스트](../../22-reverse-engineering/openui/packages/react-lang/src/registeredFunctions.test.tsx).


### 질문, openui-lang을 사용하게 되면 그럼 마크다운 출력대신에 openui lang으로만 대답하게 되는거야 ?

**OpenUI 모드만 사용해도 일반 텍스트와 Markdown을 충분히 출력할 수 있다.** 현재 프로젝트는 LLM 응답의 바깥 형식을 OpenUI Lang으로 생성하도록 지시하지만, 그 안의 `TextContent`와 `MarkDownRenderer`에 설명 문장이나 Markdown을 담아 렌더링한다. 따라서 텍스트 설명을 제공하기 위해 반드시 `inlineMode`로 전환할 필요는 없다. `inlineMode`는 일반 Markdown 본문 사이에 UI 코드 블록을 배치하려는 별도의 출력 구성이다.

#### 1. 현재 프로젝트 설정: 순수 UI 모드 (Pure Mode)

현재 `backend-langgraph/agent/system-prompt.txt`의 첫 문장은 다음과 같이 선언되어 있다.

> `You are an AI assistant that responds using openui-lang, a declarative UI language. Your ENTIRE response must be valid openui-lang code — no markdown, no explanations, just openui-lang.`

- **응답 형식과 표시 내용을 구분한다**: “OpenUI Lang으로만 응답”은 LLM이 반환하는 **외부 문법**에 대한 지침이다. 화면의 모든 내용이 차트나 폼이어야 한다거나, 인사말·설명·Markdown을 표시할 수 없다는 뜻이 아니다. 인사와 설명도 OpenUI 컴포넌트 안에 넣으면 된다.
- **일반 텍스트**: `TextContent`에 서식 없는 문자열을 넣으면 화면에는 보통 채팅 문장처럼 보인다. 예를 들어 `Hi`에 대한 응답도 다음처럼 생성할 수 있다.

  ```text
  root = Stack([greeting])
  greeting = TextContent("Hello! How can I assist you today?")
  ```

  사용자는 “Hello! How can I assist you today?”라는 문장을 보지만, 실제 전송된 응답은 OpenUI Lang이고 프런트엔드는 이를 React 컴포넌트로 렌더링한다. 별도의 plain-text 응답 모드로 바뀐 것이 아니다.

- **Markdown 텍스트**: 현재 컴포넌트 명세에서 `TextContent`는 Markdown을 지원하고, `MarkDownRenderer`는 Markdown 텍스트 렌더링을 명시적으로 제공한다. 제목·강조·목록·링크 등의 문법을 컴포넌트 문자열에 담을 수 있다.

  ```text
  root = Stack([intro, explanation])
  intro = TextContent("아래는 **프로젝트 요약**입니다.")
  explanation = MarkDownRenderer("## 주요 내용\n- **강조**와 *기울임*\n- 일반적인 설명 문장\n- [참고 링크](https://www.openui.com)")
  ```

  위의 `\n`은 문자열 내부의 줄바꿈이다. 응답 전체는 OpenUI Lang이지만 사용자는 제목·강조·목록·링크가 적용된 Markdown 문서를 보게 된다. Markdown 설명과 표·차트도 같은 `Stack`이나 `Card` 안에 함께 배치할 수 있다.

- **표시 목적에 맞게 선택한다**: 짧은 설명은 `TextContent`, 문서형 Markdown 블록은 `MarkDownRenderer`, 구조화된 데이터는 `Table`·차트 등으로 표현하면 된다. 일반적인 텍스트·Markdown 답변과 UI를 함께 보여주는 데 순수 UI 모드만으로 충분하다.
- **엄격한 원문 텍스트는 별도 요구사항이다**: `TextContent`도 Markdown을 해석하므로 `**문자열**`의 별표까지 그대로 보여주려는 경우는 서식 없는 문장을 표시하는 것과 다르다. 해당 목적에는 이스케이프, 코드 표시 또는 별도 plain-text 컴포넌트가 필요하다.
- **현재 명세 근거**: [프런트엔드 컴포넌트 계약](frontend/src/generated/spec.json)의 `TextContent(text, size?)`와 `MarkDownRenderer(textMarkdown, variant?)`에 해당 지원이 정의되어 있다. 이 설명은 출력·렌더링 방식에 대한 문서 보완이며, 현재 프롬프트나 실행 모드를 변경한 것은 아니다.

#### 2. OpenUI의 인라인 모드 (`inlineMode`: 텍스트 + UI 혼합)

OpenUI 사양(`@openuidev/lang-core`)에는 **`inlineMode: true`** 옵션이 존재한다. 시스템 프롬프트 생성 시 `promptOptions: { inlineMode: true }`를 주면 프롬프트에 `## Inline Mode` 지침이 포함된다.

- **단순 질문일 때**: UI 코드를 생성하지 않고 일반 챗봇처럼 순수 텍스트/마크다운으로만 응답한다 (기존 UI 유지).
- **UI 생성/수정 요청일 때**: 마크다운 텍스트 설명과 함께 ````openui-lang ... ```` 코드 펜스로 UI 코드를 감싸서 출력한다.
  ````markdown
  요청하신 매출 통계 대시보드입니다:

  ```openui-lang
  root = Stack([title, chart])
  title = TextContent("Q4 매출 현황", "large-heavy")
  chart = BarChart(labels, [s1])
  labels = ["10월", "11월", "12월"]
  s1 = Series("매출", [100, 150, 200])
  ```

  추가로 수정이 필요한 부분이 있다면 알려주세요.
  ````

#### 3. 프런트엔드의 파싱 및 렌더링 분기 원리

프런트엔드 라이브러리(`@openuidev/react-ui`)의 `readMessage`와 `hasLangSyntax` 유틸리티는 응답 본문에서 ````openui-lang 코드 펜스나 `root =` 선언을 감지한다.

- ````openui-lang 펜스가 있으면: 펜스 외부의 텍스트는 일반 채팅 메시지(Markdown 버블)로 렌더링하고, 펜스 내부 코드는 OpenUI 런타임 렌더러(`Renderer`)로 전달해 상호작용 가능한 React 컴포넌트로 렌더링한다.
- 펜스 없이 전체가 순수 코드인 경우: 전체를 UI 캔버스로 바로 렌더링한다.

#### 4. 두 모드 요약 비교

| 구분 | 순수 UI 모드 (현재 프로젝트 기본값) | 인라인 모드 (`inlineMode: true`) |
| :--- | :--- | :--- |
| **LLM 전체 응답** | OpenUI Lang 코드 안의 컴포넌트 문자열로 인사·설명·Markdown을 표현 | 일반 마크다운 대화 + ````openui-lang 코드 펜스 |
| **마크다운 서식 지원** | `MarkDownRenderer`, `TextContent` 컴포넌트 내부에서 지원 | 일반 채팅 말풍선 본문에서 직접 지원 |
| **적합한 화면 구조** | Claude Artifacts 캔버스 전용 뷰, 단독 대시보드 | ChatGPT / v0 형태의 대화형 인터페이스 |

본진 근거: [인라인 모드 프롬프트 생성 로직](../../22-reverse-engineering/openui/packages/lang-core/src/parser/prompt.ts#L386-L410), [시스템 프롬프트 명세 문서](../../22-reverse-engineering/openui/docs/content/docs/openui-lang/system-prompts.mdx#L98), [메시지 파서 및 문법 감지](../../22-reverse-engineering/openui/packages/react-ui/src/utils/messages.ts#L52).

### 2026-10-18 document-comparison 기능 이관 완료 상태

새 프로젝트에는 Python PDF 준비/실제 OpenAI 임베딩/search_documents, 비교 UI와 문서 목록, Python SQLite 기반 영구 대화 저장을 연결했다. 기존 기본 예제와 원본 cookbook은 유지했다. 현재 기능·실행 경계는 [제품 설계](docs/stock/business.md)와 [시스템 설계](docs/stock/system.md)를 따른다.

샘플 3개/1,564구절의 실제 임베딩, 매출 비교/R&D 후속 질문, 대화 CRUD와 백엔드 재시작 복원, 브라우저의 표/차트/출처 카드/문서 목록을 확인했다. Python 39개 테스트와 정적 검사, frontend lint/typecheck/build가 통과했다. 상세 근거와 발견한 모델 답변 품질 한계는 [기능 이관 기록](docs/flow/2026-10-18-document-comparison-complete.md)에 남겼다. 위의 과거 미구현/미검증 기록은 당시 상태이며 이 항목이 현재 상태를 갱신한다.
