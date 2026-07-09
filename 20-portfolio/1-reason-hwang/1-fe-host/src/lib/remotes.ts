export const remotes = {
  template: {
    name: "template",
    label: "Template remote",
    entry: "/api/proxy/remotes/template/remoteEntry.js",
  },
  todo: {
    name: "todo",
    label: "Todo remote",
    entry: "/api/proxy/remotes/todo/remoteEntry.js",
  },
} as const;

export type RemoteName = keyof typeof remotes;

export function getRemoteConfig(name: RemoteName) {
  return remotes[name];
}
