import { expect, test } from '@playwright/test';
import { buildChatModelEntries, parseChatModelEntries, unknownModelCapabilities, unsupportedChatInput } from '../../src/shared/api/ai/model-catalog';

test('does not infer live model features from names, and distinguishes mock fixtures', () => {
  expect(buildChatModelEntries(['vision-pro', 'vision-pro'], undefined, false)).toEqual([
    { id: 'vision-pro', capabilitySource: 'unverified', capabilities: unknownModelCapabilities },
  ]);
  expect(buildChatModelEntries(['fixture'], undefined, true)[0]).toEqual({
    id: 'fixture', capabilitySource: 'mock', capabilities: { vision: true, documents: true, tools: true, reasoning: false },
  });
  expect(buildChatModelEntries([], '{}', false)).toEqual([]);
});

test('applies explicit tri-state features only to allowed IDs without mutating inputs', () => {
  const ids = Object.freeze(['a']);
  const config = JSON.stringify({ a: { vision: false, tools: true, reasoning: null }, forbidden: { vision: true } });
  expect(buildChatModelEntries(ids, config, true)).toEqual([{ id: 'a', capabilitySource: 'configured', capabilities: { vision: false, tools: true, reasoning: null, documents: null } }]);
  expect(ids).toEqual(['a']);
});

test('rejects malformed configuration, unknown fields and non-boolean flags', () => {
  for (const config of ['{', '[]', 'null', '{"a":{"vision":"true"}}', '{"a":{"apiKey":"secret"}}']) {
    expect(() => buildChatModelEntries(['a'], config, false)).toThrow();
  }
});

test('validates public entries and rejects conflicting duplicates and leaked fields', () => {
  const entry = buildChatModelEntries(['a'], undefined, false)[0];
  expect(parseChatModelEntries([entry, entry])).toEqual([entry]);
  expect(parseChatModelEntries([])).toEqual([]);
  for (const input of [null, [{ id: 'a' }], [{ ...entry, apiKey: 'secret' }], [entry, { ...entry, capabilities: { ...entry.capabilities, vision: true } }]]) {
    expect(() => parseChatModelEntries(input)).toThrow();
  }
});

test('requires explicit file and tool support across the whole message history', () => {
  const image = { parts: [{ type: 'file', mediaType: 'image/png' }] };
  const pdf = { parts: [{ type: 'file', mediaType: 'application/pdf' }] };
  const text = { parts: [{ type: 'text' }] };
  expect(unsupportedChatInput(unknownModelCapabilities, [text])).toBeUndefined();
  expect(unsupportedChatInput(unknownModelCapabilities, [])).toBeUndefined();
  expect(unsupportedChatInput(unknownModelCapabilities, [image, text])).toBe('vision');
  expect(unsupportedChatInput({ ...unknownModelCapabilities, vision: true }, [image, pdf])).toBe('documents');
  for (const type of ['tool-weather', 'dynamic-tool']) expect(unsupportedChatInput(unknownModelCapabilities, [{ parts: [{ type }] }])).toBe('tools');
  expect(unsupportedChatInput({ vision: true, documents: true, tools: true, reasoning: false }, [image, pdf, { parts: [{ type: 'tool-weather' }] }])).toBeUndefined();
});
