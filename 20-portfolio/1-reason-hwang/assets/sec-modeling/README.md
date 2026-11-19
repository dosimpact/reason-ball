# SEC retrieval gold

`retrieval-gold.json` contains 30 questions (15 Korean, 15 English) for the three
user-provided AAPL, CPNG, and NVDA 10-K reports. Each expected evidence phrase was
checked against the extracted Item text before running retrieval. The fixture
does not download or embed report bodies.

Run from `3-langgraph-fast` with `SEC_MODELING_KEY` configured:

```sh
uv run --env-file .env python scripts/validate_sec_retrieval.py --base-url http://127.0.0.1:2981
```

The runner specifies filing IDs but does not prefilter Items. An answer counts
as a hit only when retrieved evidence or an explicitly linked supporting Chunk
contains the expected phrase; finding that phrase somewhere in full Item HTML
does not count. `expectedItemCodes` documents the source locations and does not
make an irrelevant chunk count as a hit.

Acceptance requires Recall@10 ≥ 90%, zero cross-filing evidence, and 100%
successful evidence resolution. Korean and English cases share 15 information
needs, so this small bilingual regression set is not a general RAG benchmark.
The report records actual results; having the fixture is not evidence of PASS.
