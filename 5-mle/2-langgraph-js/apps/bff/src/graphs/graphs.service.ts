import { Inject, Injectable } from "@nestjs/common";
import { LangGraphRunnerAdapter } from "./adapters/langgraph-runner.adapter.js";
import type { InvokeGraphDto } from "./dto/invoke-graph.dto.js";
import type { ResumeGraphDto } from "./dto/resume-graph.dto.js";
import type { StreamGraphDto } from "./dto/stream-graph.dto.js";

@Injectable()
export class GraphsService {
  constructor(@Inject(LangGraphRunnerAdapter) private readonly runner: LangGraphRunnerAdapter) {}

  listGraphs(): string[] {
    return this.runner.listGraphs();
  }

  invoke(graphId: string, dto: InvokeGraphDto): Promise<unknown> {
    return this.runner.invoke(graphId, dto.input, this.withLangSmithMetadata(graphId, dto.config));
  }

  stream(graphId: string, dto: StreamGraphDto): Promise<AsyncIterable<unknown>> {
    return this.runner.stream(
      graphId,
      dto.input,
      this.withLangSmithMetadata(graphId, dto.config),
      dto.streamMode
    );
  }

  resume(graphId: string, dto: ResumeGraphDto): Promise<unknown> {
    return this.runner.resume(graphId, dto.resume, this.withLangSmithMetadata(graphId, dto.config));
  }

  private withLangSmithMetadata(graphId: string, config: InvokeGraphDto["config"] = {}) {
    return {
      ...config,
      metadata: {
        ...config.metadata,
        graphId,
        source: "langgraph-js-bff"
      },
      tags: [...(config.tags ?? []), "langgraph-js", "bff", graphId]
    };
  }
}
