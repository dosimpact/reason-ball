import { Module } from "@nestjs/common";
import { GraphsModule } from "./graphs/graphs.module.js";

@Module({
  imports: [GraphsModule]
})
export class AppModule {}
