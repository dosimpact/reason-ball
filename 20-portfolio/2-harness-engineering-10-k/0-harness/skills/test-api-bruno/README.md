


실행 방법 (TUI)

1. 전체 테스트 실행 (기본)

cd /Users/dokim639/Workspaces/poc-projects/chat-widget-poc/apps/nestjs-bff-gw/bruno-api-tests
bru run -r --env local

2. todos 폴더만 실행

bru run todos/ --env local

3. 특정 파일 하나만 실행

bru run todos/create-todo.bru --env local

4. 리포트까지 생성하면서 실행

bru run -r --env local \
  --reporter-json ./reports/results.json \
  --reporter-html ./reports/results.html


  ---

# Bruno GUI 앱 설치 (cask)

brew install bruno

## Bruno GUI 앱 실행

Bruno 앱 실행 후 "Open Collection" 클릭
경로 선택: /Users/dokim639/Workspaces/poc-projects/chat-widget-poc/apps/nestjs-bff-gw/bruno-api-tests

## environment 활성화

local 선택 -> baseUrl 환경 변수 먹음  
