import { outboxSchema, type ChatOutbox } from '../model/outbox';
type OutboxStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function outboxKey(ownerId: string, conversationId: string) {
  if (!ownerId || !conversationId) throw new Error('전송 기록의 사용자와 대화를 확인하지 못했어요.');
  return `persona-chat-outbox-v1:${encodeURIComponent(ownerId)}:${encodeURIComponent(conversationId)}`;
}

export function createOutboxStorage(storage: OutboxStorage, ownerId: string, conversationId: string) {
  const key = outboxKey(ownerId, conversationId);
  function read(): ChatOutbox | undefined {
    const raw = storage.getItem(key);
    if (raw === null) return undefined;
    const entry = outboxSchema.parse(JSON.parse(raw));
    if (entry.conversationId !== conversationId) throw new Error('전송 기록의 대화가 일치하지 않아요.');
    return entry;
  }
  return {
    read,
    write(entry: ChatOutbox) {
      const parsed = outboxSchema.parse(entry);
      if (parsed.conversationId !== conversationId) throw new Error('전송 기록의 대화가 일치하지 않아요.');
      const previous = read();
      if (previous && JSON.stringify(previous) !== JSON.stringify(parsed)) throw new Error('확인하지 못한 이전 전송이 있어요. 대화를 새로 불러와 복구해 주세요.');
      storage.setItem(key, JSON.stringify(parsed));
    },
    clear(expectedUserId: string) {
      if (read()?.userMessageId === expectedUserId) storage.removeItem(key);
    },
    discard() { storage.removeItem(key); },
  };
}

// Cross-tab read/compare/write sequences use the same origin-scoped Web Lock.
export function withBrowserOutbox<T>(ownerId: string, conversationId: string, operation: (store: ReturnType<typeof createOutboxStorage>) => T): Promise<T> {
  if (!navigator.locks) return Promise.reject(new Error('이 브라우저에서는 안전한 전송 기록 잠금을 사용할 수 없어요.'));
  return navigator.locks.request(outboxKey(ownerId, conversationId), () => operation(createOutboxStorage(window.localStorage, ownerId, conversationId)));
}
