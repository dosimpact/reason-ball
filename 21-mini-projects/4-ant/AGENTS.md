# Cat Atelier 작업 규칙

- stock 설계는 docs/stock, dated 기록은 docs/flow. 구현과 검증 결과를 구분한다.
- src/app → widgets → features → entities → shared 의존 방향. public index로 slice 접근.
- 게임 계산은 entities/game의 순수함수. 시간과 난수를 명시적으로 전달한다(SLAP).
- Phaser Scene/단일 게임 루프, 브라우저 저장, 네이티브 광고는 I/O 경계다. 고양이마다 React DOM 노드를 만들지 않는다.
- 웹과 모바일은 같은 엔진을 사용한다. 모바일 HTML은 build:mobile로 생성하며 직접 수정하지 않는다.
- 광고 개발은 테스트 ID만 사용하고 earned reward 확인 전에 보상을 지급하지 않는다.
- 테스트 서버는 strictPort와 소유 프로세스를 사용한다. 다른 서비스나 원본 worktree를 변경하지 않는다.
