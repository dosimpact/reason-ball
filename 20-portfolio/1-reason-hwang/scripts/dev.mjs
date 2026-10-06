import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { preparePorts } from "./dev-ports.mjs";

const root = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
try {
  await preparePorts(root);
  console.log("[dev] 앱 포트 확인 완료. 인프라는 유지하고 앱을 시작합니다.");
  const child = spawn("pnpm", ["exec", "turbo", "run", "dev", "--filter=!./infra/*", ...process.argv.slice(2)], {
    cwd: root, stdio: "inherit", env: process.env,
  });
  const interrupt = () => child.kill("SIGINT");
  const terminate = () => child.kill("SIGTERM");
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  child.on("error", error => {
    console.error(`[dev] Turbo 실행 실패: ${error.message}`);
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", terminate);
    process.exitCode = code ?? (signal === "SIGINT" ? 130 : 1);
  });
} catch (error) {
  console.error(`[dev] ${error.message}`);
  process.exitCode = 1;
}
