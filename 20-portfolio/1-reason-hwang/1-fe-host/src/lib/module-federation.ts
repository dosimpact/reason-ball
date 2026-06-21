import { init, loadRemote, registerRemotes } from "@module-federation/runtime";

import { getRemoteConfig, type RemoteName } from "@/lib/remotes";

type RemoteMountModule = {
  mount: (container: HTMLElement) => () => void;
};

let runtimeInitialized = false;

function ensureFederationRuntime() {
  if (!runtimeInitialized) {
    init({
      name: "reason_hwang_host",
      remotes: [],
    });
    runtimeInitialized = true;
  }
}

export async function loadRemoteMount(name: RemoteName) {
  const remote = getRemoteConfig(name);

  ensureFederationRuntime();

  registerRemotes(
    [
      {
        name: remote.name,
        entry: remote.entry,
        alias: remote.name,
        type: "module",
      },
    ],
    {
      force: true,
    },
  );

  const remoteModule = await loadRemote<RemoteMountModule>(
    `${remote.name}/mount`,
  );

  if (!remoteModule?.mount) {
    throw new Error(`Remote "${remote.name}" did not expose ./mount.`);
  }

  return remoteModule.mount;
}
