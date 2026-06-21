## 대표 chat bot ux 유저 시나리오
- 1. 하단에 status - 현재 Usage progress bar로 토큰량 확인
- 2. token 사용이 다 된 경우 다음 턴 입력 블락
- chat input 진행 -> agent 응답에서 api  error 발생.  


## 데이터 관점  
- 플랫폼 entity : 플랫폼 이름, 플랫폼 아이디. n개의 유저를 가진다.
- 유저 entity : 어떤 플랫폼에 소속, 유저 아이디, 등급, 토큰 관련 사용량 추적. n개의 usage capability entiry을 가진다.
- usage capability entity : 토큰 사용 총량, 사용된 양. owner_type:플랫폼 수준, user 수준


## API 관점
- langgraph backend API interface정의
- (1) GET: platform/user 별 사용량 전체 총계 데이터
  - 고민 포인트 : 사용량이 애매하게 1%가 남은 경우, 사용자 요청을 받을지 말지 결정. -> 우선 받는다.
- (2) POST: 개별 user 토큰 사용량 데이터 :
  - 고민 포인트 : 아직은 회원가입 같은 절차가 없어서 'user entity' 에 없는 유저라면 새롭게 할당량 부여하고 응답해주기
  - 응답 : platform entity + user entity + usage entity
- (3) PATH: platform 총량 'usage capability entity' 업데이트
- (4) PATH: 개별 user 토큰 사용량 업데이트


## 어드민 유저 시나리오
- 플랫폼 리스트 페이지, 각 플랫폼별 사용자 리스트 확인  
- 사용자 리스트 별 - 등급 확인 , 사용자별 사용량 확인. 토큰량 조절, 리셋.  

UI
- 테이블 : 플랫폼 리스트 페이지는 테이블로 구성  
- nested table : 사용자 리스트 페이지 구성



## 기술스택
- backend api : langgraph + fast api 
- frontend : nestjs + react  