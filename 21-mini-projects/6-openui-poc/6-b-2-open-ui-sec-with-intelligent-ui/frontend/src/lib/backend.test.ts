// Next.js 내부 URL 정규화와 브라우저 Host가 달라도 동일 출처 요청은 허용합니다.
import { afterEach, expect, it, vi } from 'vitest';
import { relay } from './backend';
afterEach(() => vi.unstubAllGlobals());
it('relays the browser host even when Next normalizes the internal URL', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetcher);
  const response = await relay(new Request('http://localhost:3046/api/chat', {
    method:'POST', headers:{origin:'http://127.0.0.1:3046',host:'127.0.0.1:3046'}, body:'{}',
  }), 'chat');
  expect(response.status).toBe(200);
  expect(fetcher).toHaveBeenCalledOnce();
});
it.each(['https://other.example','http://127.0.0.1:9999','null'])('rejects cross-origin %s before proxying', async origin => {
  const fetcher=vi.fn(); vi.stubGlobal('fetch',fetcher);
  const response=await relay(new Request('http://localhost:3046/api/chat',{
    method:'POST',headers:{origin,host:'127.0.0.1:3046'},body:'{}',
  }),'chat');
  expect(response.status).toBe(403);
  expect(fetcher).not.toHaveBeenCalled();
});
