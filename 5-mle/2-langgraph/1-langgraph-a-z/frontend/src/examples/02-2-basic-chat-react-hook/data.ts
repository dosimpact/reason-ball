export type BasicChatState = {
  messages?: Array<{
    id?: string;
    type?: string;
    role?: string;
    content?: unknown;
  }>;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
};
