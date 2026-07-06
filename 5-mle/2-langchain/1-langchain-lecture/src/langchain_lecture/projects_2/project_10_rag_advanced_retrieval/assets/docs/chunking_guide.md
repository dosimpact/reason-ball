# Chunking Guide

Chunking keeps retrieval grounded by giving each paragraph a narrow topic. A good chunk usually preserves a complete idea, a heading, and enough surrounding words for the retriever to score it.

Stable source metadata is part of chunking. Every chunk should keep the original file name, title, chunk index, and a source identifier so the answer can cite where evidence came from.

Chunk boundaries should follow section boundaries before arbitrary token counts. Splitting in the middle of a checklist or table often creates fragments that look relevant but cannot answer the question.

Overlap helps when important context sits near a boundary. Small overlap can improve recall, but large overlap creates duplicate candidates and makes reranking less precise.

For lecture exercises, paragraph chunks are easier to inspect than large token windows. Students can read the source, score, and rank without needing a vector database UI.

When a document mixes policy and troubleshooting, separate those sections. A focused operations chunk should not be merged with unrelated onboarding notes.
