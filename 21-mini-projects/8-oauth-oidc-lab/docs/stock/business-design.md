# OAuth 2.0 & OpenID Connect Interactive Lab — 학습 설계

상태: Phase 1 MVP 기준  
최종 동기화: 2026-11-02

## 목적

학습자가 OAuth 2.0 Authorization Code + PKCE 및 OpenID Connect 로그인 흐름을 직접 실행하고, 실제 HTTP 교환과 검증 결과를 관찰하도록 한다. 완성된 로그인 위젯이 아니라 프로토콜의 주체, 메시지, 보안 검증을 학습하는 도구다.

## Phase 1 학습 결과

학습자는 다음을 설명하고 실행할 수 있어야 한다.

1. Browser, BFF, Authorization Server, Resource Server의 책임을 구분한다.
2. Authorization Request와 Token Request를 연결하는 `state`, PKCE, redirect URI를 확인한다.
3. OAuth access token과 OIDC ID token의 목적을 구분한다.
4. Discovery metadata와 JWKS를 사용해 issuer, audience, signature, expiry, nonce를 검증한다.
5. 인증 실패(401)와 권한 부족(403)을 실제 보호 API에서 비교한다.
6. 민감정보를 브라우저에 노출하지 않는 BFF 패턴을 설명한다.

## Phase 1 시나리오

| ID | 시나리오 | 성공 조건 |
| --- | --- | --- |
| OIDC-LOGIN | Authorization Code + PKCE 로그인 | state/nonce/PKCE 및 ID token 검증 후 세션 생성 |
| PKCE-FAIL | 변조된 verifier로 code 교환 | Keycloak token endpoint가 요청 거절 |
| API-USER | user scope/role 보호 API | 유효 access token으로 200 응답 |
| API-ADMIN | admin role 보호 API | 인증된 일반 사용자가 403 응답 |
| TOKEN-REFRESH | 서버 측 refresh | refresh token을 브라우저에 노출하지 않고 갱신 |
| LOGOUT | RP-initiated logout | 로컬 세션 제거 및 Keycloak logout endpoint 이동 |

## UX 원칙

- 왼쪽은 시나리오와 실행 상태, 중앙은 주체 간 실제 흐름, 오른쪽은 선택한 HTTP 교환의 상세를 표시한다.
- `observed` trace와 브라우저 리다이렉트에서 재구성한 `reconstructed` trace를 명확히 구분한다.
- token, code, verifier, cookie, client secret은 서버에서 마스킹한 뒤에만 UI로 전달한다.
- Phase 2에서 Prediction, Quiz, 단계별 완료 판정을 강화한다.

## 범위 밖

Phase 1은 영속 세션 저장소, 다중 인스턴스, 운영용 TLS/비밀 관리, opaque token introspection, refresh rotation 관찰, 다중 client SSO 실습을 제공하지 않는다.
