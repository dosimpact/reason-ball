내가 검증하고 싶은것 

(1) chat에 '공급업체 ooo 리포트 생성해줘' 라고 하면  canvas 형태의 ui가 스플릿 되면서.  report 가 나오는거야. 이때 ai가 엄청 똑똑하게 intelligent ui를 최대한 활용해서 시각화를 하는거지 
(2) canvas 에서는 pdf로도 다운받을 수 있다. 단 report가 렌더러를 통해서 결과가 나오도록 해야하. ( pdf 다운은  사실 크롬 기능을 활용해도 좋고 ) 
(3) 아래 시나리오를 커버하면 된다. 1, '공급업체 ooo리포트 생성해줘' -> langgraph 메인 에이전트  -> langgraph의 서브에이전트로 라우팅  -> canvas ui Open custom event -> frontend canvas open -> canvas 생성 -> sse event 발행 ( openUI의 스펙을 따르는 별도의 이벤트들이 특정 채널로 쏜다. ) -> ui에서 canvas channel에서 커스텀 이벤트 소비 ( 그 이벤트가 AG UI든 그냥 커스텀 이벤트든 ... transport layer는 상관없어  ) -> open ui의 렌더링을 거쳐서 canvas에 표기된다.
(4) 리포트 다시 만들어줘 -> (3)의 report 제거하고 다시 만든다. ( thread id 당 1개의 report )
(5) 리포트의 특정 부분 드래그 -> chat에 물어보기 -> chat에 인용된 badge 표기 -> chat질문 가능 -> langgraph상태에서 report 상태와 함께 llm call -> 사용자는 답변을 받는다.  
(6) pdf download 지원, web publish link 지원 ( 렌더러 포함 ) -> report id만 가지고 볼 수 있는 화면 