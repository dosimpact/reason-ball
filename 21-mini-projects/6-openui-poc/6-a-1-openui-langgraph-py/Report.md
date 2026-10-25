


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
