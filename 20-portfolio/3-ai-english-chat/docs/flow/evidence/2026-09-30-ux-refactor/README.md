# Chrome 화면 점검 자료 — 2026-09-30

실행 중인 `localhost:3000`을 Chrome으로 직접 조작해 기록했다. 13개 페이지 템플릿의 대표 화면을 포함한다. 모든 데이터 조합·오류 상태의 시각 검증을 의미하지 않는다. production 빌드 E2E 결과는 별도 테스트 기록을 따른다.

기본 캡처는 데스크톱 다크 테마다. `*-light`는 라이트 테마 비교 자료이며 `before/`는 변경 전 기록이다. 소유한 점검 계정·가상 콘텐츠를 사용했다.

## 페이지

| 경로 | 최종 캡처 |
| --- | --- |
| `/` | [home](after/home.jpg) |
| `/characters` | [characters](after/characters.jpg) |
| `/characters/[id]` | [character-detail](after/character-detail.jpg) |
| `/characters/new` | [character-new](after/character-new.jpg) |
| `/characters/[id]/edit` | [character-edit](after/character-edit.jpg) |
| `/missions` | [missions](after/missions.jpg) |
| `/missions/[id]` | [mission-detail](after/mission-detail.jpg) |
| `/missions/new` | [mission-new](after/mission-new.jpg) |
| `/missions/[id]/edit` | [mission-edit](after/mission-edit.jpg) |
| `/chat/[characterId]` | [chat](after/chat.jpg) |
| `/history` | [history](after/history.jpg) |
| `/profile` | [profile](after/profile.jpg) |
| `/shared/[token]` | [shared](after/shared.jpg) |

게스트 공개 미션의 [전체 목록](after/missions-guest.jpg)도 확인했고, 다음 버튼으로 2페이지 전환을 확인했다.

## 탭·단계·대화상자

다음 캡처는 페이지 안의 추가 상태를 기록한다.

- [account-dialog](after/account-dialog.jpg)
- [artifact-panel](after/artifact-panel.jpg)
- [character-edit-step2](after/character-edit-step2.jpg)
- [character-edit-step3](after/character-edit-step3.jpg)
- [chat-management](after/chat-management.jpg)
- [mission-chat-light](after/mission-chat-light.jpg)
- [mission-chat](after/mission-chat.jpg)
- [mission-edit-step2](after/mission-edit-step2.jpg)
- [mission-edit-step3](after/mission-edit-step3.jpg)
- [mission-hints](after/mission-hints.jpg)
- [profile-creations](after/profile-creations.jpg)
- [profile-expressions](after/profile-expressions.jpg)
- [profile-favorites](after/profile-favorites.jpg)
- [profile-notebook](after/profile-notebook.jpg)
- [profile-rewards](after/profile-rewards.jpg)
- [profile-saved](after/profile-saved.jpg)
- [profile-settings](after/profile-settings.jpg)
- [shared-light](after/shared-light.jpg)

이미지는 실제 브라우저 캡처이며 합성하지 않았다. 편집 3단계의 고정 헤더 위치는 캡처 당시 스크롤 상태를 반영한다.

점검 후 브라우저에서 로그아웃하고 점검 계정 소유의 대화·미션·캐릭터·Storage 및 Auth 계정을 정리했다. 다른 사용자의 데이터는 정리 대상에 넣지 않았다.
