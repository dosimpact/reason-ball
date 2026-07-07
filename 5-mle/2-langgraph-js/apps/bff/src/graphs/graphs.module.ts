import { Module } from "@nestjs/common";
import { LangGraphRunnerAdapter } from "./adapters/langgraph-runner.adapter.js";
import { GraphsController } from "./graphs.controller.js";
import { GraphsService } from "./graphs.service.js";

@Module({
  controllers: [GraphsController],
  providers: [GraphsService, LangGraphRunnerAdapter],
  exports: [GraphsService]
})
export class GraphsModule {}
