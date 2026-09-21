# 청월당 팩트북 문서 맵

팩트북은 실제 서비스에서 직접 확인한 사실의 원본이다. 의도, 평가, 개선안, 알고리즘 추정은 작성하지 않는다.

현재 상태: 조사 전. 파일에 있는 ID·표 행은 작성 예시이며 확인된 사실이 아니다. 실제 ID는 [사실·증거 원장](09-evidence-register.md)에 등록하고 다른 파일에서 링크로 참조한다.

## 작성 순서

1. [조사 환경과 세션](00-research-sessions.md)
2. [화면·URL 인벤토리](01-screen-route-inventory.md)
3. [행동·상태 전이](02-interaction-state-transitions.md)
4. [문구·배치·구성](03-copy-layout-catalog.md)
5. [이미지·캐릭터 자산](04-visual-asset-character-catalog.md)
6. [상품·가격·결제 노출](05-product-price-payment-facts.md)
7. [반응형·사용자 상태 비교](06-responsive-user-state-comparison.md)
8. [회원·보관함](08-account-library-facts.md)
9. [사주 팩트](saju/INDEX.md)
10. [타로 팩트](tarot/INDEX.md)
11. [사실·증거 원장](09-evidence-register.md)에 증거 연결
12. [커버리지와 미확인 사항](07-coverage-gaps.md)에서 완료 판정

화면·상품마다 [개별 기록 템플릿](../templates/INDEX.md)으로 상세 파일을 추가한다. [이미지 증거 위치](../assets/INDEX.md)는 캡처 원장에서만 관리한다.

## 기록 규칙

- 짧은 UI 문구만 원문으로 기록한다.
- 긴 결과 본문은 제목, 위치, 분량, 구조, 캡처로 기록한다.
- 각 Fact ID는 최소 하나의 캡처 또는 동작 ID를 가진다.
- 개인정보가 노출된 캡처는 가린 사본만 연결한다.
- 관찰하지 않은 내용은 빈칸으로 두지 않고 `미조사`로 표시한다.

## ID

| 접두사 | 의미 |
| --- | --- |
| `FACT-C/S/T` | 공통·사주·타로 관찰 사실 |
| `SC-C/S/T` | 화면 또는 화면 상태 |
| `EL-C/S/T` | 화면 요소 |
| `ACT-C/S/T` | 사용자 동작 |
| `IMG-C/S/T` | 이미지·일러스트·아이콘 |
| `CHR-C/S/T` | 캐릭터 |
| `CAP-C/S/T` | 화면 캡처 |
| `SESSION-` | 연속 탐색 세션 |
