# Qdrant

Qdrant is an open-source vector database written in Rust. It supports
- HNSW 인덱스 (approximate nearest neighbor)
- Payload filtering (metadata 조건절)
- Hybrid search (sparse vector + dense vector)
- gRPC + HTTP 인터페이스

## 운영 특성

- 단일 노드로도 수백만 벡터 충분
- 분산 모드 (sharding + replication) 지원
- snapshot 기반 백업/복구
- Docker 한 줄로 띄울 수 있어 PoC 에 적합
