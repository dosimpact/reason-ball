import { Body, Controller, Get, Inject, Param, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { GraphsService } from "./graphs.service.js";
import type { InvokeGraphDto } from "./dto/invoke-graph.dto.js";
import type { ResumeGraphDto } from "./dto/resume-graph.dto.js";
import type { StreamGraphDto } from "./dto/stream-graph.dto.js";

@Controller("graphs")
export class GraphsController {
  constructor(@Inject(GraphsService) private readonly graphsService: GraphsService) {}

  @Get()
  listGraphs() {
    return { graphs: this.graphsService.listGraphs() };
  }

  @Post(":id/invoke")
  invoke(@Param("id") graphId: string, @Body() dto: InvokeGraphDto): Promise<unknown> {
    return this.graphsService.invoke(graphId, dto);
  }

  @Post(":id/resume")
  resume(@Param("id") graphId: string, @Body() dto: ResumeGraphDto): Promise<unknown> {
    return this.graphsService.resume(graphId, dto);
  }

  @Post(":id/stream")
  async stream(@Param("id") graphId: string, @Body() dto: StreamGraphDto, @Res() response: Response) {
    response.setHeader("Content-Type", "application/x-ndjson");
    response.setHeader("Cache-Control", "no-cache");

    const stream = await this.graphsService.stream(graphId, dto);
    for await (const chunk of stream) {
      response.write(`${JSON.stringify(chunk)}\n`);
    }
    response.end();
  }
}
