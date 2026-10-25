# 2026-10-26 APP-LOCAL-001 앱 내부 데이터와 standalone

## 맥락과 변경

사용자가 app에서 쓰는 상위 database 자료만 복사해 app 자체로 완성하고 standalone에서도 동작하도록 요청했다.

- 기존 vendor.sources, metadata.inputs, 카탈로그 files 및 현재 준비대행 첨부를 선택해 `app/database`로1,126개·63,705,477바이트 복사. SHA-256 manifest 기록. 원본/형제 client는 수정하지 않음.
- build-data/validate-data/geocode 및 원본 대조 테스트와 documents API를 앱 내부 경로로 변경. 기존 추출기와 모델 schema/validator/사용 예제만 로컬에 복사. 새 구현으로 표현하지 않음.
- output:standalone 설정. build 후 public, .next/static, database를 산출물에 포함. start는 standalone 서버를 실행.
- sync:data는 명시적 외부 입력 갱신 전용이며 일반 build/start/test는 외부 원본을 읽지 않음. 미참조 로컬 복사본 자동 삭제는 하지 않음.
- test:standalone은 릴리스를 임시 폴더에 복사해 의존 symlink가 릴리스 내부인지 확인하고 독립 포트로 페이지/정적자산/API/원본 SHA/경로탈출 차단을 확인한 뒤 서버·임시폴더를 정리.

## 검증

- 41개 테스트 통과: 모든 복사 파일 SHA-256, 앱 내부 실제경로,446개 업체 source 연결 포함.
- validate:data:446개 projection/export,7개 입력 hash,3,469개 XLSX 원본 셀 일치.
- 프로젝트 밖 임시 폴더에서 app 내부 scripts/packages/database만으로 build-data 실행. 기존 vendors.json의446개 레코드와 완전히 동일.
- 린트·타입검사·production standalone build 통과.
- `pnpm -C app test:standalone` 통과: 홈페이지/가격표/JS·CSS/웨딩홀·준비대행 API/원본 SHA/경로탈출403/외부 symlink 없음.
- 별도 격리 릴리스3089 실제 브라우저: 가격표20행, 상세, 지도 전환·확대·마커65개·상세 성공. pageerror0, 흐름 중 앱 HTTP 실패0. 초기 브라우저 favicon.ico404 로그는 기능 자산 실패와 별도로 확인했다.
- 증거: `output/playwright/standalone/isolated-map-detail.png`. macOS ARM64에서 검증; 다른 OS/CPU 배포는 해당 환경에서 빌드한다.

## 영향 stock

business-design APP-LOCAL-001, system-design SYS-001/003/004 및 APP-LOCAL-001, app README/AGENTS를 현재 구조와 명령으로 동기화했다. 기존 full-map flow의 상위 의존성 설명은 당시 기록으로 보존하고 본 결정으로 대체한다.
