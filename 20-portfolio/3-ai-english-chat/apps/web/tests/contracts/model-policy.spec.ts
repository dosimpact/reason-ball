import { expect, test } from '@playwright/test';
import { allowedChatModels, isAllowedChatModel } from '../../src/shared/api/ai/model-policy';

test('defaults to the configured primary model and mini', () => {
  expect(allowedChatModels('custom-primary')).toEqual(['custom-primary', 'gpt-5-mini']);
  expect(isAllowedChatModel('custom-primary', 'custom-primary')).toBe(true);
  expect(isAllowedChatModel('unknown', 'custom-primary')).toBe(false);
});

test('normalizes explicit allowlists without automatically adding the default', () => {
  const configured = ' alternative, alternative, mini, ,';
  expect(allowedChatModels('default', configured)).toEqual(['alternative', 'mini']);
  expect(isAllowedChatModel('default', 'default', configured)).toBe(false);
  expect(isAllowedChatModel('alternative', 'default', configured)).toBe(true);
  expect(configured).toBe(' alternative, alternative, mini, ,');
});

test('an explicitly empty allowlist permits no models', () => {
  expect(allowedChatModels('primary', '')).toEqual([]);
  expect(isAllowedChatModel('primary', 'primary', ' , ')).toBe(false);
});
