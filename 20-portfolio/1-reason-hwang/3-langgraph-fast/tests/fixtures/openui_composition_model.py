"""Paid-model boundary fixture; preserves supplied data and captures composition calls."""

import json


class CompositionModel:
    def __init__(self, *, failure=False):
        self.failure = failure
        self.calls = []

    def with_structured_output(self, schema):
        return self

    async def ainvoke(self, messages):
        payload = json.loads(messages[1].content)
        self.calls.append(payload)
        if self.failure:
            raise RuntimeError("fixture provider unavailable")
        context = payload["presentationContext"]
        dumps = lambda value: json.dumps(value, ensure_ascii=False, allow_nan=False)
        if context.get("kind") == "verified_talib_results":
            nodes = ['Title("TA-Lib verified composition", "lg")']
            for result in context["results"]:
                nodes.append("Text(" + dumps(result["id"]) + ")")
                for output in result.get("outputs", {}).values():
                    points = [
                        point
                        for point in output["points"]
                        if point["value"] is not None
                    ]
                    nodes.append('Chart("line",' + dumps(points) + ',"date",["value"])')
            return {"program": "root = Col([" + ",".join(nodes) + "], 2)"}
        items = context.get("canvasItems") or [{"title": "Verified technical analysis"}]
        nodes, declarations = [], []
        for index, item in enumerate(items):
            name = "chart" + str(index)
            args = dict(context["chartQuery"])
            if "instances" in item:
                args["instances"] = dumps(item["instances"])
            declarations.append(
                name
                + ' = Query("technical_analysis_chart",'
                + dumps(args)
                + ","
                + dumps(context["chartFallback"])
                + ",0)"
            )
            children = (
                "Title(" + dumps(item["title"]) + ',"lg"),FinancialChart(' + name + ")"
            )
            nodes.append(
                "CanvasItem("
                + dumps(item["id"])
                + ","
                + dumps(item["title"])
                + ",["
                + children
                + "])"
                if "id" in item
                else "Col([" + children + "],2)"
            )
        return {
            "program": "root = Col(["
            + ",".join(nodes)
            + "], 2)\n"
            + "\n".join(declarations)
        }
