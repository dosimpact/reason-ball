# OpenUI 갤러리 이관

- 배경: 기존 OpenUI LangGraph PoC의 전체 예제 갤러리를 Reason Hwang에서도 확인한다.
- 변경: `/open-ui/gallery`에 원본 45개 예제(구성 4·도구 18·프롬프트 4·컴포넌트 19)를 이관하고 `/open-ui`에서 연결했다. 기존 공유 라이브러리와 Renderer를 재사용한다. 예제 도구는 로컬 데이터로 동작하며 원본 MIT 라이선스를 보존한다. 이미지와 지도 경로에 필요한 Wikimedia·OSRM 프록시 3개를 추가했다.
- Stock: [Host OpenUI](../stock/tech-shared/1-fe-host/open-ui.md).
- 검증: 45개 예제 파싱·고유 ID·도구 포함 단위 테스트 47/47, Host typecheck, 변경 파일 ESLint PASS. 별도 Next 서버에서 API Bruno HTTP 6/6 PASS(정상·잘못된 입력). 전체 FSD 검사는 기존 `financial-stories.test.ts`의 shared 내부 경로 import 2건으로 실패했다. 사용자 기존 요청에 따라 브라우저·Storybook은 실행하지 않았다.
- 정리: 작업 소유 Next 서버 PID 58005와 포트 32987, 별도 빌드 출력을 종료·정리하고 잔존 여부를 확인했다. 이미지·지도·YouTube는 외부 네트워크 가용성에 의존하며, 예제의 assistant 전송은 실제 모델 호출이 아닌 알림이다.
