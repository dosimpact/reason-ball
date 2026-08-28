import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 4200);
const app = createApp();

app.listen(port, () => {
  console.log(`Codebase Memory Todo API listening on http://localhost:${port}/api/todos`);
});
