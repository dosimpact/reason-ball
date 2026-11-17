"""Production SEC HTTP/graph/composer with controlled model failures and real Host validation."""
from types import SimpleNamespace

from fastapi import FastAPI
from langchain_core.exceptions import OutputParserException

from graph.primary_graphs.sec_intelligent_ui.workflow import build_graph
from graph.subgraphs.openui_output.workflow import GeneratedUI
from server.sec_chat import router as routes
from tests.fixtures.sec_chat_modeling_http_app import Model, client, prepare


class RepairModel(Model):
    ui_calls = 0

    def with_structured_output(self, schema):
        if schema is not GeneratedUI:
            return super().with_structured_output(schema)

        async def invoke(messages):
            self.ui_calls += 1
            if self.mode == "provider-fail":
                raise RuntimeError("fixture provider unavailable")
            if self.mode == "schema-fail" or (self.mode == "schema-repair" and self.ui_calls == 1):
                raise OutputParserException("fixture malformed structured response")
            if self.mode == "empty-repair" and self.ui_calls == 1:
                return None
            if self.mode == "parser-repair" and self.ui_calls == 1:
                return GeneratedUI(program="root = MissingComponent()")
            return GeneratedUI(program='root = Markdown("검증된 SEC 원문 답변")')

        return SimpleNamespace(ainvoke=invoke)


def graph(activity=None):
    model = RepairModel()
    return build_graph(model=model, activity=activity, modeling_client=client(model))


routes.prepare_filing = prepare
routes.chat_model = lambda: object()
routes.build_graph = graph
app = FastAPI()
app.include_router(routes.router)
