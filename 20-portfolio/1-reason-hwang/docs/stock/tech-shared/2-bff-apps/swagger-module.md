# BFF Swagger와 OpenAPI

`@reason-hwang/bff-apps`는 Nest bootstrap에서 `@nestjs/swagger`로 OpenAPI 문서를 생성한다. [main.ts](../../../../2-bff-apps/src/main.ts)의 `configureSwagger`가 문서의 제목·태그·버전과 URL을 등록한다. JSON의 operationId는 controller 메서드 이름이다.

| 문서 | 로컬 URL |
| --- | --- |
| Swagger UI | `http://127.0.0.1:2980/docs/sec` |
| OpenAPI JSON | `http://127.0.0.1:2980/docs/sec/openapi.json` |
| OpenAPI YAML | `http://127.0.0.1:2980/docs/sec/openapi.yaml` |

문서 경로에는 전역 `/api/sec` prefix가 붙지 않는다. SEC 수집·조회·모델링·iXBRL 경로는 `/api/sec`, Open DART 경로는 `/api/dart`를 사용한다. 현재 API 동작과 지원 범위는 [BFF 문서 지도](INDEX.md)가 연결하는 각 계약을 확인한다.

[설정 서비스](../../../../2-bff-apps/src/shared/config.service.ts)는 `SWAGGER_ENABLED`의 기본값을 `true`로 둔다. `false`이면 세 문서 경로를 등록하지 않는다. Swagger 공개 여부는 해당 업무 API에 대한 접근 제어와 별개다. 포트는 로컬 설정 기준 2980이며, `PORT`와 `APP_PORT`가 모두 없으면 소스 기본값 2801을 사용한다.

## 명세 유지

- controller의 `@ApiOperation`, `@ApiQuery`, `@ApiParam`, `@ApiResponse` 등으로 경로·입력·성공·오류를 문서화한다.
- DTO의 스키마와 예시를 실제 입력 검증과 맞춘다. [Nest CLI](../../../../2-bff-apps/nest-cli.json)의 Swagger 플러그인은 DTO 메타데이터 생성을 보조한다. 요청 검증은 controller와 DTO 인접 검증 코드가 수행한다.
- SSE는 응답 유형 `text/event-stream`, 입력 오류 시 HTTP 400 및 스트림 내부 `error` 이벤트의 의미를 문서화한다. HTTP 200 이후의 진행·종료는 실제 클라이언트나 Bruno로 확인한다.
- 서비스 내부 API 키는 서버 설정에서 주입한다. Swagger에 실제 값이나 요청 예시의 인증 정보를 저장하지 않는다.

## 검증

`pnpm -C 2-bff-apps lint`와 `pnpm -C 2-bff-apps build`로 문서 생성에 쓰이는 빌드를 확인한다. 별도 검증 인스턴스에서 UI와 JSON/YAML 응답, 실제 API prefix, operationId, 파라미터 및 응답을 점검한다.

서버 API 동작 검증은 [Bruno 필수 절차](../../../validation/server-api.md)를 따른다. Swagger의 렌더링과 실제 호출은 목적이 다르므로 사용자 브라우저 검증이 필요한 범위는 [브라우저 검증](../../../validation/business-behavior.md)으로 확인한다.
