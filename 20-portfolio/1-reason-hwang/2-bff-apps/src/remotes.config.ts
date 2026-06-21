export type RemoteConfig = {
  name: string;
  devServer: string;
  staticPath: string;
};

export const remotes = [
  {
    name: 'template',
    devServer: 'http://localhost:2802',
    staticPath: 'remotes/template/dist',
  },
  {
    name: 'todo',
    devServer: 'http://localhost:2803',
    staticPath: 'remotes/todo/dist',
  },
] satisfies RemoteConfig[];
