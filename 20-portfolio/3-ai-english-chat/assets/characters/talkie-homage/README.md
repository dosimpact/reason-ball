# Talkie 오마주 캐릭터 10종

`catalog.json`은 독자적으로 작성한 게시용 설정 원본이다. [조사·대응표·상세 설정](../../../docs/research/talkie-character-catalog.md)을 참고한다.

현재: 설정10종, Google 이미지10장, Storage/게시10건 완료. 제작 예산10/10회 소진. 충전 전429는 기존검증 원장7/10에 포함되어 있으며, portraits 영수증은 충전 후 성공 결과다. 추가 이미지 생성은 하지 않고 기존 파일과 mock으로 검증한다.

```sh
pnpm characters:check
pnpm characters:generate --key rami-nasser         # 기본 dry-run
# 아래 실제 생성 명령은 실행 이력 예시다. 현재 예산 소진으로 추가 실행 금지:
pnpm characters:generate --key selene-vale --apply --retry-failed
pnpm characters:generate --key rami-nasser --apply
# 나머지도 key를 하나씩 지정. 오류 시 자동 반복하지 않음.
pnpm characters:import                           # 설정 dry-run
pnpm characters:import --apply --owner <catalog-owner-uuid>
```

실제 import는 10장 모두 Google 성공 영수증·프롬프트 hash·파일 hash가 일치해야 시작한다. 기존 카탈로그 소유자의 UUID를 명시하며 서비스 키는 환경파일에서 읽는다. 기존 `character-public` 버킷에 immutable hash 경로로 업로드하고 `create_character_with_version` RPC로 설정/지침/버전/자산을 게시한다. 동일 ID가 이미 있으면 소유자·버전·이미지·설정hash가 모두 같은 경우만 건너뛰고, 다른 값은 덮어쓰지 않는다. 중단 시 성공한 앞부분은 유지하고 재실행으로 이어간다. 전역10건 트랜잭션은 아니다.

참고 사이트 이미지나 mock 이미지를 Google 생성 성공으로 표시하거나 자동 대체하지 않는다. 실제 게시10건 및 재실행10건 unchanged, 공개 이미지hash·게시성격·지침 검증을 완료했다. `pnpm characters:verify`로 생성 비용 없이 다시 확인한다.
