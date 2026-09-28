# FSD 디렉터리와 SLAP 경계 설계

- 날짜: 2026-09-27
- 맥락: FSD 아키텍처, 도메인별 feature 분리, SLAP 원칙을 디렉터리 구조에 반영하라는 요청.
- 변경: 기존 `src/tutorials`·`src/data`·넓은 `src/features` 초안을 FSD 계층, 행동별 feature, 도메인 entity, Next.js 라우트 및 서버 전용 경계로 재배치. 프로젝트 작업 규칙에 공개 API·SLAP 원칙 추가.
- 이유: 새 유닛과 기능을 추가할 때 도메인 규칙·UI 조립·외부 데이터 처리의 변경 범위를 명확히 하기 위해.
- 영향 stock: `docs/stock/system-design.md`의 디렉터리 구조·의존 규칙·SLAP.
- 검증: [FSD 계층·import 규칙](https://feature-sliced.design/docs/reference/layers), [공개 API](https://feature-sliced.design/docs/reference/public-api), [Next.js `src` 라우트 규칙](https://nextjs.org/docs/pages/api-reference/file-conventions/src-folder)을 기준으로 구조 검토. Markdown 24개 파일의 로컬 링크 누락 0건, 계획·stock·작업 규칙의 FSD·SLAP 표기 확인. 코드는 아직 없음.
- 후속 상태: 실제 Next.js 버전의 라우트 해석, 슬라이스 간 import 제한과 서버 전용 경계는 구현·정적 검사에서 검증.
