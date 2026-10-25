import { cp, mkdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const app = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(app, ".next/standalone");
await access(path.join(output, "server.js"));
for (const relative of ["public", ".next/static", "database"]) {
  await mkdir(path.dirname(path.join(output, relative)), { recursive: true });
  await cp(path.join(app, relative), path.join(output, relative), {
    recursive: true,
    force: true,
  });
}
console.log(
  "Standalone ready: .next/standalone (server, static assets, local source data)",
);
