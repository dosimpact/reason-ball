# Operations Runbook

When chatbot latency rises, check p95 latency, timeout rate, queue depth, and cache hit rate first. These metrics show whether retrieval, generation, or traffic pressure is the likely bottleneck.

If p95 latency increases while cache hit rate drops, inspect repeated queries and cache keys. A small rewrite change can accidentally bypass cached retrieval results.

If timeout rate rises with normal queue depth, inspect downstream model calls and retriever latency separately. Retrieval may be healthy while answer generation is slow.

Token cost is controlled by top_k, chunk length, compression, and prompt format. Reducing irrelevant context usually saves more than shortening the final answer.

For incident notes, record the question, selected strategy, source files, scores, and final answer. This makes later regression tests easier to write.

Do not tune every knob at once. Change one retrieval setting, capture hit rate and latency, then compare it with the baseline run.
