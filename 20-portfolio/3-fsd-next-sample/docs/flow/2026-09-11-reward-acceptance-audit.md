# 보상 명시 수용 기준 재대조

범위: REWARD-02/05/06, PROFILE-04. 웹 프로젝트 graph는 미인덱싱이며 실제 source/test와 실행 원장을 직접 대조했다. 최신 99개 전체 실행은 진행 중이므로 그 실행을 근거로 사용하지 않는다.

| ID | 명시 기준 | 현재 근거 | 판정 제안 |
|---|---|---|---|
| REWARD-02 | retry/중복 callback/reload에도 XP와 자산 중복 없음 | reward-preservation.spec.ts:104부터 최초 완료 세 요청 실전송, 신규1/재호출2 및 같은 결과; 이후 반복 완료와 reload 뒤 단일 unlock, beforeXp + 지급값. 원장의 concurrent-completion 1 PASS/30.7초, 후속 profile-counts 2 PASS/49.5초. | VERIFIED 승격 근거 충족. 테스트에 없는 임의 동시성 전체 조합은 이 ID의 필수 조건이 아님. |
| REWARD-05 | 프로필에서 획득 근거와 원본 재열람 | reward-preservation.spec.ts의 프로필 보상 탭, 게시 당시 미션 제목, 실제 background 원본 네트워크 응답 바이트 일치와 Image.decode, archive 후 반복. reward-gallery 1 PASS/27.7초와 후속 profile-counts 실행. | VERIFIED 승격 근거 충족. 수동 PNG는 표시/Storage 증거이며 AI 생성·이미지 품질 증거가 아님. |
| REWARD-06 | 원본 미션/캐릭터 archive 뒤 획득 정책 유지 | 제작자와 학습자 분리; 두 자원 archive 뒤 동일 assetId/unlockId·원본·컬렉션·XP 유지, 타인404, archived 미션 discovery404. 위 후속 실제 실행. | VERIFIED 승격 근거 충족. hard delete와 관리자 강제 삭제는 해당 archive 기준과 다름. |
| PROFILE-04 | 해금 이미지, 잠긴 이미지, 획득 근거 표시 | 같은 테스트가 프로필 해금 이미지/근거를 확인하나 locked 실루엣 확인은 미션 상세 화면에서 수행됨. | PARTIAL 유지. 프로필 안의 locked 항목을 별도로 검증해야 함. |

현재 전체 실행 종료 후 해당 테스트의 최신 결과와 함께 주 검증 원장의 분류를 갱신한다. 테스트 수와 요구사항 ID 수는 서로 다른 단위다.
