# 웨딩 공시 슈퍼셋 모델

원본과 추출 근거를 보존하면서 업체마다 다른 공간·상품·조건·가격·계약 규정을 담는 `0.1.0` 초안이다. 기존 카탈로그와 별도로, 새 Next.js 앱의 조회용 projection과 공시 export를 생성하는 기준으로 사용한다.

- [설계와 실제 자료 매핑](../../docs/stock/system-design.md#model-001-슈퍼셋-모델의-범위)
- [JSON Schema](schema/wedding-disclosure.schema.json)
- [실제 자료 부분 매핑 예제 5개](examples/)
- [변경과 검증 기록](../../docs/flow/2026-10-25-disclosure-superset.md)

프로젝트 루트에서 실행한다. 기존 커밋된 모델 검증 스크립트가 없어 독립 검증기를 제공한다. Python 의존성은 임시 uv 환경에서 해결하며 프로젝트 의존성을 바꾸지 않는다.

```sh
uv run --no-project --with jsonschema python packages/wedding-data-model/validate.py --check-sources
```

특정 파일은 위 명령 끝에 경로를 추가한다. `--check-sources`를 생략하면 로컬 원본 해시 대조 없이 구조·참조·기본 금액만 검사한다. 스키마 형식은 [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12/json-schema-core)를 따른다.

스키마 유효성이 추출의 정확성을 보장하지는 않는다. 전체 데이터의 모든 의미 매핑·계약 조건 계산 엔진은 완성되지 않았다. 새 앱은 검증 가능한 일부 조건의 식대·대관 참고액을 계산하며, 모델의 전체 의미를 자동 실행하는 엔진과는 구분한다.

## Next.js 앱에서 사용

[`app`](../../app/README.md)의 빌더가 두 원본의 공시 446건(2026-10-25 입력 스냅샷)을 `vendors.json` projection과 `app/public/data/disclosures/*.json`으로 만든다. 원본 자료와 표준 모델 JSON은 내부 데이터 검증 산출물로 보존하며, 소비자 상세 화면에는 열기·다운로드 기능을 노출하지 않는다. 자동 해석한 가격·조건은 미검수 상태를 보존하며 전체 의미를 사람이 전수 검수한 자료는 아니다.

미니프로젝트 루트에서 생성·검증한다.

```sh
pnpm -C app build:data
uv run --no-project --with jsonschema python app/scripts/validate-data.py
```

앱 검증기는 스키마·참조·금액 범위·원본 SHA·입력 스냅샷·현재 게시글 수록과 XLSX 셀 근거를 확인한다. [현행 구조와 경계](../../docs/stock/system-design.md#model-008-이관과-완료-경계)와 [검증 이력](../../docs/flow/2026-10-25-next-wedding-platform.md)을 따른다.
