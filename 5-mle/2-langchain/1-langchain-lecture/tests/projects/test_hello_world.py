from __future__ import annotations

from langchain_core.runnables import RunnableLambda

from langchain_lecture.projects.project_01_hello_world.chain import summarize_person


def test_summarize_person_accepts_injected_model():
    model = RunnableLambda(lambda prompt_value: "summary result")

    assert summarize_person("Ada Lovelace wrote about computing.", model=model) == "summary result"

