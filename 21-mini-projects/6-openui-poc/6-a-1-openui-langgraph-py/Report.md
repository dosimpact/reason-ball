# Open UI (React) + Langgraph  

## 구축 레이어

**생성형 UI 구축 (To build Generative UI):**
- **1. OpenUI Lang**: 자체 컴포넌트로 인터페이스를 기술하는 선언형 DSL. JSON 기반 포맷 대비 절반 미만의 토큰으로 모델 생성이 가능하며, 스트리밍에 맞춰 렌더러가 점진적으로 화면을 표시한다.
- **2. Agent Interface**: 대화 스레드, 스트리밍 메시지, 도구 실행 상태, 동적 생성 컴포넌트를 모두 지원하는 완성형 채팅 UI용 React SDK. 기존 에이전트 백엔드에 직접 연결하거나, assistant-ui, CopilotKit 또는 자체 채팅 UI에 렌더러만 얹어서 사용할 수 있다.

**프로덕션 환경 운영 (To run it in production):**
- **3. Gateway**: 생성형 UI를 위한 OpenRouter 역할. 여러 공급자(Provider)의 모델을 단일 API로 통합하며, 장애 발생 시 자동 페일오버(Failover) 및 스트리밍 중 잘못된 OpenUI Lang을 실시간 보정하는 Autofix가 내장되어 있다.
- **4. Autofix**: 생성 완료 후 유효하지 않은 OpenUI Lang 코드를 단 한 번의 API 호출로 자동 수정(Repair). 기존 모델 공급자, 추론 환경, 에이전트 프레임워크를 그대로 유지한 채 적용 가능하다.
- **5. 신뢰성 모니터링 (Reliability Monitoring)**: 생성된 인터페이스의 실패율, 반복되는 에러 유형, 실패 원인이 된 생성 내역을 추적·분석. Gateway/Autofix 사용 시 자동 활성화되며, 자체 추론 환경에서는 Observability SDK를 통해 연동할 수 있다.

## 한계 
- OpenUI의 LangGraph 연동 패키지는 JS/TS용   
- 플링킹 이슈 및 validator failover 이슈 (오픈소스의 프리미엄 영역은 모니터링 부분임.)  
- LangGraph JS 예제에는 LLM이 만든 OpenUI Lang을 서버에서 검증하고, 오류를 모델에 돌려보내 수정시키는 단계는 없다.( Gateway 쪽에서 검증·보정을 맡는 구조 - 돈내라 )
- 모델이 잘못된 UI 크기를 출력한 사례는 검증이 가능할지 모르겠다.? width, height가 나온것은 validator 통과. 그러나 적절한 높이 너비가 아니라면 화면에서 꺠질 수 있음.  

## Details

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

LLM이 **선언형 UI 언어(`openui-lang`)로만 응답하도록 강제하는 프롬프트**이다.  
- openuidev/lang-core`의 `generateSystemPrompt()의 결과를 추출함. 기본 frontend 카탈로그가 포함됨.  

1. 역할 및 제약
- **순수 UI 코드 강제**: 일반 텍스트나 마크다운 설명 없이 전체 출력이 100% 유효한 `openui-lang`이어야 함.
- **위치 기반 인자 (Positional Arguments)**: 키워드 인자(`key: value`)는 파싱을 깨뜨리므로 철저히 위치 기반 인자만 허용.
- **루트 도달성**: 진입점은 항상 `root = Stack(...)`이며, `root`에서 참조되지 않는 변수는 렌더링에서 자동 탈락.

2. 스트리밍 최적화 (Shell-First & Hoisting)  
- **호이스팅(Hoisting) 전제**: 참조를 정의보다 먼저 사용할 수 있도록 파서가 지원.  
- **점진적 렌더링 순서**: 
  1. `root = Stack(...)` (최상단 배치로 UI 골격을 즉시 렌더링)
  2. 컴포넌트 레이아웃 정의
  3. 리프 데이터 값 (스트리밍되면서 점진적으로 데이터 주입)


3. 컴포넌트 & 상태/액션 규칙  
- **열 지향 테이블**: `Table`은 행(Row) 단위가 아닌 `Col` 단위의 열 중심 배열 구조 사용 (차트와의 데이터 연동 용이).  
- **폼(Form) 규칙**: Form 중첩 금지, 스트리밍 지연 방지를 위해 각 `FormControl`을 개별 변수로 분리, 명시적 `Buttons` 필수.  
- **반응형 상태 & 액션**: `$variable` 양방향 바인딩, 컬렉션 연산(`@Filter`, `@Sort`, `@Count`), 이벤트 트리거(`@ToAssistant`, `@OpenUrl`) 지원.  
- **카드 전용 인라인 요소 제약**: `Text`, `BoldText`, `IconText`, `MetricIndicatorInline` 등은 카드 블록 내부에서만 사용 가능 (루트 직접 배치 불가).  

### UI 컴포넌트 카탈로그와 langgraph system prompt sync방법

LLM이 생성할 OpenUI 컴포넌트를 추가하거나 이름·인자·사용 규칙을 변경하면, 프런트엔드 렌더링 카탈로그와 백엔드 시스템 프롬프트를 함께 갱신해야 한다.  

현재 방식: 생성 후 명시적으로 복사  
- 1. 새 컴포넌트 구현과 명세를 OpenUI 라이브러리에 등록하고, 실제 렌더러와 `frontend/src/library.ts`의 생성용 export가 같은 카탈로그를 사용하도록 맞춘다. 
- 2. `frontend`에서 프롬프트를 생성하고 백엔드 자산으로 복사한다.
- 3. 변경된 프롬프트에 새 컴포넌트의 이름·인자·규칙이 포함됐는지 확인한다. `agent/graph.py`에서 붙이는 에이전트 지시문은 별도로 유지한다.

```text
[Frontend: 카탈로그 SSOT]
├── components (React UI 컴포넌트)
├── defineFunction() (사용자 정의 계산 함수)
└── defineAction() (사용자 정의 버튼 액션)
      │
      ▼ (npm run generate)
[빌드 타임 프롬프트 생성 (@openuidev/cli)]
├── src/generated/spec.json (컴포넌트/함수 메타데이터 스펙)
└── src/generated/system-prompt.txt (순수 openui-lang 지침 텍스트)
      │
      ▼ (명시적 파일 복사: cp)
[Python LangGraph 백엔드]
└── backend-langgraph/agent/system-prompt.txt
      │  + 런타임 추가 지시문 (도구 설명, Mock 데이터 안내)
      ▼
[create_deep_agent()] ──► [LLM (OpenAI)]
                               │ (openui-lang 코드 생성)
                               ▼
                    [브라우저 OpenUI 런타임]
                    ├── React 컴포넌트 렌더링
                    └── 클라이언트 fn 로직 직접 실행
```


### '데이터 조작 내장 함수: @Filter, @Sort, @Count, @Each 등' 확장 기능이 있는가 ? 

**있다. `defineFunction()`으로 사용자 정의 함수를 만들고 라이브러리에 등록하면, OpenUI Lang에서 `@함수명(...)`으로 호출할 수 있다.** 내장 함수 자체를 수정할 필요는 없다.

*아래 코드는 설명용 ( `openui/packages/lang-core/src/functions.ts`, `library.ts`, `runtime/evaluator.ts` ) 

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

- 기존 라이브러리는 `extend({ functions: { add: [...] } })`로 확장가능 
- 새 라이브러리를 구성할 때는 `createLibrary({ components: [...], functions: [...] })`에 등록
- OpenUI Lang에서는 다음과 같이 계산값을 정의하여 UI에서 참조할 수 있다. 아래는 전체 UI 프로그램이 아닌 계산 부분이다.

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


### 질문: document-comparison의 “Behind the scenes / Used search documents”는 어떻게 표시되는가?

질문: `openui/examples/cookbooks/document-comparison`에서 다음처럼 LLM이 작업하는 과정이 보였다. 이 화면은 어떻게 구현한 것인가?

```text
Behind the scenes
Used search documents
Used search documents
Used search documents
```

**답변: OpenUI의 `AgentInterface`가 도구 호출 이벤트를 받아 자동으로 표시하는 실행 타임라인이다.** LLM이 `Used search documents`라는 문장을 직접 생성하는 것이 아니다. 아래 내용은 2026-10-18 현재 소스 확인 기준이다.

#### 실행부터 표시까지의 흐름

```text
모델이 search_documents 호출 요청
    ↓
서버의 OpenAI SDK runTools()가 도구 실행
    ↓
도구 호출 정보가 응답 스트림에 포함
    ↓
openAIReadableStreamAdapter가 이벤트로 변환
    ↓
AgentInterface가 도구 활동을 관리
    ↓
ToolCallTimeline이 Behind the scenes 표시
```

1. **서버의 도구 등록·실행**: `src/app/api/chat/route.ts`에서 `openai.chat.completions.runTools()`에 `search_documents`와 실행 함수를 등록한다. 모델이 호출을 요청하면 SDK가 도구를 실행하고 결과를 모델에 전달한다. `runner.toReadableStream()`으로 스트림을 브라우저에 전달한다. 이 프로젝트의 해당 경로는 DeepAgents를 사용하지 않는다.
2. **브라우저의 이벤트 변환**: `src/components/comparison-chat.tsx`의 `fetchLLM()`에 `openAIReadableStreamAdapter()`가 연결되어 있다. 어댑터는 스트림의 `delta.tool_calls`를 읽어 `TOOL_CALL_START`, `TOOL_CALL_ARGS`, `TOOL_CALL_END`로 변환한다.
3. **도구 활동과 답변 구분**: 본진 `AgentInterface/Thread.tsx`가 도구 호출과 결과를 연결한 활동 목록을 만들고, `ToolCallTimeline`에 전달한다. 공개된 중간 설명이 있으면 타임라인의 텍스트 항목으로도 처리한다. 최종 답변은 별도 답변 영역에 표시한다.
4. **표시 문구 생성**: `toolLabels.tsx`가 `search_documents`를 `search documents`로 바꾼다. 실행 중에는 `Using search documents`, 완료 상태 표시는 `Used search documents`가 된다. `ToolCallTimeline.tsx`는 진행 중 제목을 `Working`, 작업 종료 후 제목을 `Behind the scenes`로 표시한다.

```ts
// document-comparison/src/components/comparison-chat.tsx
const llm = fetchLLM({
  url: "/api/chat",
  streamAdapter: openAIReadableStreamAdapter(),
  messageFormat: openAIMessageFormat,
});
```

#### 같은 문구가 세 번 나오는 이유

UI가 같은 이름의 도구 호출을 세 건 표시한 것이다. 현재 `src/lib/prompt.ts`는 비교 기준마다 `search_documents`를 호출하고, 중요한 정보가 없으면 검색 표현을 바꾸어 재검색하도록 지시한다. 따라서 세 줄은 서로 다른 비교 기준의 검색이나 재검색일 수 있다. 정확한 검색 내용과 이유는 각 호출 인자를 확인해야 하며, 표시 문구만으로 세 문서를 각각 검색했다고 단정할 수 없다.

#### Inline 모드 및 내부 사고 과정과의 관계

- 이 타임라인은 **도구 호출과 공개된 중간 설명을 표시하는 기능**이며, 모델의 비공개 내부 사고 과정을 그대로 보여주는 기능이 아니다.
- `Used search documents`는 UI가 만든 상태 문구이므로 일반 텍스트로 보이더라도 Inline 모드라는 증거가 아니다. 순수 OpenUI Lang 출력을 지시하는 현재 설정에서도 나타난다.
- 최종 OpenUI 응답의 렌더링과 도구 활동 타임라인은 별도 경로다. 앞서 나눈 학습 레이어에서는 **3번 에이전트 실행 → 4번 스트림 전달 → 6번 채팅 화면·대화 상태**에 걸친 기능이다.
- 어댑터의 `TOOL_CALL_END`는 모델 스트림의 `finish_reason: "tool_calls"`를 보고 생성된다. 이 이벤트 자체를 서버 도구 실행의 성공 증거와 동일하게 해석해서는 안 된다. 실제 결과·오류 검증에는 도구 결과 메시지까지 확인해야 한다.

코드 근거:

- [서버 도구 실행 및 스트림 전달](../../22-reverse-engineering/openui/examples/cookbooks/document-comparison/src/app/api/chat/route.ts)
- [프런트엔드 어댑터 연결](../../22-reverse-engineering/openui/examples/cookbooks/document-comparison/src/components/comparison-chat.tsx)
- [검색 횟수와 재검색 지침](../../22-reverse-engineering/openui/examples/cookbooks/document-comparison/src/lib/prompt.ts)
- [OpenAI 스트림을 도구 이벤트로 변환](../../22-reverse-engineering/openui/packages/react-headless/src/stream/adapters/openai-readable-stream.ts)
- [도구 활동 및 답변 영역 구성](../../22-reverse-engineering/openui/packages/react-ui/src/components/AgentInterface/Thread.tsx)
- [도구 이름과 상태 문구 생성](../../22-reverse-engineering/openui/packages/react-ui/src/components/ToolCall/toolLabels.tsx)
- [Behind the scenes 타임라인](../../22-reverse-engineering/openui/packages/react-ui/src/components/ToolCall/ToolCallTimeline.tsx)

### Prompt Library 확장  

### ui를 만드는 과정에서 openUI에서 ui가 완성중이면 인터렉션 ui(폼, 카드)등 disable 시키는 기능이 있니?

**답변: 있다. OpenUI 기본 컴포넌트에는 스트리밍 중 입력·클릭을 비활성화하는 처리가 구현되어 있다.** 핵심은 `@openuidev/react-lang`의 `useIsStreaming()` 훅이다.

```tsx
// OpenUI Renderer 내부에서 렌더링되는 커스텀 컴포넌트 예시
const isStreaming = useIsStreaming();

return <button disabled={isStreaming}>제출</button>;
```

| 대상 | 스트리밍 중 동작 |
| --- | --- |
| `Button`, `IconButton` | `disabled={isStreaming}`으로 버튼 비활성화 |
| `Input`, `TextArea`, `Select`, `Slider` | 입력·변경 비활성화 |
| `CheckBoxGroup`, `RadioGroup`, `OptionCards` 등 | 선택 비활성화 |
| `OverviewCardBlock`, `ContextCardBlock` 등 액션 카드 | 클릭 가능 상태 해제 및 액션 실행 차단 |

예를 들어 액션 카드는 `Boolean(props.action) && !isStreaming`으로 클릭 가능 여부를 정하고, 클릭 처리 함수에서도 `isStreaming`이면 즉시 반환한다.

#### 적용 범위와 주의점

- **화면 전체를 한꺼번에 잠그는 방식은 아니다.** `Form` 컨테이너가 전체를 잠그는 것이 아니라, 내부 입력·버튼 컴포넌트가 각각 스트리밍 상태를 읽어 비활성화한다. 모든 컴포넌트의 모든 상호작용이 자동 차단된다고 일반화하면 안 된다.
- **커스텀 컴포넌트에는 직접 적용한다.** `useIsStreaming()`을 읽어 `disabled`에 연결하거나 클릭·액션 처리에서 실행을 차단한다.
- **기준은 해당 렌더러에 전달된 `isStreaming`이다.** 카드 하나의 코드가 먼저 완성됐는지를 판정하는 기능이 아니다. 직접 `<Renderer />`를 사용하는 화면은 호스트가 실제 응답 생성 상태에 맞춰 이 값을 전달해야 한다.
- **스트리밍 종료와 UI 유효성 검증은 별개다.** `isStreaming`이 `false`가 되었다고 생성된 UI가 문법·스키마 검증을 통과했다는 뜻은 아니다.

2026-10-18 본진 소스 확인 기준이다. 이번 확인에서는 브라우저에서 생성 중 입력·클릭을 직접 시험하지 않았으며, 런타임 코드는 변경하지 않았다.

코드 근거:

- [useIsStreaming 정의](../../22-reverse-engineering/openui/packages/react-lang/src/context.ts)
- [Button 비활성화](../../22-reverse-engineering/openui/packages/react-ui/src/genui-lib/Button/index.tsx)
- [Input 비활성화](../../22-reverse-engineering/openui/packages/react-ui/src/genui-lib/Input/index.tsx)
- [OverviewCardBlock 클릭 차단](../../22-reverse-engineering/openui/packages/react-ui/src/genui-lib/OverviewCardBlock/index.tsx)
- [ContextCardBlock 클릭 차단](../../22-reverse-engineering/openui/packages/react-ui/src/genui-lib/ContextCardBlock/index.tsx)
- [Form 컨테이너 구현](../../22-reverse-engineering/openui/packages/react-ui/src/genui-lib/Form/index.tsx)




## Example 분석 (1) - Base

대상: `22-reverse-engineering/genui-chat-app`의 현재 코드. `src/app`을 진입점으로 관련 라이브러리·에이전트·채팅 구성을 정리한다.

### 1. OpenUI 라이브러리 구성

- [src/lib/library.ts](../../22-reverse-engineering/genui-chat-app/src/lib/library.ts): 기본 `openuiLibrary`와 `openuiPromptOptions`를 export한다. 별도 커스텀 라이브러리 구성은 없다.
- [src/app/page.tsx](../../22-reverse-engineering/genui-chat-app/src/app/page.tsx): `@openuidev/react-ui/styles/index.css`를 import하고 `<OpenAIChat />`을 표시한다.
- 실제 채팅의 `componentLibrary`에도 기본 `openuiLibrary`를 전달한다.

### 2. 스키마 JSON 생성 → 시스템 프롬프트 조립

`npm run generate`는 다음 명령으로 라이브러리 명세를 JSON으로 내보낸다. `predev`, `prebuild`에도 연결되어 있다.

```bash
openui generate src/lib/library.ts --spec --out src/generated/spec.json
```

생성된 `spec.json`은 역할상 두 부분으로 나뉜다. 별도 JSON 두 개를 만드는 의미는 아니다.

| 구분 | 역할 |
| --- | --- |
| UI catalog — **what** | 사용 가능한 컴포넌트와 인자·스키마 등 라이브러리 계약 |
| `promptOptions` — **how to use** | 컴포넌트 사용 지침·예시 등 프롬프트 구성 옵션 |

[src/agent.ts](../../22-reverse-engineering/genui-chat-app/src/agent.ts)는 이를 분리하여 에이전트 생성 시 시스템 프롬프트를 조립한다. 이 경로는 생성된 `system-prompt.txt`를 읽지 않는다.

```ts
const { promptOptions, ...library } = librarySpec;
// createAgent의 설정
systemPrompt: generateSystemPrompt({ library, promptOptions })
```

### 3. agent.ts 구성: 시스템 프롬프트 + 도구 + 에이전트 상태

- **에이전트**: LangChain의 `createAgent()`를 사용한다. 이 프로젝트는 `createDeepAgent()`를 사용하지 않는다.
- **모델·프롬프트**: `ChatOpenAI`로 OpenAI에 직접 연결하고, 위에서 조립한 시스템 프롬프트를 전달한다.
- **도구**: `get_weather` 하나를 등록한다. `location`을 Zod로 정의하고, 실제 구현은 [get-weather.ts](../../22-reverse-engineering/genui-chat-app/src/lib/tools/get-weather.ts)에 위임한다. 장소를 좌표로 변환한 후 Open-Meteo 현재 날씨를 조회하여 JSON 문자열로 반환한다.
- **상태**: 기본 대화 메시지 상태에 더해 `StateSchema`로 `model` 필드를 정의한다. `selectedModel` 미들웨어가 매 모델 호출에 요청에서 선택한 모델을 적용한다.
- **API 연결**: [src/app/api/chat/route.ts](../../22-reverse-engineering/genui-chat-app/src/app/api/chat/route.ts)가 요청·메시지·허용 모델·키 유무를 확인하고 `createGraph()`를 호출한다. `graph.stream({ messages, model }, { streamMode: "messages", encoding: "text/event-stream", ... })` 결과를 SSE로 반환한다. 대화 이력은 브라우저가 매 요청에 보내며 서버에는 저장하지 않는다.

### 4. Chat UI

[src/components/openai-chat.tsx](../../22-reverse-engineering/genui-chat-app/src/components/openai-chat.tsx)의 `AgentInterface`가 채팅 화면을 구성한다.

- `fetchLLM()`이 `/api/chat`으로 선택 모델과 대화를 보낸다. `langGraphMessageFormat`으로 전송 메시지를 변환하고, `langGraphAdapter()`로 응답 SSE를 읽는다.
- `componentLibrary={openuiLibrary}`로 모델이 만든 OpenUI Lang을 화면에 렌더링한다.
- 모델 선택, 테마 전환, 시작 질문, 환영 화면을 구성한다.
- `localChatStorage`와 `LocalChatPersistence`가 브라우저에 대화 목록·메시지를 저장한다.

```text
기본 라이브러리 + promptOptions → spec.json → agent.ts의 시스템 프롬프트
사용자 입력 → AgentInterface → /api/chat → createAgent(모델 + 도구 + 상태)
          ← OpenUI 렌더링    ← LangGraph 메시지 SSE
```



## Example 분석 (2) - Shadcn ui extension

대상: `22-reverse-engineering/openui/examples/design-systems/shadcn`의 현재 구현. 아래 과정은 소스에 구현된 연결 순서이며, 과거 설치 명령의 실행 이력을 뜻하지 않는다. 이 예제의 `src`는 LangGraph나 Vercel AI SDK를 직접 사용하지 않고, OpenAI SDK와 자체 `runChatToolLoop()`로 모델·도구 호출을 처리한다.

### 1. shadcn UI 추가 및 OpenUI 연결 과정

#### 1-1. 실제 React UI 준비

`src/components/ui/`에 `card.tsx`, `button.tsx`, `table.tsx` 등 실제 shadcn UI 구현이 있다. `components.json`은 `new-york` 스타일과 `@/components/ui` 경로를 지정한다.

이 파일들은 화면에 표시할 React 컴포넌트다. LLM이 사용할 이름·인자·설명은 다음 단계의 OpenUI 정의에서 지정한다.

#### 1-2. defineComponent로 LLM에 노출할 단위 정의

`src/lib/shadcn-genui/components/`에서 실제 UI를 감싸고, 이름·Zod props 스키마·설명·렌더링 함수를 선언한다. 다음은 현재 `card-header.tsx`의 구조다.

```tsx
"use client";

import {
  CardDescription,
  CardTitle,
  CardHeader as ShadcnCardHeader,
} from "@/components/ui/card";
import { defineComponent } from "@openuidev/react-lang";
import { z } from "zod";

const CardHeaderSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
});

export const CardHeader = defineComponent({
  name: "CardHeader",
  props: CardHeaderSchema,
  description: "Title/description header block for a Card.",
  component: ({ props }) => (
    <ShadcnCardHeader className="p-0">
      <CardTitle>{props.title}</CardTitle>
      {props.description && <CardDescription>{props.description}</CardDescription>}
    </ShadcnCardHeader>
  ),
});
```

**React의 composition 단위와 LLM 카탈로그의 단위는 달라도 된다.** `CardTitle`과 `CardDescription`을 각각 등록하지 않고 `CardHeader(title, description)` 하나로 묶었다. LLM이 세부 요소를 독립적으로 조합해야 할 때만 별도 등록하면 된다.

| OpenUI에 등록된 이름 | 내부에서 조합하는 React UI |
| --- | --- |
| `Card` | `Card` + `CardContent` |
| `CardHeader` | `CardHeader` + `CardTitle` + `CardDescription` |

#### 1-3. 자식 타입과 카탈로그에 등록

`src/lib/shadcn-genui/index.tsx`는 `createLibrary()`로 카탈로그를 구성한다. 다음은 핵심 부분만 발췌한 코드다.

```tsx
const ChatCardChildUnion = z.union([
  ...ChatContentChildUnion.options,
  Tabs.ref,
  Carousel.ref,
]);

const ChatCard = defineComponent({
  name: "Card",
  props: z.object({
    children: z.array(ChatCardChildUnion),
  }),
  description:
    "Vertical container for all content in a chat response. Children stack top to bottom automatically.",
  component: ({ props, renderNode }) => (
    <Card>
      <CardContent className="p-0 space-y-3">
        {renderNode(props.children)}
      </CardContent>
    </Card>
  ),
});

export const shadcnChatLibrary = createLibrary({
  root: "Card",
  componentGroups: shadcnComponentGroups,
  components: [
    ChatCard,
    CardHeader,
    // 실제 코드에는 TextContent, Table, 차트, 폼 등도 등록되어 있다.
  ],
});
```

- `root: "Card"`는 `defineComponent({ name: "Card" })`를 최상위 컴포넌트로 지정한다. shadcn의 필수 제약이 아니라 응답을 카드 하나 안에 세로로 배치하려는 예제의 설계다.
- 새 컴포넌트는 `components`에 등록하고, 필요한 경우 `unions.ts`의 허용 자식 타입에도 `.ref`를 추가한다. 등록 여부와 특정 컨테이너 안에 배치 가능한지는 별도 계약이다.
- `componentGroups`는 컴포넌트를 용도별로 묶는다. `shadcnPromptOptions`에는 사용 예시와 추가 규칙이 정의되어 있다.

#### 1-4. 같은 카탈로그에서 LLM용 명세 생성

`src/library.ts`가 CLI의 진입점이다.

```ts
export {
  shadcnChatLibrary as library,
  shadcnPromptOptions as promptOptions,
} from "./lib/shadcn-genui";
```

예제 디렉터리에서 다음 스크립트로 명세를 생성한다. `predev`, `prebuild`에도 연결되어 있다.

```bash
npm run generate
# 실행되는 명령:
# openui generate src/library.ts --spec --out src/generated/spec.json
```

`src/lib/model-prompt.ts`는 생성된 JSON을 읽어 `generateSystemPrompt({ library, ... })`를 호출한다. `/api/chat`은 그 결과를 system 메시지로 넣어 LLM에 전달한다. 즉, 카탈로그를 브라우저에 연결하는 것과 LLM에게 사용 가능한 명세를 알려 주는 것은 각각 필요하다.

주의: 현재 `model-prompt.ts`는 JSON 전체를 `library`로 넘기며, Base 예제처럼 `promptOptions`를 분리해 `generateSystemPrompt({ library, promptOptions })`에 전달하지 않는다. 따라서 정의된 추가 규칙·예시가 실제 프롬프트에 반영되는지는 생성 결과와 호출 계약을 별도로 확인해야 한다. 이 정리에서는 코드 수정이나 프롬프트 실행 검증을 수행하지 않았다.

#### 1-5. 브라우저 렌더러에 같은 카탈로그 연결

`src/app/page.tsx`의 핵심 연결은 다음과 같다.

```tsx
const llm = fetchLLM({
  url: "/api/chat",
  streamAdapter: openAIAdapter(),
  messageFormat: openAIMessageFormat,
});

<AgentInterface
  llm={llm}
  componentLibrary={shadcnChatLibrary}
  agentName="shadcn/ui Chat"
/>
```

LLM이 다음과 같은 OpenUI Lang을 출력하면 등록된 React 구현으로 렌더링한다.

```text
root = Card([header])
header = CardHeader("매출 현황", "이번 달 실적")
```

```text
실제 shadcn React UI
  → defineComponent: 이름 + props + 설명 + 렌더링 함수
  → createLibrary: shadcnChatLibrary
      ├─ CLI → spec.json → 시스템 프롬프트 → LLM
      └─ AgentInterface.componentLibrary → 응답의 React 렌더링
```

`AgentInterfaceBody`에 개별 shadcn 컴포넌트를 다시 등록할 필요는 없다. 새 종류를 추가하는 것은 개발자의 작업이고, 등록된 종류를 응답마다 선택·조합하는 것은 LLM의 역할이다.

### 2. 네 가지 OpenUI 패키지의 역할

예제의 직접 의존성 버전은 다음과 같다.

```json
{
  "@openuidev/lang-core": "1.0.1",
  "@openuidev/react-headless": "0.18.1",
  "@openuidev/react-lang": "1.0.1",
  "@openuidev/react-ui": "0.18.1"
}
```

| 패키지 | 담당 역할 | 주요 API·기능 | 이 예제에서의 쓰임 |
| --- | --- | --- | --- |
| `lang-core` | React와 독립적인 OpenUI 언어 엔진 | 파싱·스트리밍 파싱, 라이브러리 명세, 프롬프트 생성, 평가·검증 | 서버에서 `generateSystemPrompt()`로 LLM용 지시문 생성 |
| `react-lang` | OpenUI와 React의 연결 | `defineComponent`, `createLibrary`, `Renderer`, 폼 상태·액션 처리 | shadcn UI를 카탈로그로 정의하고 모델 출력을 React로 렌더링 |
| `react-headless` | 디자인 없는 채팅 상태·통신 기능 | `ChatProvider`, `useThread`, `useThreadList`, `fetchLLM`, 스트림 어댑터, 저장소 연결 | 대화·메시지 상태와 스트리밍을 관리하는 기반 |
| `react-ui` | 디자인이 포함된 채팅 UI와 기본 컴포넌트 | `AgentInterface`, 사이드바, 메시지 목록, 입력창, 테마 등 | 완성형 채팅 화면에 shadcn 응답 카탈로그 연결 |

`react-ui`는 `react-headless`의 API도 재수출한다. 따라서 예제에서 `fetchLLM`, `openAIAdapter`를 `react-ui`에서 import해도 실제 구현의 소유 패키지는 `react-headless`다. headless가 LangGraph·Vercel AI SDK용 어댑터를 제공한다는 사실과, 이 예제에서 그 어댑터를 사용한다는 것은 다르다. 이 예제는 OpenAI 어댑터를 선택한다.

### 3. 채팅 화면과 생성형 UI의 커스터마이징 경계

- `AgentInterface.Sidebar`, `.Composer`, `.Messages` 같은 정적 속성은 React에서 조합할 컴포넌트를 공개하는 API다. LLM용 카탈로그 등록이 아니다.
- `componentLibrary={shadcnChatLibrary}`는 AI 응답 내부의 렌더링을 바꾼다. 사이드바·입력창 등 기본 채팅 화면 전체를 shadcn으로 교체하지 않는다.
- 현재 `AgentInterface`는 `components.AssistantMessage`, `components.UserMessage`, `components.ToolCallTimeline`을 통한 교체를 지원한다. 커스텀 assistant 메시지를 지정하면 기본 GenUI 렌더러보다 우선하므로 OpenUI 렌더링 연결도 직접 담당해야 한다.
- 공개된 모든 컴포넌트가 교체 슬롯은 아니다. `AgentInterfaceBody`에는 `<Messages loader={<MessageLoading />} ... />`가 고정되어 있고, `Messages`와 `MessageLoading`은 자식 슬롯 교체 대상으로 등록되어 있지 않다. `<AgentInterface.Messages>`를 자식으로 추가해도 기본 목록을 대체하지 않는다.
- 메시지 고정, 목록에서 제외, 채팅 화면 밖의 패널 표시처럼 구조 변경이 많으면 `react-headless`의 상태를 상위에서 공유하고 메시지 목록·로딩 UI를 직접 구성하는 방향이 적합하다. 생성형 UI에는 `react-lang`과 기존 shadcn 카탈로그를 유지할 수 있다.

### 코드 근거 및 확인 범위

2026-10-18 현재 로컬 소스를 읽어 정리했다. 이 문서 변경을 위해 설치·빌드·브라우저·실제 LLM 호출을 새로 실행하지 않았다.

- [실제 shadcn UI](../../22-reverse-engineering/openui/examples/design-systems/shadcn/src/components/ui/card.tsx)
- [CardHeader OpenUI 정의](../../22-reverse-engineering/openui/examples/design-systems/shadcn/src/lib/shadcn-genui/components/card-header.tsx)
- [카탈로그·루트·그룹·예시](../../22-reverse-engineering/openui/examples/design-systems/shadcn/src/lib/shadcn-genui/index.tsx)
- [허용 자식 타입](../../22-reverse-engineering/openui/examples/design-systems/shadcn/src/lib/shadcn-genui/unions.ts)
- [프롬프트 생성](../../22-reverse-engineering/openui/examples/design-systems/shadcn/src/lib/model-prompt.ts)
- [채팅 화면 연결](../../22-reverse-engineering/openui/examples/design-systems/shadcn/src/app/page.tsx)
- [OpenAI 도구 호출 루프](../../22-reverse-engineering/openui/examples/design-systems/shadcn/src/lib/tool-loop.ts)
- [lang-core 공개 API](../../22-reverse-engineering/openui/packages/lang-core/src/index.ts)
- [react-lang 공개 API](../../22-reverse-engineering/openui/packages/react-lang/src/exports.ts)
- [react-headless 공개 API](../../22-reverse-engineering/openui/packages/react-headless/src/index.ts)
- [react-ui 공개 API](../../22-reverse-engineering/openui/packages/react-ui/src/index.ts)
- [AgentInterface의 슬롯과 기본 레이아웃](../../22-reverse-engineering/openui/packages/react-ui/src/components/AgentInterface/AgentInterface.tsx)
- [Messages와 MessageLoading](../../22-reverse-engineering/openui/packages/react-ui/src/components/AgentInterface/Thread.tsx)


### Q&A — Shadcn 예제 분석 중 질문한 내용

아래 답변은 앞선 대화와 로컬 코드 확인을 정리한 것이다. 대화 초반의 포괄적인 설명보다 실제 구현에서 확인된 지원 범위를 우선한다.

#### Q1. 이 예제의 src에서는 LangGraph나 AI SDK를 사용하지 않는가?

그렇다. 현재 `src`에는 LangGraph, LangChain, Vercel AI SDK 직접 사용이 없고, `package.json`에도 직접 의존성이 없다. 서버는 `openai` SDK로 Chat Completions를 호출하고 `runChatToolLoop()`로 도구 실행을 반복한다. OpenUI 패키지가 다른 프로토콜용 어댑터를 제공하는 것과 이 예제에서 사용하는 것은 구분해야 한다. 전이 의존성 전체가 없다는 의미는 아니다.

#### Q2. runChatToolLoop는 LLM을 여러 번 호출하게 만드는 함수인가?

그렇다. LLM이 도구 호출을 요청하면 서버가 도구를 실행하고 결과를 대화에 추가한 뒤 LLM을 다시 호출한다.

```text
LLM 호출 → tool_calls 반환 → 서버에서 도구 실행
         → assistant의 tool_calls와 tool 결과를 messages에 추가
         → LLM 재호출 → 답변
```

처음부터 답변하면 한 번만 호출한다. 기본 `maxRounds = 5`이므로 최대 다섯 번 호출하며, 마지막 호출에는 `tool_choice: "none"`을 지정한다. 이 반복은 서버의 도구 실행 제어이며, 브라우저에서 UI를 렌더링하는 과정과는 별개다.

#### Q3. shadcn 컴포넌트는 어떻게 추가되는가?

`src/components/ui/`에 실제 React UI를 준비하고, `src/lib/shadcn-genui/components/`에서 `defineComponent()`로 이름·props·설명·렌더링을 정의한다. 이를 `createLibrary()`의 `components`에 등록하고 필요한 부모의 자식 타입에도 포함한다. 이후 명세를 재생성해 LLM 프롬프트에 반영하고, 같은 라이브러리를 `AgentInterface.componentLibrary`에 연결한다. 구체적인 코드는 위의 1-1~1-5를 참고한다.

#### Q4. Card, CardHeader, CardTitle, CardDescription처럼 composition으로 분리된 요소를 모두 카탈로그에 등록해야 하는가?

아니다. **LLM이 독립적으로 선택·조합할 단위만 등록하면 된다.** 현재 `CardHeader` 하나가 내부에서 shadcn의 `CardHeader`, `CardTitle`, `CardDescription`을 조합한다.

```text
header = CardHeader("제목", "설명")
```

이 구조에서는 제목과 설명을 props로 전달하면 충분하다. 세부 요소를 LLM이 자유롭게 배치해야 할 요구가 있을 때 별도 컴포넌트로 노출한다. 고정된 상품 카드라면 `ProductCard(name, price, image)`처럼 전체를 하나로 감싸는 설계도 가능하다.

#### Q5. AgentInterfaceBody에서도 OpenUI 컴포넌트를 다시 바인딩해야 하는가?

개별 컴포넌트를 다시 등록할 필요는 없다. `page.tsx`에서 `componentLibrary={shadcnChatLibrary}`를 전달하면, `AgentInterface`가 그 라이브러리에 연결된 assistant 메시지 렌더러를 만들어 `AgentInterfaceBody`에 전달한다.

```text
AgentInterface(componentLibrary)
  → 라이브러리가 연결된 assistant 메시지 렌더러
  → AgentInterfaceBody → Messages
```

서버의 프롬프트용 명세와 클라이언트의 React 렌더링 연결은 각각 필요하지만, 둘의 원본은 같은 카탈로그다.

#### Q6. AgentInterface.Sidebar = SidebarSlot 같은 기본 등록은 shadcn 카탈로그를 전달하면 무시되는가?

아니다. 이 할당은 `AgentInterface.Sidebar`처럼 접근할 수 있게 React 컴포넌트를 공개하는 compound component API다. LLM 카탈로그 등록과는 다른 역할이다.

- `Sidebar`, `Composer`, `ThreadHeader` 등은 채팅 앱의 화면 구성에 사용된다.
- `shadcnChatLibrary`는 AI 응답 안의 카드·표·차트·폼 렌더링에 사용된다.
- 실제 교체 슬롯으로 지원되는 부분에 커스텀 요소를 제공하면 그 부분이 교체된다. 카탈로그 전달만으로 사이드바나 입력창이 바뀌지는 않는다.

또한 정적 속성으로 공개되어 있다는 사실만으로 기본 UI를 교체하는 슬롯이라고 판단하면 안 된다. `Messages`와 `MessageLoading`은 현재 그런 슬롯이 아니다.

#### Q7. AgentInterface 자체가 라이브러리인가?

정확히는 **`@openuidev/react-ui` 라이브러리가 제공하는 React 컴포넌트**다. `llm`으로 채팅 통신을 연결하고, `componentLibrary`로 생성형 UI 카탈로그를 연결하며, 기본 채팅 화면을 구성한다.

#### Q8. createLibrary의 root가 왜 "Card"인가?

이 예제는 AI 응답 전체를 하나의 카드 안에 세로로 배치하도록 설계했다. `root: "Card"`는 `defineComponent`의 `name: "Card"`를 가리킨다.

```text
root = Card([header, table, chart])
```

React 페이지 전체의 최상위나 `AgentInterface`의 루트를 뜻하지 않는다. **생성된 OpenUI 응답의 최상위 컴포넌트**다. 다른 레이아웃을 원하면 별도의 컨테이너를 정의·등록하고 루트, 허용 자식 타입, 관련 프롬프트 규칙을 함께 조정할 수 있다.

#### Q9. AgentInterface는 커스터마이징 가능한가?

가능하다. 이름·로고·테마 등의 props, 지원되는 composition 슬롯, 메시지 렌더러 교체 API를 제공한다.

| 변경 대상 | 연결 방식 |
| --- | --- |
| 이름·로고·테마 | `agentName`, `logoUrl`, `theme` |
| LLM 통신 | `llm` |
| AI 응답 UI | `componentLibrary` |
| 사이드바·입력창·대화 상단 등 | `Sidebar`, `Composer`, `ThreadHeader` 등 지원 슬롯 |
| 개별 메시지 렌더링 | `components.AssistantMessage`, `components.UserMessage` |
| 도구 활동 타임라인 | `components.ToolCallTimeline` |

커스텀 assistant 메시지를 직접 지정하면 기본 카탈로그 기반 렌더러보다 우선한다. 이 경우 커스텀 구현이 OpenUI 렌더링을 직접 연결해야 한다.

#### Q10. AgentInterface는 headless인가? 기본 디자인이 있는가?

`AgentInterface`는 기본 디자인이 있는 완성형 UI다. 사이드바, 메시지 목록, 입력창, 시작 화면, 테마 등을 제공한다. 디자인 없이 상태·통신 기능을 사용하려면 `@openuidev/react-headless`를 사용한다. 현재 예제는 기본 채팅 화면에 `react-ui`를 사용하고 AI 응답 내부에는 shadcn 카탈로그를 사용한다.

#### Q11. AgentInterface를 완전히 커스터마이징할 수 있는가?

테마와 지원 슬롯으로 많은 부분을 바꿀 수 있지만, 현재 `AgentInterfaceBody`의 바깥 배치와 기본 메시지 목록은 내부 구현에 정해져 있다. 모든 구조를 props만으로 교체할 수 있는 것은 아니다.

채팅 전체를 서비스 요구에 맞게 재구성하려면 `react-headless`로 상태·통신을 연결하고 화면을 직접 만드는 방법이 있다. 기존 `AgentInterface`를 유지하면서 필요한 교체 지점만 라이브러리 소스에 추가하는 방법도 있다. 설치된 `node_modules`를 직접 수정하는 대신, 변경을 유지할 수 있는 소스 수정·패치 방식으로 관리해야 한다.

#### Q12. 특정 메시지를 고정해서 목록 밖, AgentInterface 밖으로 빼낼 수 있는가?

가능한 설계지만 현재 예제에 구현된 기능은 아니다. 고정 상태는 `pinnedMessageIds`처럼 메시지 ID로 관리하고, 원본 메시지를 참조하면 스트리밍 갱신도 반영하기 쉽다. 목록에서 실제로 이동시키려면 고정된 ID를 일반 목록에서 제외해야 한다.

현재 `AgentInterface`는 내부에서 `ChatProvider`를 생성하므로 외부의 형제 컴포넌트가 그 context를 직접 읽지는 못한다. 다음 두 방향을 검토할 수 있다.

- **Portal:** 커스텀 메시지 렌더러가 외부 DOM 영역으로 렌더링한다. React context는 유지된다. 이때 컴포넌트는 여전히 `AgentInterface`의 React 트리에 속하며, 기본 목록의 바깥 래퍼·그룹 표시까지 제거되는지는 추가 처리가 필요하다.
- **상위 상태 공유:** headless 기반으로 `ChatProvider`를 상위에 두고 메시지 목록과 고정 패널을 직접 구성한다. 이때 기존 `AgentInterface`를 그대로 넣으면 내부 Provider가 생기므로, 채팅 화면도 공유 상태를 사용하도록 조립해야 한다.

메시지 재배치 요구가 많다면 두 번째 구조가 적합하다. 두 방식 모두 이 문서에서는 제안이며 실제 동작 검증을 수행하지 않았다.

#### Q13. AgentInterface 하위 모듈들은 큰 편인가?

로컬에서 확인한 소스 줄 수는 다음과 같다. 코드·주석·공백 등을 포함한 파일 규모이며, 번들 크기나 다운로드 용량은 아니다.

| 범위 | 확인한 규모 |
| --- | --- |
| `AgentInterface.tsx` | 523줄 |
| `AgentInterface/Thread.tsx` | 722줄 |
| `Messages` 함수 | 약 50줄 |
| `AgentInterface/` 전체 | TS·TSX·CSS·SCSS 58개 파일, 약 6,365줄 |
| `react-ui/src` 전체 | 같은 확장자 기준 706개 파일, 약 47,394줄 |

`Messages` 자체는 작지만 그룹화, 메시지 렌더링, 도구 타임라인, 스크롤 등 주변 기능과 연결되어 있다. 원하는 부분을 바꾸기 위해 패키지 전체를 복사할 필요는 없다.

#### Q14. Messages와 MessageLoading을 커스터마이징하려면?

`Messages` 자체는 `loader` prop을 받지만, 현재 `AgentInterfaceBody`는 아래와 같이 기본 로더를 고정해서 전달한다.

```tsx
<Messages
  loader={<MessageLoading />}
  assistantMessage={resolvedAssistantMessage}
  userMessage={resolvedUserMessage}
  toolCallTimeline={components?.ToolCallTimeline}
/>
```

현재 `AgentInterface`에는 이 `loader`를 외부에서 지정하는 prop이나 메시지 목록 교체 슬롯이 없다. 다음 코드는 필요한 채팅 context 안에서 직접 조립할 때 사용할 수 있다.

```tsx
<AgentInterface.Messages
  loader={<MyLoading />}
  assistantMessage={MyAssistantMessage}
  userMessage={MyUserMessage}
/>
```

이를 `<AgentInterface>`의 자식으로 넣는 것만으로 기본 목록이 교체되지는 않는다. 기존 화면을 유지하려면 교체 지점을 추가하고, 고정·필터링·재배치까지 필요하면 headless 기반 커스텀 목록을 구성하는 방향을 선택한다.

#### Q15. lang-core, react-headless, react-lang, react-ui의 차이는 무엇인가?

- **`lang-core`:** OpenUI 언어를 파싱·평가하고 명세와 프롬프트를 처리하는 React 독립 엔진.
- **`react-lang`:** 컴포넌트 카탈로그를 정의하고 OpenUI 출력을 React UI로 렌더링하는 연결 계층.
- **`react-headless`:** 채팅 상태, 메시지·스레드, 스트리밍 통신, 저장소 연결을 담당하는 디자인 없는 기능 계층.
- **`react-ui`:** 이 기능들을 활용하는 기본 디자인과 `AgentInterface` 등 완성형 UI.

커스텀 채팅 화면을 만들더라도 OpenUI 렌더링을 포기할 필요는 없다. `react-headless`로 채팅을 구성하고 `react-lang`으로 기존 shadcn 카탈로그를 렌더링하며, 서버의 프롬프트 생성에는 `lang-core`를 유지할 수 있다.


#### Q16. 이미 LangGraph SDK를 사용하는데 @openuidev/react-headless도 반드시 사용해야 하는가? 기능이 겹치지 않는가?

**필수가 아니다. 이미 LangGraph React SDK가 메시지와 스트리밍 상태를 관리한다면, 이를 유지하고 `@openuidev/react-lang`의 `Renderer`만 연결할 수 있다.** 앞선 Q11~Q15에서 제안한 `react-headless`는 커스텀 채팅을 구성하는 한 가지 선택지이며 OpenUI 렌더링의 필수 조건이 아니다.

OpenUI 공식 가이드는 기존 채팅의 메시지 목록·입력창·상태·통신을 유지한 채 assistant 메시지에 렌더러를 연결하는 구성을 지원한다. 자체 컴포넌트만 사용하면 기본 UI 패키지인 `react-ui`도 생략할 수 있다. [공식 Custom chat UI 가이드](https://www.openui.com/docs/build-agents/custom-chat-ui)

##### 어떤 기능이 겹치는가?

먼저 “LangGraph SDK 사용”이 서버/API 클라이언트 사용인지, 브라우저에서 `useStream`으로 상태까지 관리하는 것인지 구분해야 한다. 저수준 API 클라이언트만 사용한다면 React 상태 관리와 화면 연결은 별도로 필요하지만, 그 구현에 반드시 OpenUI headless를 사용해야 하는 것은 아니다.

| 관심사 | LangGraph React SDK / useStream | OpenUI react-headless | OpenUI react-lang |
| --- | --- | --- | --- |
| 메시지·스트리밍 상태 | 담당 | 담당 — 역할이 겹치는 영역 | 입력받은 응답을 점진적으로 렌더링 |
| 메시지 전송·실행 상태 | LangGraph 런타임 연결 | 설정한 ChatLLM·어댑터 연결 | 전송 기능 대신 액션 콜백 제공 |
| 스레드·대화 상태 | LangGraph 스레드와 연결 | 채팅 상태와 저장소 어댑터 제공 | 채팅 스레드를 관리하지 않음 |
| interrupt·checkpoint 등 | 버전과 서버 지원에 따라 LangGraph 실행 의미를 노출 | 일반 스트림 어댑터만으로 동일 기능이 자동 제공되는 것은 아님 | 담당하지 않음 |
| OpenUI DSL → React UI | 별도 렌더러 연결 필요 | 별도 렌더러 연결 필요 | 담당 |
| 폼·생성 UI 액션 | 애플리케이션에서 제출 동작 연결 | 채팅 UI와 연결 가능 | 폼 상태·onAction 제공 |

LangChain 공식 문서는 프런트엔드 SDK가 메시지뿐 아니라 에이전트 상태, interrupt, checkpoint 등을 다루며, UI 라이브러리와 분리해 사용할 수 있다고 설명한다. 따라서 현재 SDK가 담당하는 실행 상태를 그대로 활용하는 설계가 가능하다. [공식 Frontend overview](https://docs.langchain.com/oss/python/langchain/frontend/overview)

##### 이 요구사항에 맞는 구성

메시지 고정과 외부 패널을 직접 구성하면서 이미 LangGraph SDK를 사용한다면 다음 구성을 우선 검토할 수 있다. 이는 두 라이브러리의 역할 분리에 근거한 설계 제안이다.

```text
LangGraph 서버
  ↕ LangGraph SDK / useStream
공유 메시지·실행 상태
  ├─ 커스텀 메시지 목록
  ├─ 고정 메시지 패널 — pinnedMessageIds로 같은 원본 참조
  └─ 입력창·중지·승인 UI
       │
       └─ OpenUI 응답 메시지
            → react-lang Renderer
            → shadcnChatLibrary
```

이 구성에서는 OpenUI의 `ChatProvider`나 `useThread`가 필요하지 않다. 로컬 `react-lang/package.json`의 의존성에도 `react-headless`는 없고, `Renderer`는 `response`, `library`, `isStreaming`, `onAction` 등을 외부에서 받는다. 반면 기존 `AgentInterface`나 headless context를 읽는 메시지 목록을 그대로 사용하면 해당 내부 상태 계층이 계속 필요하다. [로컬 Renderer 구현](../../22-reverse-engineering/openui/packages/react-lang/src/Renderer.tsx), [로컬 패키지 의존성](../../22-reverse-engineering/openui/packages/react-lang/package.json)

아래는 SDK 버전에 종속된 `useStream` 호출을 생략한 **렌더링 연결 예시**다. `content`는 현재 메시지의 누적 OpenUI 텍스트, `isStreaming`은 해당 메시지의 생성 상태이며, 부모가 LangGraph SDK 상태에서 전달한다. `sendMessage`는 기존 SDK 제출 함수에 연결한다.

```tsx
import {
  BuiltinActionType,
  Renderer,
  type ActionEvent,
} from "@openuidev/react-lang";
import { shadcnChatLibrary } from "@/lib/shadcn-genui";

export function GeneratedMessage({
  content,
  isStreaming,
  sendMessage,
}: {
  content: string;
  isStreaming: boolean;
  sendMessage: (text: string) => void;
}) {
  const onAction = (event: ActionEvent) => {
    if (event.type === BuiltinActionType.ContinueConversation) {
      const formValues = event.formState
        ? `\nForm values: ${JSON.stringify(event.formState)}`
        : "";
      sendMessage(`${event.humanFriendlyMessage}${formValues}`);
    } else if (event.type === BuiltinActionType.OpenUrl) {
      const raw = event.params?.url;
      if (typeof raw !== "string") return;
      try {
        const url = new URL(raw, window.location.href);
        if (url.protocol === "https:" || url.protocol === "http:") {
          window.open(url.href, "_blank", "noopener,noreferrer");
        }
      } catch {
        // 유효하지 않은 URL은 열지 않는다.
      }
    }
  };

  return (
    <Renderer
      response={content}
      library={shadcnChatLibrary}
      isStreaming={isStreaming}
      onAction={onAction}
    />
  );
}
```

`onAction`을 기존 전송 함수에 연결해야 follow-up과 폼 제출이 다음 대화로 이어진다. 모델에는 같은 카탈로그의 프롬프트를 제공하고, 일반 텍스트·도구 메시지를 구분하여 OpenUI 응답에만 렌더러를 적용한다. 메시지가 콘텐츠 블록 배열이라면 SDK 버전의 메시지 형식에 맞춰 OpenUI 텍스트를 추출해야 한다. 폼 상태를 재접속 후 복구하려면 `onStateUpdate`와 `initialState`를 애플리케이션 저장 방식에 연결한다. [공식 액션 연결 가이드](https://www.openui.com/docs/build-agents/custom-chat-ui#handle-actions), [로컬 Renderer props](../../22-reverse-engineering/openui/packages/react-lang/src/Renderer.tsx)

##### 함께 사용해야 하는 경우와 상태 관리 주의점

`AgentInterface`의 기본 화면을 유지하고 싶다면 내부의 headless 계층을 사용하게 된다. LangGraph SDK를 전송 계층에 활용하는 구성도 가능하지만, `ChatLLM`이 기대하는 이벤트·메시지 계약으로 연결하는 작업이 필요하다. LangGraph SDK와 OpenUI headless를 동시에 사용한다고 자동으로 상태가 동기화되지는 않는다. OpenUI 공식 문서에서도 Agent Interface는 선택 가능한 채팅 화면이며, 기존 대화 프레임워크가 있으면 렌더러를 추가하는 경로를 안내한다. [Agent Interface 소개](https://www.openui.com/docs/agent/getting-started/introduction)

이미 `useStream`으로 관리 중인 동일 대화를 별도의 `ChatProvider`에서도 독립적으로 갱신하면 메시지 중복, 스트리밍 상태 불일치, 스레드 전환 동기화 문제가 생길 수 있다. 이중 사용 자체가 금지되는 것은 아니지만, 상태의 기준과 변환 책임을 명시해야 한다. 이번 요구에서는 **LangGraph SDK를 대화·실행 상태의 기준으로 유지하고 OpenUI는 렌더링에 사용하는 구성**이 중복을 줄인다.

##### 버전 및 현재 프로젝트 확인 범위

- 2026-10-18 확인한 최신 LangChain 문서는 `@langchain/react` v1을 중심으로 설명한다. 기존 `@langchain/langgraph-sdk/react`의 `useStream`과 import 경로·메시지 형식·API가 같다고 가정하면 안 된다. 실제 연결 코드는 사용 중인 lockfile 버전에 맞춰야 한다. [공식 React 마이그레이션 안내](https://reference.langchain.com/javascript/langchain-react/migration)
- 이 `Report.md`가 속한 Python 예제의 `frontend/package.json`에는 현재 `@langchain/langgraph-sdk` 직접 의존성이 없고, `src/app/page.tsx`는 `AgentInterface + fetchLLM + agUIAdapter`를 사용한다. 따라서 위 구성은 “이미 LangGraph React SDK를 사용하는 앱”에 대한 답변이며, 이 폴더가 이미 해당 구성을 사용 중이라는 뜻은 아니다.
- 공식 문서와 로컬 소스·의존성을 확인해 작성했다. 예시는 문서용이며 실제 SDK 연결, 타입 검사, 스트리밍·폼·고정 패널 동작 테스트는 수행하지 않았다. 런타임 코드와 의존성은 변경하지 않았다.
