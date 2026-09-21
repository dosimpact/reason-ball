planner-mcp을 만드는것이 목적이다. 아래 use case들을 모두 충족해야 한다.  

[문서관리 기능]  
- 사용자는 문서 템플릿을 관리할 수 있다.  
- 사용자는 문서 템플릿을 어떻게 ai가 사용하는지 지침을 관리할 수 있다.  
- 문서 템플릿은 여러가지 문서 형태로 확장 가능하다.  
- 문서 템플릿은 기본적으로 마크다운 형태, mermaid 를 지원한다. ( 추후 graph view, react flow diagram view 등 지원할 예정이다. )  
- 결과물 : 
    - 데이터 : 문서 템플릿 + 문서 사용 프롬프트  
    - UI : 문서 템플릿 viewer, example viewer, prompt management  
    - API interface : REST API, MCP 
      - 문서 템플릿 리스트 조회, 문서 템플릿 조회 by template name 

