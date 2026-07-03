"""가장 단순한 프롬프트-모델 체인 흐름을 보여주는 예제입니다. 체인과 에이전트가 사용할 프롬프트 템플릿을 보관합니다."""

SUMMARY_TEMPLATE = """
Given the information below about a person, create:
1. A short summary
2. Two interesting facts

Information:
{information}
"""

SAMPLE_INFORMATION = """
Elon Reeve Musk is a businessman known for leadership roles at Tesla, SpaceX,
X, xAI, Neuralink, and The Boring Company. He was born in Pretoria, South
Africa, moved to Canada in 1989, and later studied at the University of
Pennsylvania before moving to California to pursue business ventures.
"""

