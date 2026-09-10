import { expect, test } from '@playwright/test';
import { attachmentSelectionError, MAX_CHAT_FILE_BYTES } from '../../src/entities/chat/model/attachment';
import { readAttachmentDataUrl } from '../../src/entities/chat/api/read-attachment';
import { unknownModelCapabilities } from '../../src/shared/api/ai/model-catalog';

function fakeReader() {
  let aborted = 0;
  const state = {
    result: null as string | ArrayBuffer | null,
    error: null as DOMException | null,
    onload: null as ((event: ProgressEvent<FileReader>) => void) | null,
    onerror: null as ((event: ProgressEvent<FileReader>) => void) | null,
    onabort: null as ((event: ProgressEvent<FileReader>) => void) | null,
    readAsDataURL: (_file: Blob) => { void _file; },
    abort: () => { aborted++; state.onabort?.({} as ProgressEvent<FileReader>); },
  };
  return { state, reader: state as unknown as FileReader, aborted: () => aborted };
}

test('uses the same MIME, size and model policy for picker and paste metadata', () => {
  const capabilities = { ...unknownModelCapabilities, vision: true, documents: false };
  const file = Object.freeze({ type: 'image/png', size: MAX_CHAT_FILE_BYTES });
  expect(attachmentSelectionError(file, capabilities)).toBeUndefined();
  expect(attachmentSelectionError({ type: 'image/jpeg', size: 1 }, capabilities)).toBeUndefined();
  expect(attachmentSelectionError({ ...file, size: 0 }, capabilities)).toContain('비어');
  expect(attachmentSelectionError({ ...file, size: MAX_CHAT_FILE_BYTES + 1 }, capabilities)).toContain('2MB');
  expect(attachmentSelectionError({ ...file, type: 'image/svg+xml' }, capabilities)).toContain('PNG');
  expect(attachmentSelectionError({ ...file, type: 'application/pdf' }, capabilities)).toContain('지원');
  expect(attachmentSelectionError(file, unknownModelCapabilities)).toContain('지원');
  expect(file.size).toBe(MAX_CHAT_FILE_BYTES);
});

test('resolves a data URL once and removes listeners after success', async () => {
  const fake = fakeReader();
  const controller = new AbortController();
  const promise = readAttachmentDataUrl(new Blob(['x']), controller.signal, () => fake.reader);
  fake.state.result = 'data:image/png;base64,eA==';
  fake.state.onload?.({} as ProgressEvent<FileReader>);
  await expect(promise).resolves.toBe(fake.state.result);
  expect(fake.state.onload).toBeNull();
  expect(fake.state.onerror).toBeNull();
  controller.abort();
  expect(fake.aborted()).toBe(0);
});

test('propagates read failures and rejects invalid results without a pending promise', async () => {
  for (const failure of ['event', 'result', 'throw']) {
    const fake = fakeReader();
    if (failure === 'throw') fake.state.readAsDataURL = () => { throw new Error('Read failed'); };
    const promise = readAttachmentDataUrl(new Blob(['x']), new AbortController().signal, () => fake.reader);
    if (failure === 'event') fake.state.onerror?.({} as ProgressEvent<FileReader>);
    if (failure === 'result') fake.state.onload?.({} as ProgressEvent<FileReader>);
    await expect(promise).rejects.toBeInstanceOf(Error);
    expect(fake.state.onload).toBeNull();
    expect(fake.state.onerror).toBeNull();
  }
});

test('cancels in-flight reads and ignores a captured late load callback', async () => {
  const fake = fakeReader();
  const controller = new AbortController();
  const promise = readAttachmentDataUrl(new Blob(['x']), controller.signal, () => fake.reader);
  const lateLoad = fake.state.onload;
  controller.abort();
  fake.state.result = 'data:image/png;base64,eA==';
  lateLoad?.({} as ProgressEvent<FileReader>);
  await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  expect(fake.aborted()).toBe(1);
  expect(fake.state.onabort).toBeNull();
});

test('does not create a reader for an already cancelled request and handles native abort', async () => {
  const cancelled = new AbortController(); cancelled.abort();
  await expect(readAttachmentDataUrl(new Blob(), cancelled.signal, () => { throw new Error('Must not create'); })).rejects.toMatchObject({ name: 'AbortError' });
  const fake = fakeReader();
  const promise = readAttachmentDataUrl(new Blob(), new AbortController().signal, () => fake.reader);
  fake.state.onabort?.({} as ProgressEvent<FileReader>);
  await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
});
