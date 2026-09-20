# BFF 로거 기술 설계

> 결정 ID: BFF-LOG-001. 현재 구현을 설명하는 stock 문서.

## 목적과 구현 위치

Nest 시스템 로그와 서비스 로그를 Winston으로 통합한다. 로컬에서는 읽기 쉬운 콘솔 출력, stage·prod에서는 JSON 파일 출력을 사용한다. 별도 Nest 업무 모듈이나 LoggerModule은 만들지 않고 bootstrap에서 `WinstonLogger` 어댑터를 주입한다.

| 파일 | 책임 |
| --- | --- |
| [shared/logger.ts](../../../../2-bff-apps/src/shared/logger.ts) | `createAppLogger()` 팩토리, 포맷·transport·파일 순환 설정 |
| [shared/config.service.ts](../../../../2-bff-apps/src/shared/config.service.ts) | 환경값을 한 번 읽고 검증한 설정 snapshot |
| [main.ts](../../../../2-bff-apps/src/main.ts) | `NestFactory.create(AppModule, { logger: createAppLogger() })` 연결 |
| [run-sec-backfill.cjs](../../../../2-bff-apps/scripts/run-sec-backfill.cjs) | 자동 수집용 Nest 앱에도 같은 로거 적용 |

의존성은 `winston`, NestJS 10 호환 `nest-winston` 1.x다. 상세 설치 버전은 package.json과 워크스페이스 pnpm-lock.yaml이 기준이다.

```text
Nest bootstrap / new Logger(Service.name)
  → nest-winston WinstonLogger
  → Winston format + transport
      local      → Console
      stage/prod → application.log + error.log
```

## 환경 선택과 설정

환경 선택 우선순위는 `APP_ENV` → `NODE_ENV` → `local`이다. `.env`는 기존 dotenv 설정으로 읽는다. 빈 문자열이나 알 수 없는 환경값은 유효한 환경으로 취급하지 않는다.

| 입력 환경 | 정규화 결과 | 출력 | 기본 LOG_LEVEL |
| --- | --- | --- | --- |
| local / development / test | local | 콘솔 | debug |
| stage / staging | stage | JSON 파일 | info |
| prod / production | prod | JSON 파일 | info |

| 변수 | 기본값 | 의미 |
| --- | --- | --- |
| APP_ENV | NODE_ENV 또는 local | 출력 환경 선택 |
| LOG_DIR | ./data/logs | 파일 출력 경로. 실행 cwd 기준 절대경로로 변환 |
| LOG_LEVEL | 환경별 위 표 | Winston 로그 레벨 |

허용 레벨은 `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`다. 환경이나 레벨이 잘못되면 설정 생성 단계에서 실패한다. 설정 변경 후에는 프로세스를 재시작해야 한다. `LOG_DIR` 기본값은 `DATA_DIR`와 독립적이므로 DATA_DIR을 변경해도 자동으로 이동하지 않는다.

## 출력과 보관

로컬은 timestamp와 `nestLike('BFF')` 포맷을 사용하고 색상·context를 표시한다. File transport를 생성하지 않는다.

stage·prod는 timestamp와 JSON 포맷을 사용한다. 메시지, 레벨, context, 전달된 오류 stack 등의 필드를 기록한다. 로거 생성 시 LOG_DIR을 재귀 생성하므로 실행 계정에 해당 경로 쓰기 권한이 필요하다.

| 파일 | 내용 | 순환 정책 |
| --- | --- | --- |
| application.log | 설정 레벨에서 허용하는 일반·경고·오류 로그 | 파일당 10 MiB, 최대 5개 |
| error.log | error 레벨 로그 | 파일당 10 MiB, 최대 5개 |

Winston File transport의 `maxsize`, `maxFiles`, `tailable`을 사용한다. 날짜별 보관이 아닌 크기 기반 순환이다. info 기본 설정에서는 오류가 두 파일에 함께 기록된다. 일반 LOG_LEVEL과 별도로 error transport의 레벨은 error로 지정되어 있다. 로그 한 건이 큰 경우를 포함하므로 파일 크기 설정을 엄격한 디스크 사용량 상한으로 간주하지 않는다.

여러 프로세스가 같은 파일을 동시에 순환시키는 구성은 지원을 검증하지 않았다. API 서버와 별도 자동 수집 프로세스를 함께 운영하면 각 프로세스의 LOG_DIR을 분리한다. 로그 파일을 저장소에 커밋하지 않는다. 기본 data/는 gitignore 대상이다.

## 서비스 사용법

기존 Nest Logger 사용 방식을 유지한다.

```ts
import { Logger } from '@nestjs/common';

private readonly logger = new Logger(CompanyService.name);

// Nest의 log는 Winston info에 대응한다.
this.logger.log('Company synchronization completed');
this.logger.warn('SEC request will be retried');
this.logger.error('Company synchronization failed', error.stack);
```

서비스별로 Winston 인스턴스나 파일 transport를 다시 만들지 않는다. 토큰·DB 연결 문자열·요청 본문 전체·공시 원문은 로그에 넣지 않고, 필요한 식별자와 집계 결과만 기록한다. 현재 구현에는 자동 비밀값 마스킹이 없으므로 호출부에서 안전한 메시지를 구성해야 한다.

## 실행 예시

아래 명령은 `2-bff-apps` 디렉터리에서 실행한다.

```sh
# 로컬 콘솔
APP_ENV=local pnpm dev

# 배포용 빌드는 한 번 수행
pnpm build

# stage 또는 prod 중 해당 환경에서 하나를 실행
APP_ENV=stage LOG_DIR=./data/logs/stage pnpm start
APP_ENV=prod LOG_DIR=./data/logs/prod pnpm start

# 파일 확인
tail -f data/logs/stage/application.log
```

`pnpm start`는 NODE_ENV=production을 설정한다. APP_ENV가 명시되어 있으면 그 값이 우선하므로 `.env`의 APP_ENV=local이 배포 환경을 덮어쓰지 않도록 확인한다.

## 적용 범위와 현재 한계

- Nest 부팅·라우팅·기존 서비스 Logger 호출에 적용된다.
- 모든 HTTP 요청의 경로·상태 코드·응답 시간을 기록하는 접근 로그는 아직 없다.
- 백필 SSE progress를 로거가 자동으로 기록하지 않는다. 자동 수집 스크립트의 `DATA_DIR/runs/*.sse`는 별도 실행 기록이다.
- `console.log/error`를 전역으로 가로채지 않는다. 자동 수집 스크립트의 진행 출력은 stage·prod에서도 콘솔에 남을 수 있다.
- 셸이 콘솔 출력을 dev-server.log로 리다이렉션한 것은 Winston File transport와 별개다.
- 파일의 Loki 전송, 요청 ID 자동 연결, 다중 프로세스 파일 잠금, 로그 쓰기 실패 시 대체 출력은 추가 구현되지 않았다.

## 검증과 참고

실제 Nest application context에서 Logger 호출을 발생시켜 local 콘솔 전용 출력, stage·prod JSON 파일 생성, context 보존과 error 분리를 확인했다. 환경 별칭·우선순위·잘못된 설정 거부 및 기존 테스트도 검증했다. 실행 증거는 [Winston 구현 기록](../../../flow/2026-09-20-bff-winston-logger.md)을 참조한다.

- [디렉터리 정책](directory-policy.md)
- [Nest 공식 로거 문서](https://docs.nestjs.com/techniques/logger)
- [nest-winston 공식 저장소](https://github.com/gremo/nest-winston)
- [Winston 공식 저장소](https://github.com/winstonjs/winston)
