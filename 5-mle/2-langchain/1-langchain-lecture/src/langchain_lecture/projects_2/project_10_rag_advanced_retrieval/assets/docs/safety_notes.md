# Safety Notes

Grounded RAG should prefer a limited answer over a confident unsupported answer. If retrieval validation fails, the response should say evidence is insufficient.

PII such as email addresses and phone numbers should be masked before logs are stored. Retrieval traces are useful, but they should not leak private data.

Safety checks are not only for tools. A retrieval pipeline can expose secrets if source documents contain credentials, private tickets, or customer records.

Answer generation should cite source files for operational or policy guidance. Citations make it easier to spot when the model used the wrong document.

When a user asks for data outside the corpus, the correct behavior is to refuse the unsupported detail and explain what evidence was missing.

Validation should run before synthesis, not after. Once an answer is drafted, unsupported claims are harder to separate from grounded facts.
