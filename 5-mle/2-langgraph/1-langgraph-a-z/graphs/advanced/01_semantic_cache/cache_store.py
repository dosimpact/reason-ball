"""
in-memory 시멘틱 캐시.

- `add(vec, answer)`: 임베딩과 응답 저장
- `lookup(vec) -> (score, answer) | None`: 가장 가까운 항목의 코사인 유사도가
  threshold 이상이면 (score, answer) 반환, 아니면 None.

프로덕션에서는 Redis(VL) / Qdrant 등으로 교체하세요. 여기서는 학습용 numpy 만 사용.
"""
from __future__ import annotations

from typing import Optional

import numpy as np


class SemanticCache:
    def __init__(self, threshold: float = 0.95) -> None:
        self.threshold = threshold
        self._vecs: list[np.ndarray] = []
        self._answers: list[str] = []

    def __len__(self) -> int:
        return len(self._answers)

    @staticmethod
    def _normalize(v: np.ndarray) -> np.ndarray:
        norm = np.linalg.norm(v)
        return v / norm if norm > 0 else v

    def add(self, vec: list[float], answer: str) -> None:
        arr = self._normalize(np.asarray(vec, dtype=np.float32))
        self._vecs.append(arr)
        self._answers.append(answer)

    def lookup(self, vec: list[float]) -> Optional[tuple[float, str]]:
        if not self._vecs:
            return None
        q = self._normalize(np.asarray(vec, dtype=np.float32))
        matrix = np.stack(self._vecs)
        sims = matrix @ q  # 모두 정규화되어 있으므로 dot == cosine
        idx = int(np.argmax(sims))
        score = float(sims[idx])
        if score >= self.threshold:
            return score, self._answers[idx]
        return None

    def clear(self) -> None:
        self._vecs.clear()
        self._answers.clear()


__all__ = ["SemanticCache"]
