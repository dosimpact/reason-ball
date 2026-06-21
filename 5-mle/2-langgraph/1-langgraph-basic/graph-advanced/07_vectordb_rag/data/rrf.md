# RRF (Reciprocal Rank Fusion)

여러 검색 결과 리스트를 하나로 합치는 단순하지만 강력한 방법.

## 수식
점수가 아닌 **순위 (rank)** 만 사용:

    RRF(d) = Σ 1 / (k + rank_i(d))

- k 는 보통 60 (경험적 상수)
- 각 retriever 의 score 스케일 차이를 무시할 수 있어 robust
- dense + sparse + reranker 등 임의 개수 결합 가능

## 장점
- 점수 정규화 불필요
- 구현 5줄
- 실전에서 가중합 (linear combination) 보다 잘 작동하는 경우가 많음
