# 2026-10-20 전체 보고서의 사용자 히스토리 전달

- 결정(IUI-003/108): `npm run reports:history`가 실제 업로드 UI로 문서를 전송하고 로컬 복원 페이지를 만든다. 테스트 Chrome과 사용자 Chrome의 저장소가 달라 실제 사용자 프로필에서 추가/복원을 확인했다.
- 보존: 기존 대화 유지, thread ID 중복 방지, 50개 제한과 실패 복구를 적용했다. 서버의 test-set 자동 읽기나 계정 동기화는 추가하지 않았다.
- 당시 검증: MD 8개·HTML 8개 모두 실제 채팅/AI 해설·차트·저장·새로고침 PASS. 사용자 Chrome에 기존 2개+신규 16개=18개를 확인했고, 별도 컨텍스트에서 재가져오기 중복 없음과 기존 메시지 보존을 검증했다.
- 반영·산출물: [IUI-108](../stock/system.md#iui-108-전체-케이스-채팅과-브라우저-히스토리-전달). `frontend/output/validation/chat-history/`와 `frontend/public/local-review/restore.html`은 원문/응답을 포함하는 Git 제외 로컬 파일이다.
- 후속: 원본 식별자는 공개용 표기로 정리했다. 현재 [합성 fixture](2026-10-20-public-sample-data.md) 교체가 기존 브라우저 히스토리를 소급 갱신하지는 않는다.
