# Retrieval Quality

Baseline RAG uses a single user question, retrieves the top-k chunks, and sends them to answer generation. It is easy to build, but it often fails when the question uses different words from the corpus.

Query rewrite turns a user question into a canonical search query. For example, a question about a slow bot can be rewritten with latency, p95, timeout, and throughput terms.

Multi-query retrieval sends several query variants and merges the candidates. It improves recall for broad questions because each variant can target a different aspect of the answer.

Hybrid search combines lexical keyword matching with vector-like semantic scoring. In an offline lecture repo, token cosine similarity is a useful stand-in for embeddings because it shows the ranking idea without external services.

Contextual compression keeps only sentences that overlap with the question. Compression reduces token cost and removes distracting text before the answer step.

Reranking improves precision by reordering noisy candidates after broad retrieval. A reranker can reward source titles, exact evidence terms, and compact compressed snippets.

Retrieval validation runs before answer generation. If the best score is weak or no evidence terms are present, the chain should say that evidence is insufficient instead of inventing an answer.

A useful evaluation set records the question, a short reference answer, and expected source files. Top-k hit rate checks whether the relevant source appeared before answer generation.
