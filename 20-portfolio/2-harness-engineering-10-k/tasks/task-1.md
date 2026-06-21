추가했으면 하는 기능  
- [ ] react 작업, next 작업, nest 작업 모드로 전환 
- [ ] best practices을 중간에 추가해서 확장 가능한지..  


- 직접 mcp을 호출하기 보다는 스킬을 사용해서 mcp을 호출할 수 있도록 한다.  


---
변경 사항 
- 스킬 삭제 : desktop-app, mobile-app 삭제  
- 스킬 추가 : nestjs best practices  


1, Master docs 컨텍스트 엔지니어링 (저량)  
- 데이터는 2가지 속성을 가진다 유량과 저량 
- Master docs는 현재 프로젝트의 모든 메타데이터를 보관하는 저량의 속성이다.  
- 반면 Feature개발에 사용하는 Iteration에는 저량 성격의 데이터가 필요하다. (한번 이터레이션을 돌고나면 저량 데이터에 보관.)  


2, PDCA docs 컨텍스트 엔지니어링 (유량)  
- Feature 개발은 아래의 싸이클을 돈다.  
- plan -> design -> analysis -> report 각 단계에 필요한 컨텍스트는 master docs을 참고 할 수 있다. 
- 각 단계에서 skill을 추가할 수 있다. 
  - 예) Plan : 
  - 예) Design : 
  - 예) Analysis :
  - 예) Report : 


3, 개발 모드을 자동화 할 수 있으나 ... 
- 온보딩과 별도의 스킬을 개발자가 직접 만드는 방향으로 유도하는게 필요하다. (적어도 이정돈 하자... )   

