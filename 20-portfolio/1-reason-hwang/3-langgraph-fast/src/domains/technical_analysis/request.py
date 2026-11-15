"""Validated explicit reanalysis, shared by inline and Canvas graphs."""
from typing import Literal
from pydantic import BaseModel,ConfigDict,Field,model_validator
from domains.technical_analysis.report import AgentIndicator
from domains.technical_analysis.catalog import instance_id


class AnalysisRequest(BaseModel):
    model_config=ConfigDict(extra='forbid')
    ticker:str=Field(min_length=1,max_length=40,pattern=r'^[A-Za-z0-9.^=_\-]+$')
    interval:Literal['1d','1wk']='1d'
    count:int=Field(default=120,ge=2,le=200,strict=True)
    indicators:list[AgentIndicator]|None=Field(default=None,min_length=1,max_length=40)

    @model_validator(mode='after')
    def unique_instances(self):
        if self.indicators:
            ids=[i.instanceId or instance_id(i.name,i.request().parameters) for i in self.indicators]
            if len(set(ids))!=len(ids):
                raise ValueError('Duplicate indicator instance IDs')
        return self
