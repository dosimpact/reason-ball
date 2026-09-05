import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: "http://localhost:5173" });
  app.setGlobalPrefix("api");

  const port = Number(process.env.PORT ?? 4100);
  await app.listen(port);
  console.log(`Todo API listening on http://localhost:${port}/api`);
}

void bootstrap();

