import { generateDummyPassword } from "./db/utils";

export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT
);

const PLACEHOLDER_GATEWAY_KEY_PATTERNS = [
  /\*+/,
  /placeholder/i,
  /^dev[-_]/i,
  /^local[-_]/i,
  /^test[-_]/i,
  /^changeme$/i,
];

export function hasUsableAiGatewayKey() {
  const key = process.env.AI_GATEWAY_API_KEY?.trim() ?? "";

  if (key.length < 20) {
    return false;
  }

  return !PLACEHOLDER_GATEWAY_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

export const guestRegex = /^guest-\d+$/;

export const DUMMY_PASSWORD = generateDummyPassword();
