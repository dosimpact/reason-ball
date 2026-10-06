import { test } from "node:test";
import assert from "node:assert/strict";
import { APP_PORTS, parseProcess, preparePorts } from "./dev-ports.mjs";

const root = "/workspace/reason-hwang";
function fixture(entries = []) {
  const processes = new Map(entries.map(({ port, ...info }) => [info.pid, info]));
  const ports = new Map(entries.filter(x => x.port).map(x => [x.port, x.pid]));
  const stopped = [];
  const operations = {
    inspect: pid => processes.get(pid) ?? null,
    listeners: port => processes.has(ports.get(port)) ? [ports.get(port)] : [],
    terminate: pid => { stopped.push(pid); processes.delete(pid); },
    wait: async () => {}, log: () => {},
  };
  return { operations, processes, stopped };
}
const vite = { pid: 20, parentPid: 10, command: "node", cwd: `${root}/2-bff-apps/remotes/todo`, port: 2803 };

test("free ports need no termination and infrastructure is excluded", async () => {
  const f = fixture();
  await preparePorts(root, f.operations, 999);
  assert.deepEqual(f.stopped, []);
  assert.deepEqual(APP_PORTS.map(x => x.port), [2800, 2801, 2802, 2803, 8000]);
});
test("stops owned watcher and listener; tolerates child adoption by init", async () => {
  const f = fixture([vite, { ...vite, pid: 10, parentPid: 1, port: undefined }]);
  const terminate = f.operations.terminate;
  f.operations.terminate = pid => {
    terminate(pid);
    if (pid === 10) f.processes.set(20, { ...f.processes.get(20), parentPid: 1 });
  };
  await preparePorts(root, f.operations, 999);
  assert.deepEqual(f.stopped, [10, 20]);
});
test("foreign checkout collision prevents every termination", async () => {
  const f = fixture([
    { ...vite, pid: 30, port: 2800, cwd: `${root}/1-fe-host` },
    { ...vite, cwd: "/workspace/other/2-bff-apps/remotes/todo" },
  ]);
  await assert.rejects(preparePorts(root, f.operations, 999), /종료하지 않았습니다/);
  assert.deepEqual(f.stopped, []);
});
test("unknown executable or unknown ownership is not killed", async () => {
  for (const entry of [{ ...vite, command: "Docker" }, { ...vite, cwd: `${root}-other` }]) {
    const f = fixture([entry]);
    await assert.rejects(preparePorts(root, f.operations, 999));
    assert.deepEqual(f.stopped, []);
  }
});
test("permission denial fails instead of starting duplicate servers", async () => {
  const f = fixture([vite]);
  f.operations.terminate = () => { throw Object.assign(new Error(), { code: "EPERM" }); };
  await assert.rejects(preparePorts(root, f.operations, 999), /종료 권한이 없습니다/);
});
test("process identity changes abort termination", async () => {
  const f = fixture([vite]);
  let calls = 0;
  f.operations.inspect = pid => pid === 20 ? (++calls === 1 ? vite : { ...vite, cwd: "/other" }) : null;
  await assert.rejects(preparePorts(root, f.operations, 999), /정보가 변경/);
  assert.deepEqual(f.stopped, []);
});
test("persistent listener times out without SIGKILL", async () => {
  const f = fixture([vite]);
  f.operations.terminate = pid => f.stopped.push(pid);
  await assert.rejects(preparePorts(root, f.operations, 999), /강제 종료하지 않았습니다/);
  assert.deepEqual(f.stopped, [20]);
});
test("shell parents and current invocation ancestry are protected", async () => {
  const f = fixture([vite, { pid: 10, parentPid: 1, command: "zsh", cwd: vite.cwd }]);
  await preparePorts(root, f.operations, 999);
  assert.deepEqual(f.stopped, [20]);
  const own = fixture([vite]);
  await assert.rejects(preparePorts(root, own.operations, 20), /종료하지 않았습니다/);
  assert.deepEqual(own.stopped, []);
});
test("lsof process field parsing preserves directories with spaces", () => {
  assert.deepEqual(parseProcess("p20\nR10\ncnode\nfcwd\nn/a path/app\n"), { pid: 20, parentPid: 10, command: "node", cwd: "/a path/app" });
  assert.equal(parseProcess(""), null);
});
