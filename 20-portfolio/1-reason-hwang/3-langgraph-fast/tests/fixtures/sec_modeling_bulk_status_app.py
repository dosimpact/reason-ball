"""Real authenticated status router with a deterministic storage boundary."""

import os

from fastapi import FastAPI

from server.routers import sec_modeling

os.environ["SEC_MODELING_KEY"] = "qa-bulk-only"


class FixedStore:
    def publication_summaries(self):
        return [{"cik": "0000000001", "accessionNo": "0000000001-26-000001", "stages": {"1": {"generationId": "fixture-generation", "sourceHash": "a" * 64, "inputGenerationId": None}}}]

    def active_many(self, filings):
        return [
            {
                **filing,
                "stages": {
                    "1": {
                        "id": "fixture-generation",
                        "generationId": "fixture-generation",
                        "sourceHash": "a" * 64,
                    }
                }
                if index == 0
                else {},
            }
            for index, filing in enumerate(filings)
        ]

    def close(self):
        pass


setattr(sec_modeling, "GraphStore", FixedStore)
app = FastAPI()
app.include_router(sec_modeling.router)
