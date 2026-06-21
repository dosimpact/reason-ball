export const remotes = {
  template: {
    name: "template",
    label: "Template remote",
    entry: "http://localhost:2801/remotes/template/remoteEntry.js",
  },
  todo: {
    name: "todo",
    label: "Todo remote",
    entry: "http://localhost:2801/remotes/todo/remoteEntry.js",
  },
} as const;

export type RemoteName = keyof typeof remotes;

export function getRemoteConfig(name: RemoteName) {
  return remotes[name];
}
