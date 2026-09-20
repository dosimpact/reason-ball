# NestJS Swagger 모듈 사용 가이드

이 문서는 `@reason-hwang/bff-apps`에 적용된 `@nestjs/swagger` 구성을 기준으로, NestJS REST API에서 OpenAPI 명세와 Swagger UI를 생성하고 유지하는 방법을 설명한다.

## 현재 구현 (BFF-DIR-001)

- `/docs/sec`, `/docs/sec/openapi.json`, `/docs/sec/openapi.yaml`; SWAGGER_ENABLED=false로 비활성화.
- 공개 API는 회사 동기화·회사 조회·공시 조회·특정 기업 백필·전체 기업 백필 5개다.
- 백필 POST는 200 text/event-stream. 입력 오류는 스트림 전 400, 실행 오류는 error 이벤트다. 상태 조회 GET과 작업 Entity는 없다.
- 공시 조회는 includeAmendments=true가 기본이며 original/amendments를 반환한다. includeContent=true로 각 본문을 포함한다.
- 아래 일반적인 NestJS 사용 예시는 현재 계약의 추가 API나 모듈을 뜻하지 않는다. 정확한 계약은 [BFF API 명세](../../../../2-bff-apps/src/us-corporate-filings/.docs/api-spec.md)를 따른다.

## 1. Swagger와 OpenAPI의 역할

OpenAPI는 HTTP API의 경로, 파라미터, 요청 본문, 응답 형식, 인증 방법을 기계가 읽을 수 있는 문서로 표현하는 표준이다. Swagger UI는 OpenAPI 문서를 사람이 탐색하고 직접 호출할 수 있게 보여주는 웹 화면이다.

NestJS에서 `@nestjs/swagger`는 다음 정보를 조합해 OpenAPI 문서를 생성한다.

- `@Controller()`, `@Get()`, `@Post()` 같은 Nest 라우팅 메타데이터
- `@Body()`, `@Query()`, `@Param()`, `@Headers()` 같은 입력 메타데이터
- DTO의 TypeScript 타입과 Swagger 데코레이터
- `@ApiOperation()`, `@ApiResponse()` 계열의 명시적 설명
- 선택적으로 Nest CLI Swagger 플러그인이 컴파일 시 생성하는 DTO 메타데이터

Swagger 문서화는 런타임 입력 검증을 대신하지 않는다. 이 프로젝트는 entity 디렉터리의 DTO 인접 커스텀 Pipe와 request-validation.ts로 요청을 검증한다. 아래 class-validator/ValidationPipe 예시는 대안이며 현재 의존성은 아니다.

## 2. 이 프로젝트의 적용 상태

대상 애플리케이션은 다음 버전을 사용한다.

| 패키지 | 선언 버전 | 역할 |
| --- | --- | --- |
| `@nestjs/common` | `^10.4.15` | NestJS 공통 API와 데코레이터 |
| `@nestjs/core` | `^10.4.15` | NestJS 애플리케이션 런타임 |
| `@nestjs/swagger` | `^7.4.2` | OpenAPI 문서 생성과 Swagger UI 연결 |
| `swagger-ui-express` | `^5.0.1` | Express에서 Swagger UI 정적 리소스 제공 |

현재 관련 파일은 다음과 같다.

| 파일 | 책임 |
| --- | --- |
| `package.json` | Swagger 패키지와 Nest CLI 기반 빌드 명령 관리 |
| `nest-cli.json` | Swagger CLI 플러그인 활성화 |
| `src/main.ts` | OpenAPI 기본 정보 생성 및 문서 URL 등록 |
| `src/us-corporate-filings/us-corporate-filings.controller.ts` | 엔드포인트별 설명, 쿼리, 본문, 응답 선언 |
| `src/us-corporate-filings/entity/company.dto.ts 및 filing.dto.ts` | 요청·응답 스키마와 예시 선언 |
| `.env.example` | Swagger 공개 여부 환경변수 예시 |

## 3. 설치

새로운 NestJS 프로젝트라면 애플리케이션 패키지에서 다음 명령을 실행한다.

```bash
pnpm add @nestjs/swagger swagger-ui-express
```

이 저장소에서는 루트에서 필터를 사용해 설치할 수도 있다.

```bash
pnpm --filter @reason-hwang/bff-apps add @nestjs/swagger swagger-ui-express
```

현재 프로젝트에는 두 패키지가 이미 설치되어 있으므로 다시 실행할 필요가 없다.

## 4. 애플리케이션 부트스트랩

실제 설정은 `src/main.ts`에 있다. 핵심 구조는 다음과 같다.

```ts
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const SWAGGER_UI_PATH = 'docs/sec';
const SWAGGER_JSON_PATH = 'docs/sec/openapi.json';
const SWAGGER_YAML_PATH = 'docs/sec/openapi.yaml';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/sec');

  if (process.env.SWAGGER_ENABLED !== 'false') {
    configureSwagger(app);
  }

  await app.listen(Number(process.env.PORT ?? 2801));
}

function configureSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Reason Hwang SEC API')
    .setDescription(
      'SEC EDGAR company and filing collection endpoints exposed through the BFF.',
    )
    .setVersion('0.1.0')
    .addTag('SEC Collector')
    .build();

  const documentFactory = () =>
    SwaggerModule.createDocument(app, config, {
      operationIdFactory: (_controllerKey, methodKey) => methodKey,
    });

  SwaggerModule.setup(SWAGGER_UI_PATH, app, documentFactory, {
    customSiteTitle: 'Reason Hwang SEC API Docs',
    jsonDocumentUrl: SWAGGER_JSON_PATH,
    yamlDocumentUrl: SWAGGER_YAML_PATH,
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
}
```

`documentFactory`를 전달하면 문서가 실제로 요청될 때 생성된다. `operationIdFactory`는 컨트롤러 메서드 이름을 operationId로 사용하므로 OpenAPI 기반 클라이언트 코드와 Bruno 컬렉션을 만들 때 이름이 예측 가능하다.

기본 포트 `2801`에서 접근 주소는 다음과 같다.

| 용도 | URL |
| --- | --- |
| Swagger UI | `http://localhost:2801/docs/sec` |
| OpenAPI JSON | `http://localhost:2801/docs/sec/openapi.json` |
| OpenAPI YAML | `http://localhost:2801/docs/sec/openapi.yaml` |
| 실제 SEC API | `http://localhost:2801/api/sec/*` |

Swagger 문서 경로는 `app.setGlobalPrefix('api/sec')`의 영향을 받지 않는다. `SwaggerModule.setup()`에 지정한 경로가 애플리케이션 루트에 직접 등록되기 때문이다.

## 5. 실행과 문서 공개 제어

개발 서버를 실행한다.

```bash
pnpm --filter @reason-hwang/bff-apps dev
```

Swagger는 기본적으로 활성화된다. 명시적으로 비활성화하려면 다음 환경변수를 사용한다.

```dotenv
SWAGGER_ENABLED=false
```

운영 환경에서 Swagger UI 또는 OpenAPI 명세를 외부에 공개하면 내부 엔드포인트 구조가 노출될 수 있다. 공개 문서가 필요하지 않다면 운영 배포 환경에 `SWAGGER_ENABLED=false`를 설정한다. 공개해야 한다면 리버스 프록시 인증, 사내 네트워크 제한 또는 별도의 문서 배포 방식을 고려한다.

## 6. 컨트롤러 문서화

### 6.1 태그와 작업 설명

`@ApiTags()`는 Swagger UI에서 API를 그룹화한다. `@ApiOperation()`은 엔드포인트 제목과 상세 설명을 제공한다.

```ts
@ApiTags('SEC Collector')
@Controller()
export class CollectorController {
  @ApiOperation({
    summary: '회사 목록 조회',
    description: 'CIK, ticker, 검색어로 companies 테이블을 조회합니다.',
  })
  @Get('companies')
  listCompanies() {}
}
```

이 프로젝트는 전역 접두사 `api/sec`을 사용하므로 위 메서드의 실제 경로는 `GET /api/sec/companies`이다.

### 6.2 쿼리 파라미터

원시 객체 형태로 `@Query()`를 받을 때는 TypeScript 리플렉션만으로 각 필드를 알 수 없다. 따라서 `@ApiQuery()`로 이름, 필수 여부, 형식, 예시를 명시한다.

```ts
@ApiQuery({
  name: 'limit',
  required: false,
  description: '최대 조회 건수. 기본값 50.',
  example: 50,
})
@ApiQuery({
  name: 'ticker',
  required: false,
  description: '티커 심볼 필터입니다.',
  example: 'AAPL',
})
@Get('companies')
listCompanies(@Query() query: RawQuery) {}
```

쿼리 DTO를 사용한다면 `@ApiQuery()` 반복을 줄일 수 있지만, Swagger 자동화와 런타임 변환·검증을 함께 얻으려면 다음처럼 DTO와 `ValidationPipe`까지 도입해야 한다.

```ts
export class ListCompaniesQueryDto {
  @ApiPropertyOptional({ default: 50, minimum: 1 })
  limit?: number;

  @ApiPropertyOptional({ example: 'AAPL' })
  ticker?: string;
}

@Get('companies')
listCompanies(@Query() query: ListCompaniesQueryDto) {}
```

### 6.3 요청 본문

메서드 인자가 구체적인 DTO 타입이면 Nest와 Swagger가 타입을 연결할 수 있다.

```ts
@Post('filing-sync-jobs')
createFilingSyncJob(@Body() body: FilingSyncJobBodyDto) {}
```

현재 컨트롤러는 호환성과 자체 정규화 로직 때문에 `unknown` 본문을 받는다. 이 경우 타입을 추론할 수 없으므로 `@ApiBody()`로 문서용 DTO를 연결한다.

```ts
@ApiBody({ type: FilingSyncJobBodyDto, required: false })
@Post('filing-sync-jobs')
createFilingSyncJob(@Body() rawBody?: unknown) {}
```

중요한 점은 `@ApiBody()`가 실제 값을 변환하거나 검증하지 않는다는 것이다. 현재 프로젝트의 검증은 컨트롤러 내부 `read*` 메서드가 담당한다.

### 6.4 경로 파라미터와 헤더

경로 파라미터는 `@ApiParam()`, 요청 헤더는 `@ApiHeader()`로 상세 정보를 보강할 수 있다.

```ts
@ApiParam({ name: 'id', example: '0000320193' })
@Get('companies/:id')
findCompany(@Param('id') id: string) {}
```

공통 헤더가 많다면 컨트롤러 또는 사용자 정의 조합 데코레이터에 선언한다.

```ts
@ApiHeader({
  name: 'x-request-id',
  required: false,
  description: '호출 추적용 상관관계 ID',
})
```

### 6.5 응답과 오류

응답 스키마는 상태 코드별로 선언한다.

```ts
@ApiOkResponse({ type: CompaniesListResponseDto })
@ApiBadRequestResponse({
  description: 'limit, cik 또는 ticker 형식이 올바르지 않습니다.',
})
@Get('companies')
listCompanies() {}
```

주요 응답 데코레이터는 다음과 같다.

| 데코레이터 | 일반적인 상태 코드 |
| --- | --- |
| `@ApiOkResponse()` | 200 |
| `@ApiCreatedResponse()` | 201 |
| `@ApiNoContentResponse()` | 204 |
| `@ApiBadRequestResponse()` | 400 |
| `@ApiUnauthorizedResponse()` | 401 |
| `@ApiForbiddenResponse()` | 403 |
| `@ApiNotFoundResponse()` | 404 |
| `@ApiConflictResponse()` | 409 |
| `@ApiInternalServerErrorResponse()` | 500 |

오류 응답을 일관되게 제공한다면 공통 오류 DTO를 만들고 모든 오류 데코레이터에 `type`으로 지정하는 것이 좋다.

```ts
export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'limit must be a positive integer' })
  message!: string;

  @ApiProperty({ example: 'Bad Request' })
  error!: string;
}
```

## 7. DTO 스키마 문서화

### 7.1 필수·선택 필드

```ts
export class CompanyDto {
  @ApiProperty({
    description: '10자리로 정규화된 SEC 회사 식별자',
    example: '0000320193',
  })
  cik!: string;

  @ApiPropertyOptional({
    description: '거래소 티커. 원본에 없으면 null',
    example: 'AAPL',
    nullable: true,
  })
  ticker!: string | null;
}
```

- 필수 속성은 `@ApiProperty()`를 사용한다.
- 생략 가능한 속성은 `@ApiPropertyOptional()`과 TypeScript의 `?`를 함께 사용한다.
- `null`을 반환할 수 있으면 `nullable: true`와 `| null`을 함께 사용한다.
- 날짜 문자열에는 `format: 'date'` 또는 `format: 'date-time'`을 명시한다.

### 7.2 배열과 중첩 DTO

```ts
export class CompaniesListResponseDto {
  @ApiProperty({ type: () => CompaniesFilterDto })
  filters!: CompaniesFilterDto;

  @ApiProperty({ type: () => [CompanyDto] })
  items!: CompanyDto[];
}
```

순환 참조 가능성이 있거나 선언 순서를 늦춰야 하면 `type: () => Type` 형태의 지연 평가 함수를 사용한다.

### 7.3 enum

```ts
const FILING_STATUSES = ['pending', 'downloaded', 'failed'] as const;

export class FilingDto {
  @ApiProperty({
    enum: FILING_STATUSES,
    example: 'downloaded',
  })
  status!: (typeof FILING_STATUSES)[number];
}
```

여러 DTO가 같은 enum 스키마를 공유하며 생성 클라이언트에서도 독립 타입으로 만들고 싶다면 `enumName`도 지정할 수 있다.

```ts
@ApiProperty({ enum: FILING_STATUSES, enumName: 'FilingStatus' })
status!: FilingStatus;
```

### 7.4 제네릭과 추가 모델

TypeScript 제네릭은 런타임에 타입 정보가 사라지므로 자동 추론되지 않는다. 제네릭 래퍼를 문서화할 때는 `@ApiExtraModels()`와 `getSchemaPath()`를 이용해 직접 스키마를 조합한다.

```ts
@ApiExtraModels(CompanyDto)
@ApiOkResponse({
  schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: { $ref: getSchemaPath(CompanyDto) },
      },
    },
  },
})
```

## 8. Swagger CLI 플러그인

TypeScript 리플렉션만으로는 클래스의 모든 속성, optional 여부, 주석 등을 완전히 읽을 수 없다. Nest CLI의 Swagger 플러그인은 컴파일 시 AST를 분석해 누락된 `@ApiProperty()` 메타데이터를 자동으로 추가한다.

이 프로젝트의 `nest-cli.json` 설정은 다음과 같다.

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "plugins": [
      {
        "name": "@nestjs/swagger",
        "options": {
          "classValidatorShim": true,
          "introspectComments": true
        }
      }
    ]
  }
}
```

플러그인은 기본적으로 `.dto.ts`, `.entity.ts` 파일을 분석해 다음 정보를 보완한다.

- DTO 속성의 타입과 배열 여부
- `?`에 따른 필수 여부
- enum과 기본값
- `class-validator` 데코레이터에서 읽은 제약 조건
- `introspectComments: true`일 때 JSDoc 설명과 예시
- 컨트롤러 반환 타입을 이용한 응답 메타데이터

명시적으로 작성한 `@ApiProperty()` 옵션은 자동 생성값보다 우선한다. 따라서 현재 `company.dto.ts`와 `filing.dto.ts`처럼 예시와 도메인 설명이 중요한 DTO는 수동 데코레이터를 유지하고, 단순 DTO는 플러그인 추론에 맡기는 혼합 방식이 적절하다.

플러그인은 Nest CLI 컴파일 과정에서 실행된다. 이 때문에 프로젝트의 빌드 명령은 단순 `tsc` 대신 다음과 같이 구성되어 있다.

```json
{
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build"
  }
}
```

플러그인 옵션을 변경했다면 이전 빌드 결과를 지우고 다시 빌드해야 할 수 있다.

## 9. Mapped Types

생성 DTO에서 수정 DTO처럼 필드를 선택 항목으로 바꿀 때는 Swagger가 제공하는 mapped type을 사용한다.

```ts
import { PartialType, PickType, OmitType, IntersectionType } from '@nestjs/swagger';

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {}

export class CompanyKeyDto extends PickType(CompanyDto, ['cik'] as const) {}

export class CompanyWithoutTimestampDto extends OmitType(CompanyDto, [
  'updatedAt',
] as const) {}
```

Swagger CLI 플러그인을 사용할 때는 `PartialType` 등을 `@nestjs/mapped-types`가 아니라 `@nestjs/swagger`에서 가져와야 스키마 메타데이터가 올바르게 전달된다.

## 10. 인증 문서화

현재 SEC Collector API에는 인증이 적용되어 있지 않다. 이후 Bearer JWT 인증을 도입한다면 문서의 보안 스키마와 각 API의 요구 조건을 함께 선언한다.

```ts
const config = new DocumentBuilder()
  .setTitle('Reason Hwang SEC API')
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
    'access-token',
  )
  .build();
```

```ts
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Get('companies')
listCompanies() {}
```

`addBearerAuth()`만 추가하면 Swagger UI에 Authorize 버튼은 생기지만 실제 NestJS 인증은 수행되지 않는다. 반대로 Guard만 적용하고 `@ApiBearerAuth()`를 빠뜨리면 API는 보호되지만 문서에서 인증 필요 여부가 보이지 않는다.

## 11. 파일 업로드와 다운로드

파일 업로드 API는 multipart content type과 binary 스키마를 함께 선언한다.

```ts
@ApiConsumes('multipart/form-data')
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      file: { type: 'string', format: 'binary' },
    },
    required: ['file'],
  },
})
@Post('upload')
upload(@UploadedFile() file: Express.Multer.File) {}
```

파일 응답은 content type과 binary 스키마를 명시한다.

```ts
@ApiOkResponse({
  content: {
    'application/octet-stream': {
      schema: { type: 'string', format: 'binary' },
    },
  },
})
```

## 12. 여러 문서로 분리하기

API 규모가 커지면 `SwaggerModule.createDocument()`의 `include` 옵션으로 특정 Nest 모듈만 포함한 문서를 만들 수 있다.

```ts
const secDocument = SwaggerModule.createDocument(app, config, {
  include: [UsCorporateFilingsModule],
  deepScanRoutes: true,
});

SwaggerModule.setup('docs/sec', app, secDocument);
```

관리자 API, 외부 공개 API, 내부 API의 공개 범위가 다를 때 유용하다. 단순히 UI 태그만 나누려는 목적이라면 문서를 여러 개 만들기보다 `@ApiTags()`를 사용하는 편이 관리하기 쉽다.

## 13. OpenAPI 문서 활용

### 13.1 JSON 파일 저장

배포 파이프라인에서 서버를 실행하지 않고 정적 OpenAPI 파일을 만들어야 한다면 별도 스크립트에서 Nest application context를 생성하고 `SwaggerModule.createDocument()` 결과를 JSON으로 저장할 수 있다. 다만 이 애플리케이션은 시작 시 PostgreSQL 연결과 마이그레이션을 수행하므로 문서 전용 부트스트랩에서는 DB 의존성을 분리하는 설계가 필요하다.

현재는 실행 중인 서버가 제공하는 다음 URL을 사용하는 것이 가장 단순하다.

```text
http://localhost:2801/docs/sec/openapi.json
```

### 13.2 Bruno 컬렉션 생성

Bruno는 NestJS 모듈이 아니라 OpenAPI 문서를 가져와 API 요청과 E2E 테스트를 관리하는 독립 도구다. 이 프로젝트의 OpenAPI JSON을 클래식 `.bru` 컬렉션으로 변환하려면 다음 명령을 사용한다.

```bash
pnpm exec bru import openapi \
  --source http://localhost:2801/docs/sec/openapi.json \
  --output 20-portfolio/1-reason-hwang/2-bff-apps/bruno-api-tests \
  --collection-name "Reason Hwang SEC API" \
  --collection-format=bru
```

OpenAPI 가져오기는 지속적인 양방향 동기화가 아니다. 기존 컬렉션을 다시 생성하면 직접 작성한 assertion이나 script가 영향을 받을 수 있으므로, 생성 전 변경 사항을 커밋하거나 별도 임시 디렉터리에서 결과를 비교한다.

## 14. 검증 방법

### 14.1 정적 검증과 빌드

```bash
pnpm --filter @reason-hwang/bff-apps lint
pnpm --filter @reason-hwang/bff-apps build
```

`lint`는 현재 `tsc --noEmit`을 실행하며 TypeScript 타입 오류를 확인한다. `build`는 `nest build`를 실행해 Swagger CLI 플러그인이 적용되는 실제 컴파일 경로를 검증한다.

### 14.2 실행 확인

PostgreSQL이 준비되고 애플리케이션 환경변수가 설정된 상태에서 서버를 실행한다. 기본 포트의 서비스가 다른 터미널에서 실행 중이면 해당 프로세스를 중단하지 말고, 먼저 테스트 포트가 비어 있는지 확인한다.

```bash
lsof -nP -iTCP:2802 -sTCP:LISTEN
```

출력이 없다면 셸 환경변수로 테스트 포트를 덮어써서 별도 인스턴스를 실행한다. `dotenv`는 기본적으로 이미 설정된 셸 환경변수를 덮어쓰지 않으므로 `.env`의 `PORT`보다 명령 앞의 `PORT=2802`가 우선한다.

```bash
PORT=2802 SWAGGER_ENABLED=true \
  pnpm --filter @reason-hwang/bff-apps start
```

그다음 문서와 API 명세를 확인한다.

```bash
curl -I http://localhost:2802/docs/sec
curl http://localhost:2802/docs/sec/openapi.json
curl http://localhost:2802/docs/sec/openapi.yaml
```

검증이 끝나면 이 테스트 인스턴스를 실행한 터미널에서 `Ctrl+C`를 눌러 종료한다. 기존 포트에서 실행 중인 서비스에는 영향을 주지 않는다.

2026-08-25에 `2802` 포트로 수행한 적용 검증 결과는 다음과 같다.

| 검증 항목 | 결과 |
| --- | --- |
| Swagger UI `/docs/sec` | HTTP 200 |
| OpenAPI JSON `/docs/sec/openapi.json` | HTTP 200, OpenAPI 3.0.0 |
| OpenAPI YAML `/docs/sec/openapi.yaml` | HTTP 200 |
| 문서화된 API 경로 | 9개 |
| 생성된 component schema | 25개 |
| `GET /api/sec/companies` operationId | `listCompanies` |

JSON에서 다음 항목을 확인한다.

- `openapi` 버전이 존재하는가
- `info.title`과 `info.version`이 올바른가
- `/api/sec/companies` 등 실제 경로가 포함되는가
- `components.schemas`에 요청·응답 DTO가 포함되는가
- 각 operation의 성공 및 오류 응답이 선언되는가
- `operationId`가 컨트롤러 메서드 이름과 일치하는가

## 15. 자주 발생하는 문제

### DTO 스키마가 비어 있음

- DTO가 `interface` 또는 타입 별칭이 아닌 `class`인지 확인한다.
- 파일명이 기본 분석 대상인 `.dto.ts` 또는 `.entity.ts`로 끝나는지 확인한다.
- `nest-cli.json` 플러그인이 활성화되어 있는지 확인한다.
- `tsc`가 아니라 `nest build` 또는 `nest start`를 사용했는지 확인한다.
- 플러그인을 쓰지 않는다면 각 속성에 `@ApiProperty()`를 추가한다.

### 응답 타입이 문서에 나오지 않음

- 메서드 반환 타입을 구체적인 DTO class로 선언한다.
- `@ApiOkResponse({ type: ResponseDto })`를 명시한다.
- 제네릭 또는 union이면 `schema`를 직접 작성한다.
- 직접 참조되지 않는 모델은 `@ApiExtraModels()`로 등록한다.

### 실제 URL과 문서 URL이 다름

- `setGlobalPrefix()` 적용 여부를 확인한다.
- 컨트롤러와 메서드 경로가 합쳐지는 방식을 확인한다.
- 리버스 프록시가 prefix를 추가하거나 제거하는지 확인한다.
- 필요한 경우 `DocumentBuilder.addServer()`로 외부 기준 base URL을 제공한다.

### Swagger UI는 열리지만 API 호출이 실패함

- CORS와 인증 헤더 설정을 확인한다.
- 프록시 환경에서 Swagger가 호출하는 서버 URL을 확인한다.
- HTTPS 페이지에서 HTTP API를 부르는 mixed-content 문제를 확인한다.
- API 실행에 필요한 PostgreSQL 및 외부 SEC 설정을 확인한다.

### 플러그인 설정 변경이 반영되지 않음

기존 `dist`의 증분 빌드 정보가 남았을 수 있다. 안전한 프로젝트 경로인지 확인한 후 빌드 산출물을 정리하고 다시 빌드한다.

```bash
pnpm --filter @reason-hwang/bff-apps build
```

## 16. 유지보수 규칙

새 엔드포인트를 추가할 때 다음 항목을 함께 갱신한다.

1. `@ApiOperation()`에 사용자 관점의 summary와 description을 작성한다.
2. 원시 query/body를 사용하면 `@ApiQuery()` 또는 `@ApiBody()`를 명시한다.
3. 요청·응답 DTO에 nullable, enum, 배열, 날짜 형식과 현실적인 example을 제공한다.
4. 정상 응답과 예상 가능한 4xx 응답을 문서화한다.
5. Swagger UI에서 요청을 직접 실행해 실제 응답과 스키마가 일치하는지 확인한다.
6. OpenAPI를 가져가는 Bruno 또는 코드 생성 소비자가 있다면 operationId와 스키마 이름 변경을 호환성 변경으로 취급한다.

## 17. 공식 참고 자료

- [NestJS OpenAPI 소개](https://docs.nestjs.com/openapi/introduction)
- [NestJS Swagger CLI 플러그인](https://docs.nestjs.com/openapi/cli-plugin)
- [NestJS 타입과 파라미터](https://docs.nestjs.com/openapi/types-and-parameters)
- [NestJS Operations](https://docs.nestjs.com/openapi/operations)
- [NestJS Mapped Types](https://docs.nestjs.com/openapi/mapped-types)
- [NestJS OpenAPI 보안](https://docs.nestjs.com/openapi/security)
- [NestJS OpenAPI 기타 기능](https://docs.nestjs.com/openapi/other-features)
- [Bruno OpenAPI 가져오기](https://docs.usebruno.com/bru-cli/import)
