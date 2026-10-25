import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const directory = fileURLToPath(
  new URL("../.next/standalone/", import.meta.url),
);
const child = spawn(process.execPath, ["server.js"], {
  cwd: directory,
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: process.env.PORT || "3078",
    HOSTNAME: process.env.HOSTNAME || "127.0.0.1",
  },
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
