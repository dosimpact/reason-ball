from __future__ import annotations

from langchain_core.prompts import PromptTemplate

from langchain_lecture.projects.project_01_hello_world.prompts import SUMMARY_TEMPLATE
from langchain_lecture.shared.models import get_chat_model


def build_summary_chain(model=None):
    prompt = PromptTemplate.from_template(SUMMARY_TEMPLATE)
    llm = model or get_chat_model(temperature=0)
    return prompt | llm


def summarize_person(information: str, model=None) -> str:
    response = build_summary_chain(model).invoke({"information": information})
    return str(getattr(response, "content", response))

