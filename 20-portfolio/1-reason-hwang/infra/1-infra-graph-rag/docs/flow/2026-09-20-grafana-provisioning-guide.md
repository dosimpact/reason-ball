# 2026-09-20 Grafana Provisioning Guide

## Context

Grafana datasource와 dashboard preset이 코드로 프로비저닝되고 있지만, 파일별 역할과 안전한 변경 절차를 설명하는 전용 문서가 없었다.

## Change

- `docs/grafana-provisioning.md`를 추가했다.
- datasource UID, dashboard provider, 현재 preset 목록을 기록했다.
- JSON 직접 수정 및 UI export 절차를 정의했다.
- API와 로그를 이용한 검증 절차를 정의했다.
- `docs/design.md`에서 가이드를 연결했다.

## Rationale

Grafana UI의 변경은 프로비저닝 원본 JSON에 자동 반영되지 않는다. Git 원본과 런타임 데이터베이스의 차이를 명확히 하여 대시보드 변경 유실과 UID 불일치를 방지한다.

## Affected Stock Sections

- `docs/design.md`: Metrics Collection
- `docs/grafana-provisioning.md`: 신규 운영 가이드

## Validation Status

- 현재 datasource UID 및 내부 URL과 문서 대조
- dashboard JSON 제목, UID, 패널 수와 문서 대조
- Compose read-only mount 경로와 문서 대조
