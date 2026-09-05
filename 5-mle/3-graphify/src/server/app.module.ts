import { Module } from "@nestjs/common";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "node:path";
import { TodosModule } from "./todos/todos.module";

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "..", "client"),
      exclude: ["/api/(.*)"],
    }),
    TodosModule,
  ],
})
export class AppModule {}
