# Evaluation Playbook

A retrieval evaluation question should include the user question, a short reference answer, and expected source documents. The source labels make top-k hit rate measurable.

Top-k hit rate asks whether at least one expected source appears in the retrieved results. It is a retrieval metric, not a final answer metric.

Precision asks how many retrieved chunks are actually useful. Compression and reranking usually improve precision after a broad recall step.

Recall asks whether the retriever found enough of the needed evidence. Query rewrite and multi-query retrieval usually improve recall when vocabulary differs.

Latency and cost should be recorded with quality. A high recall strategy can still be a poor production choice if it is too slow or sends too much context.

Regression tests should include one no-evidence question. The expected behavior is an insufficient-evidence answer rather than a hallucinated policy.
