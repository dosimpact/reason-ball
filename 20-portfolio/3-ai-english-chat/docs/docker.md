# Docker 빌드와 로컬 실행

Node22+, pnpm10.33.4, 실행 중인 Docker Engine/Desktop이 필요하다. 이 프로젝트 디렉터리에서 실행한다.

```sh
pnpm docker:build
pnpm docker:up
# http://localhost:3325
pnpm docker:logs
pnpm docker:down
```

`docker:up`은 이미 빌드한 `lingua-web:local` 이미지를 실행한다. 소스 변경 후에는 `docker:build` → `docker:down` → `docker:up` 순서로 재배포한다. 같은 이름의 컨테이너가 있으면 자동 삭제하지 않고 실패한다. `docker:down`은 소유 라벨이 있는 지정 컨테이너만 종료·제거하며 볼륨, 이미지, 다른 서비스를 삭제하지 않는다.

## 환경변수

기본 파일은 `apps/web/.env.local`이며 파일을 수정하거나 이미지에 포함하지 않는다. 따옴표가 있는 값은 Node의 dotenv parser로 읽는다. `$VAR` 텍스트 치환은 지원하지 않으므로 환경파일 값은 완성된 문자열을 사용한다. 셸에서 같은 이름을 지정하면 파일값보다 우선한다.

- 빌드: 코드에서 사용하는 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_RUNTIME_MODE`, `NEXT_PUBLIC_DATA_PROVIDER`만 전달한다. 공개값은 번들에 고정되므로 변경 시 다시 빌드한다. 새 공개 설정을 추가하면 스크립트 allowlist와 Dockerfile ARG를 함께 갱신한다.
- 실행: 파일의 서버 키·provider 설정을 프로세스 환경으로 전달한다. Docker 명령 인수에는 변수 이름만 들어간다. Docker 관리자 권한으로는 컨테이너 환경을 조회할 수 있으므로 공유 서버에서는 별도 secret 관리가 필요하다.
- 네트워크: `CHATGPT_OAUTH_PROXY_URL`이 localhost/127.0.0.1이면 같은 호스트 서비스에 도달하도록 `host.docker.internal`로 바꾼다. Linux의 loopback 전용 프록시는 추가 네트워크 설정이 필요할 수 있다.
- 서버는 `NODE_ENV=production`, `HOSTNAME=0.0.0.0`, `PORT=3000`으로 실행한다. 외부 localhost 포트를 `APP_ALLOWED_ORIGINS`에 추가한다. 기존 앱 runtime/provider 설정은 유지하며 Playground는 production 정책으로 차단된다.

```sh
DOCKER_PORT=3330 pnpm docker:up
DOCKER_ENV_FILE=/absolute/path/to/env pnpm docker:build
DOCKER_ENV_FILE=/absolute/path/to/env pnpm docker:up
DOCKER_IMAGE=lingua-web:review DOCKER_CONTAINER=lingua-web-review pnpm docker:up
```

변경한 컨테이너 이름은 logs/down에도 동일하게 지정한다. 포트는 기본적으로 호스트127.0.0.1에만 공개한다. 원격 배포·TLS·reverse proxy 구성은 이 로컬 실행 명령의 범위가 아니다.

## 모노레포와 prune

상위 reason-ball workspace가 이 디렉터리를 제외하므로 프로젝트 자체를 build context로 사용한다. 현재 단일 앱에 `turbo prune` 단계를 추가할 이점이 작다. manifest/lockfile 복사 → 설치 → 소스 복사로 의존성 캐시를 분리하고, 최종 이미지는 Next standalone으로 줄인다. 이후 공유 workspace 패키지가 추가되면 COPY 목록과 tracing 경계를 함께 조정하고 프로젝트 내부 Turbo prune 도입을 검토한다. `docker system prune`과는 다른 기능이다.

[설계 및 실행 검증](flow/2026-09-30-docker-build.md)
