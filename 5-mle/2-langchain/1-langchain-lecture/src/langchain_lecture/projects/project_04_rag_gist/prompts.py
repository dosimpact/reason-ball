"""문서 검색 결과를 프롬프트에 넣어 답변하는 RAG 기본 흐름 예제입니다. 체인과 에이전트가 사용할 프롬프트 템플릿을 보관합니다."""

RAG_PROMPT_TEMPLATE = """Answer the question based only on the following context:

{context}

Question: {question}

Provide a detailed answer:"""

