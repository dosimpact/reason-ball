# 25 push_ui_message chat — UI-PUSH-CHAT-25

## Scope and graph

Use `PushUIState(MessagesState)` with the built-in message reducer for chat history.
Input is only `messages: [{id, role: "user", content}]`. Preparation unconditionally generates a fresh Assistant UUID and persists an empty Assistant turn. The frontend renders that streamed placeholder; final generation replaces its content using the same ID.

`START → prepare_prompt → search_data_llm_call_with_push_ui_message → collect_data_llm_call_with_push_ui_message → complete_data_llm_call_with_push_ui_message → generate_final_answer → END`.

The three internal nodes each invoke `create_llm("fast")` on fixed dummy material and the conversation context. They emit `thinking_status` before the call and update its status afterward using the same ID and `merge=True`. Titles are `데이터 검색중`, `자료 취합중`, and `자료 완성중`. Short public progress summaries are stored in `stage_results` and pushed as UI props, separate from chat messages. Each summary describes the stage result, not private reasoning. A fourth model call generates the final answer. No real external search occurs.

Each turn has a fresh assistant ID. Work/stage UI IDs derive from that ID, without separate workflow state. The work lifecycle UI (ordinal 0) and all three stage UI messages reference the same assistant ID through `metadata.message_id`. Work starts with `작업 착수`, reports final-answer preparation after stage 3, and completes when the answer is ready. Final status becomes completed only after the answer is generated. A failed stage emits failed UI, marks the empty Assistant placeholder as failed, persists an error/status update, and routes to END. Final model failures follow the same path. Empty Assistant placeholders are filtered out of every model input, including placeholders from previous failed turns.

## Frontend and SDK

The default view is a chat with a composer, actual submitted messages, progress UI, and final answers. Reuse the same LangGraph thread for subsequent messages; New chat resets the local view and creates a thread on the next send. Stream `updates` and `custom`, merging messages and UI by ID. Render short stage summaries inside attached progress UI, never as separate Assistant replies. Keep empty placeholders when normalizing state and merge the final answer into the existing turn by ID. Existing history and UI stay visible across turns. Diagnostics (state and raw stream) are collapsed by default. Unsupported UI names fall back to JSON.

## Acceptance

- Three ordered internal LLM calls precede the final answer call.
- Custom progress appears while each call is running and updates in place.
- A submitted user message is stable when the composer changes.
- Follow-up messages reuse the thread, preserve history, and create fresh progress IDs.
- One Assistant bubble is created from the preparation update and retained through work start, three progress summaries, and final answer. Successful two-turn state contains exactly two Human and two AI messages.
- Empty placeholders are excluded from LLM context; failed bubbles survive later turns.
- Stage failures show an error and do not present a completed answer.

References: [MessagesState](https://reference.langchain.com/python/langgraph/graph/message/MessagesState), [push_ui_message](https://reference.langchain.com/python/langgraph/graph/ui/push_ui_message).

---

## 한국어

`MessagesState` 기반 채팅으로 사용자 입력과 최종 응답을 `messages`에 저장한다. 사용자 입력 후 3개의 `llm_call_with_push_ui_message` 노드를 순차 실행하고 마지막 LLM 호출로 응답한다. 각 내부 호출은 더미 자료를 처리하며 `데이터 검색중`, `자료 취합중`, `자료 완성중` UI를 표시한다. UI는 같은 ID로 실행 중/완료/실패 상태를 갱신한다. 내부 처리 요약은 `stage_results`에 저장하며 채팅 답변으로 표시하지 않는다.

프런트엔드는 같은 thread에서 대화를 이어가며 입력창, 제출된 사용자 메시지, 단계 UI, 최종 응답을 제공한다. 상태와 원시 스트림은 접힌 상세 영역에 둔다. 새 대화는 로컬 표시를 초기화하고 다음 전송 시 새 thread를 생성한다. 실제 검색은 수행하지 않는다. 승인 기준은 3단계 순서, UI 갱신, 다중 턴 대화 유지, 단계 실패 표시와 최종 응답 순서이다.

1턴 표현: 프런트엔드는 사용자 메시지만 전송한다. `prepare_prompt`가 매 턴 새 UUID와 빈 Assistant 메시지를 만들고 프런트엔드는 그 업데이트를 표시한다. 작업 착수 UI, 3단계의 짧은 진행 요약, 최종 답변을 한 Assistant 버블 안에 표시한다. 내부 호출용 HumanMessage는 공개 messages에 추가하지 않는다. 빈 Assistant 메시지는 LLM 입력에서 제외하며 최종 답변은 같은 ID로 교체한다. 실패 시 해당 버블에 중단 상태를 저장하고 후속 호출을 멈춘다.

## UI-PUSH-STATE-25: minimal state

`messages` stores user inputs and Assistant responses/placeholders. `ui` stores progress cards. `assistant_message_id` identifies the active turn; `stage_results` feeds the later model calls; `final_status` controls routing and frontend completion; `error` displays the failure reason in the frontend. Removed redundant `answer`, `final`, `ui_render_status`, and `workflow_id` state fields.

최소 상태: messages(대화), ui(진행 화면), assistant_message_id(현재 턴 연결), stage_results(다음 호출 문맥), final_status(실행 분기/완료 판정), error(화면 오류 표시)만 유지한다. 최종 답변은 messages에만 저장하고 UI ID는 Assistant ID에서 파생한다.

## Explicit graph connections

Declare each node with add_node and every connection with add_edge/add_conditional_edges. Do not derive connections from a node tuple, indices, or loops. route_after_stage provides the shared failed/continue decision; each conditional edge explicitly names its destination.

그래프 노드와 연결은 이름으로 개별 선언한다. 튜플 인덱스나 반복문으로 다음 노드를 결정하지 않는다. 실패 분기 판단은 route_after_stage를 공유하며 목적지는 각 연결에서 명시한다.

## Progress types

ThinkingStatusProps defines the full thinking_status payload; ThinkingStatusUpdate = Partial<ThinkingStatusProps> defines merge patches. Validate full/partial incoming payloads with the existing Zod dependency and narrow merged messages before rendering. Metadata fields are explicitly typed.

thinking_status의 전체 props는 ThinkingStatusProps, 일부 갱신은 ThinkingStatusUpdate로 정의한다. 수신 값은 Zod로 검증하고 병합 후 타입 가드로 렌더러에 연결한다.

## Compact progress list

Display work start and stage updates as ul/li rows inside the Assistant bubble, with small state icons and inline title/status/summary. Avoid separate bordered cards. Long summaries wrap naturally.

작업 착수와 각 단계는 Assistant 버블 안의 간결한 목록으로 표시한다. 아이콘, 단계명, 상태, 요약을 한 항목에 배치하며 긴 내용은 줄바꿈한다.

## Collapsible work history

Wrap each Assistant turn's progress list in native details/summary labeled 작업 과정, closed by default. Users can toggle it with mouse or keyboard; streamed updates must preserve their choice. Keep final answer content outside the disclosure.

작업 과정 목록은 기본 접힘 상태이며 사용자가 턴별로 열고 닫는다. 최종 응답은 접힘 영역 밖에 표시한다.

## Component-name state types

ThinkingStatusMessage pairs name: "thinking_status" with props: ThinkingStatusProps. ThinkingStatusUpdateMessage pairs the same name with partial props and merge=true. React state contains complete typed messages or a separate unsupported-message fallback; stream patches are merged and validated before state storage.

name과 props를 하나의 메시지 타입으로 묶어 상태에 적용한다. 부분 갱신은 병합/검증 후 완성된 메시지로 저장하며 지원하지 않는 이름은 별도 fallback 타입으로 관리한다.
