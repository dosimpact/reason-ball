import { Injectable, NotFoundException } from "@nestjs/common";
import { Command } from "@langchain/langgraph";
import type { RunnableConfig } from "@langchain/core/runnables";
import { getGraphById, listGraphIds } from "@reason-ball/langgraph-examples";

@Injectable()
export class LangGraphRunnerAdapter {
  listGraphs() {
    return listGraphIds();
  }

  async invoke(graphId: string, input: unknown, config?: RunnableConfig): Promise<unknown> {
    const graph = await this.resolveGraph(graphId);
    return (graph as any).invoke(input, config);
  }

  async stream(
    graphId: string,
    input: unknown,
    config?: RunnableConfig,
    streamMode?: string | string[]
  ): Promise<AsyncIterable<unknown>> {
    const graph = await this.resolveGraph(graphId);
    return (graph as any).stream(input, {
      ...config,
      streamMode
    });
  }

  async resume(graphId: string, resume: unknown, config: RunnableConfig): Promise<unknown> {
    const graph = await this.resolveGraph(graphId);
    return (graph as any).invoke(new Command({ resume }), config);
  }

  private async resolveGraph(graphId: string) {
    try {
      return await getGraphById(graphId);
    } catch (error) {
      throw new NotFoundException(error instanceof Error ? error.message : String(error));
    }
  }
}
