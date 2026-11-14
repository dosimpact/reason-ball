import 'dotenv/config';

export type RemoteConfig = {
  name: string;
  devServer: string;
  staticPath: string;
};

export const remotes = [
  {
    name: 'template',
    devServer: process.env.REMOTE_TEMPLATE_URL ?? 'http://127.0.0.1:2984',
    staticPath: 'remotes/template/dist',
  },
  {
    name: 'todo',
    devServer: process.env.REMOTE_TODO_URL ?? 'http://127.0.0.1:2985',
    staticPath: 'remotes/todo/dist',
  },
] satisfies RemoteConfig[];
