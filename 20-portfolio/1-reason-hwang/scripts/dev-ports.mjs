import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export const APP_PORTS = [
  { port: 2800, directory: "1-fe-host" },
  { port: 2801, directory: "2-bff-apps" },
  { port: 2802, directory: "2-bff-apps/remotes/template" },
  { port: 2803, directory: "2-bff-apps/remotes/todo" },
  { port: 8000, directory: "3-langgraph-fast" },
];

function lsof(args) {
  try {
    return execFileSync("lsof", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    // lsof uses exit 1 with no output when the selection has no matches.
    if (error.status === 1 && !error.stdout?.length && !error.stderr?.length) return "";
    throw new Error("프로세스 확인에 실패했습니다. lsof 설치 및 실행 권한을 확인하세요.", { cause: error });
  }
}

export function parseProcess(output) {
  const fields = Object.fromEntries(output.trim().split("\n").filter(Boolean).map(line => [line[0], line.slice(1)]));
  if (!fields.p || !fields.n || !fields.c || !fields.R) return null;
  return { pid: Number(fields.p), parentPid: Number(fields.R), command: fields.c, cwd: fields.n };
}

function inspect(pid) {
  const info = parseProcess(lsof(["-a", "-p", String(pid), "-d", "cwd", "-FpcRn"]));
  return info ? { ...info, cwd: realpathSync(info.cwd) } : null;
}

function listeners(port) {
  return [...new Set(lsof(["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fp"])
    .split("\n").filter(line => line.startsWith("p")).map(line => Number(line.slice(1))))];
}

const runtime = /^(node|nodejs|python(?:\d+(?:\.\d+)*)?|uv|uvicorn|pnpm|nest|next-server.*|vite|turbo)$/i;
const sameProcess = (a, b) => b && a.pid === b.pid && a.parentPid === b.parentPid && a.cwd === b.cwd && a.command === b.command;

export function systemOperations() {
  return {
    inspect, listeners,
    terminate: pid => process.kill(pid, "SIGTERM"),
    wait: delay,
    log: message => console.log(message),
  };
}

// Inspect every port before sending any signals. Never touch infrastructure ports.
export async function preparePorts(root, operations = systemOperations(), selfPid = process.pid) {
  const protectedPids = new Set();
  for (let pid = selfPid; pid > 1 && !protectedPids.has(pid);) {
    protectedPids.add(pid);
    pid = operations.inspect(pid)?.parentPid ?? 0;
  }
  const targets = new Map();
  for (const { port, directory } of APP_PORTS) {
    const expected = path.join(root, directory);
    for (const pid of operations.listeners(port)) {
      let info = operations.inspect(pid);
      if (!info) throw new Error(`포트 ${port}의 PID ${pid} 소유권을 확인할 수 없습니다. 다시 실행하세요.`);
      if (info.cwd !== expected || !runtime.test(info.command) || protectedPids.has(pid)) {
        throw new Error(`포트 ${port}의 PID ${pid}가 해당 앱 소속으로 확인되지 않아 종료하지 않았습니다.`);
      }
      targets.set(pid, info);
      // Include package-local watchers so they cannot respawn the old listener.
      // Stop at shells, other directories, and our own process ancestry.
      while (info.parentPid > 1 && !protectedPids.has(info.parentPid)) {
        const parent = operations.inspect(info.parentPid);
        if (!parent || parent.cwd !== expected || !runtime.test(parent.command) || targets.has(parent.pid)) break;
        targets.set(parent.pid, parent);
        info = parent;
      }
    }
  }

  // Signal supervisors first, then any listeners that did not exit with them.
  const terminated = new Set();
  for (const target of [...targets.values()].reverse()) {
    const current = operations.inspect(target.pid);
    if (!current) continue;
    const adopted = terminated.has(target.parentPid) && current.parentPid === 1;
    if (!sameProcess(adopted ? { ...target, parentPid: 1 } : target, current)) throw new Error(`PID ${target.pid} 정보가 변경되어 종료를 중단했습니다.`);
    try {
      operations.terminate(target.pid);
      terminated.add(target.pid);
      operations.log(`[dev] 기존 앱 프로세스 종료 요청: PID ${target.pid}`);
    } catch (error) {
      if (error.code !== "ESRCH") throw new Error(`PID ${target.pid} 종료 권한이 없습니다. 사용자 터미널에서 pnpm dev를 실행하세요.`, { cause: error });
    }
  }

  for (let attempt = 0; attempt < 40; attempt++) {
    const busy = APP_PORTS.filter(({ port }) => operations.listeners(port).length);
    const alive = [...targets.values()].filter(target => sameProcess(target, operations.inspect(target.pid)));
    if (!busy.length && !alive.length) return;
    if (attempt === 39) throw new Error(`이전 앱 종료를 기다리다 중단했습니다. 사용 중인 포트: ${busy.map(x => x.port).join(", ") || "없음"}; 남은 PID: ${alive.map(x => x.pid).join(", ") || "없음"}. 강제 종료하지 않았습니다.`);
    await operations.wait(250);
  }
}
