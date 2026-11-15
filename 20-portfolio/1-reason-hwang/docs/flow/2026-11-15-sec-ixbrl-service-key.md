# 2026-11-15 — SEC iXBRL 내부 인증 설정 누락 해결

- **범위:** SEC-IXBRL-001, 로컬 BFF/Python 환경 설정. [도메인 설계](../stock/us-corporate-filings/ixbrl-viewer.md), [BFF 설정 경계](../stock/tech-shared/2-bff-apps/INDEX.md).
- **현상:** 뷰어가 `SEC internal service key is not configured`를 표시했다.
- **원인:** `SecIxbrlClient`가 기존 `SEC_MODELING_KEY` 설정을 읽지만 로컬 `2-bff-apps/.env`와 `3-langgraph-fast/.env` 모두 해당 항목이 없었다. BFF가 Python에 요청하기 전에 설정 오류로 중단하는 경로다. 새 인증 체계나 별도 viewer 키가 필요한 문제가 아니다.
- **변경:** 두 로컬 환경 파일에 동일한 암호학적 난수 서비스 키를 설정했다. 기존 값은 보존하며 키 값은 문서·출력·Git에 포함하지 않는다. 양쪽 `.env.example`에는 이미 설정 항목이 있어 수정하지 않았다.
- **기존 동작 보존:** BFF의 모델링 worker는 키 누락으로 실행되지 않던 상태였다. 뷰어 인증 설정만으로 대기 모델링 작업이 자동 실행되지 않도록, 명시 설정이 없던 로컬 BFF에 `SEC_MODELING_WORKER_ENABLED=false`를 추가했다. 모델링 작업 실행이 필요하면 별도로 활성화한다.
- **적용 방법:** 기존 프로세스는 설정 snapshot을 사용하므로 BFF와 Python FastAPI를 재시작해야 한다. 이번 작업에서는 서버를 재시작하지 않았다.
- **검증 상태:** 사용자 요청에 따라 테스트·typecheck·lint·build·브라우저·API 호출을 실행하지 않았다. 설정 누락을 읽기 방식으로 확인하고 누락 설정만 추가했으며, 실제 뷰어 동작은 사용자 재시작 후 확인 대상이다.
- **보안 경계:** 인증 우회·공개 기본키·새 프런트 인증키 전달은 추가하지 않았다. 로컬 `.env` 파일은 커밋 대상이 아니다.
