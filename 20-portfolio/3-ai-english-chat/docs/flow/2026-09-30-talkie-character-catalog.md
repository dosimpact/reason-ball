# 2026-09-30 Talkie 오마주 캐릭터 제작

## 요청과 조사

사용자 요청: Talkie 페이지·인기 캐릭터 스냅샷,10개 오마주 설정, Google 이미지 생성, Supabase Storage 등록 및 `/characters`의 "나와 잘 맞는 대화 상대"에 추가. 기존 작업은 원본 reason-ball의 docs에도 기록.

[조사·설계10종](../research/talkie-character-catalog.md), [캡처](evidence/2026-09-30-talkie-catalog/README.md). 인기 선정은 현재 홈 추천 노출과 표시 지표이며 전역 순위 주장이 아니다. 공개 소개·첫 인사·이미지 분위기만 확인했다.

## 현재 구현

- `assets/characters/talkie-homage/catalog.json`: 성격·관계·배경·말투·목표·학습수준·첫 인사·예시·이미지 프롬프트10종, 고정 UUID.
- `scripts/characters/generate-portraits.mjs`: Google1회 요청, 사전예산예약·실패영수증·성공hash, 자동재시도 없음.
- `scripts/characters/import-catalog.mjs`: 전체10장 사전검증 → 기존 character-public 업로드 → 기존 create_character_with_version RPC. 덮어쓰기 대신 동일내용 재개·불일치 중단.
- 기존 DB 목록/UI를 사용하므로 dummy 카드를 추가하거나 실제 인기도를 조작하지 않는다.

## 검증과 중단 조건

- 공개 bucket/기존 character 조회200. 현재 게시 캐릭터는 Mina1개. 기존 미션 카탈로그의 non-null owner가 존재함을 확인했다. 임의 계정 생성이나 소유자 변경 없음.
- 카탈로그10종 필드·중복ID·게시 prompt 매핑검사 PASS.
- `pnpm characters:check`, 생성 dry-run PASS.
- 누락 이미지가 있을 때 import apply가 원격 HTTP0회로 중단하는 검사 PASS.
- 첫 이미지 Selene Vale: 실제 Google interactions 요청429, 생성0장. 기존 원장6→7/10으로 기록. 원본과 worktree Gemini key 동일 확인, 값은 출력하지 않음.
- 이후 사용자가 이번 제작용 별도 최대10회 승인. production-budget0/10, 최초실패는 기존원장에 유지. 결제/할당량 변경 확인 대기이며 추가 유료 호출 없음.
- 실제 Google 성공·Storage 업로드·DB 게시·브라우저10개 노출은 미완료. 대체 이미지로 완료를 꾸미지 않음.

## 문서 동기화

원본 checkout은72e39dd이고 원본 pnpm-lock.yaml은 기존 수정 상태다. 원본 코드나 lockfile은 건드리지 않는다. 사용자가 지정한 원본 docs에 별도 worktree 문서 스냅샷과 종합 인덱스를 제공해 미병합 구현과 원본 현재 상태를 구분한다. 시스템·비즈니스·테스트 저량에는 제작 준비와 실제 게시 미완료를 명시한다.

## 충전 후 최종 결과 (같은 날 후속 기록)

사용자가 크레딧 충전을 알린 뒤 별도 제작예산으로 재개했다. 최초1장 확인 후 나머지9장을 순차 실행해 **10/10회 모두 성공**. 전부 gemini-3.1-flash-image의 JPEG이며 얼굴·구도·성격별 분위기를 시각적으로 확인했다. Sora 원본의 하단 빈 패널은 제품의 기존 portrait crop 밖에 있어 카드 화면에 노출되지 않는 것을 확인했다. 추가 생성이나 이미지 편집 비용은 발생시키지 않았다.

기존 미션 카탈로그 owner `167a686a-786b-4ffb-8fd4-974017e7a4ac`를 사용해 character-public에10개 immutable 객체를 업로드하고 기존 RPC로10개 게시. 기존 Mina/기존자산은 보존했다. 재실행은 전부 unchanged10건. `pnpm characters:verify`로 게시버전·성격·배경·말투·서버지침과 공개이미지hash10건 일치를 확인했다.

Docker localhost3325에서 카드11개·신규이미지10개decode·가로overflow없음·console error0. PC 및390px 캡처, Selene 상세와 실제 대화1턴 확인. 입력은 스트레스 받은 하루를 영어로 표현하는 도움 요청이며, 응답에 dark gray 색채비유·감정표현 예문·질문하나가 나와 설정 반영을 확인했다. 이는10종 전체 응답품질 검증은 아니다. 검증용 대화ID8c63b334-3833-472e-aefb-8aa451bcda6b만 캐릭터ID를 대조해204 삭제했다.

[PC목록](evidence/2026-09-30-talkie-catalog/published-desktop.png), [모바일목록](evidence/2026-09-30-talkie-catalog/published-mobile.png), [상세](evidence/2026-09-30-talkie-catalog/published-selene-detail.png), [실제대화](evidence/2026-09-30-talkie-catalog/published-selene-chat.png).

최종: 기존 검증이미지7/10, 제작이미지10/10, 실제영상0/5. 이번 이미지 추가생성은 종료하며 이후mock/저장파일로만 검증한다.

공개 `/api/characters`200 응답에서 신규10개·전체11개·공개이미지URL을 재확인하고 [게시 manifest](evidence/2026-09-30-talkie-catalog/published-catalog.json)를 저장했다. 변경파일 서버비밀값 검색0건·diff whitespace검사 PASS. 원본 docs에는 신규 조사/검증/증거93개와 별도 저량스냅샷3개를 동기화했고 기존 유량은 보존했다. 원본 README와 저량에는 미병합 코드와 공유DB게시 상태를 구분해 안내했다.
