import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({
  canRequestAds: true,
  initialize: vi.fn(async () => []),
  created: [] as unknown[],
}));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("react-native-google-mobile-ads", () => {
  class Base {
    listeners = new Map<string, () => void>();
    static createForAdRequest() {
      const ad = new this();
      fake.created.push(ad);
      return ad;
    }
    addAdEventListener(type: string, callback: () => void) {
      this.listeners.set(type, callback);
      return () => this.listeners.delete(type);
    }
    emit(type: string) {
      this.listeners.get(type)?.();
    }
    load() {}
    async show() {}
  }
  class RewardedAd extends Base {}
  class InterstitialAd extends Base {}
  return {
    default: () => ({ initialize: fake.initialize }),
    AdsConsent: {
      gatherConsent: async () => {},
      getConsentInfo: async () => ({ canRequestAds: fake.canRequestAds }),
      showPrivacyOptionsForm: async () => {},
    },
    RewardedAd,
    InterstitialAd,
    TestIds: { REWARDED: "test-reward", INTERSTITIAL: "test-interstitial" },
    AdEventType: { ERROR: "error", CLOSED: "closed", LOADED: "loaded" },
    RewardedAdEventType: { LOADED: "reward-loaded", EARNED_REWARD: "earned" },
  };
});
import { AdService } from "./ads";
type FakeAd = { emit: (type: string) => void };
const latest = () => fake.created.at(-1) as FakeAd;
beforeEach(() => {
  fake.canRequestAds = true;
  fake.created = [];
  fake.initialize.mockClear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-01"));
});
afterEach(() => vi.useRealTimers());
describe("native advertising rules", () => {
  it("does not request ads without consent", async () => {
    fake.canRequestAds = false;
    const service = new AdService();
    await service.initialize();
    expect(await service.rewarded()).toBe(false);
    expect(fake.created).toHaveLength(0);
    expect(fake.initialize).not.toHaveBeenCalled();
  });
  it("grants only earned rewards, never closing or error", async () => {
    const service = new AdService();
    await service.initialize();
    const dismissed = service.rewarded();
    latest().emit("closed");
    expect(await dismissed).toBe(false);
    const failed = service.rewarded();
    latest().emit("error");
    expect(await failed).toBe(false);
    const earned = service.rewarded();
    latest().emit("earned");
    latest().emit("closed");
    expect(await earned).toBe(true);
  });
  it("denies concurrent rewarded requests and times out unavailable ads", async () => {
    const service = new AdService();
    await service.initialize();
    const pending = service.rewarded();
    expect(await service.rewarded()).toBe(false);
    vi.advanceTimersByTime(15000);
    expect(await pending).toBe(false);
  });
  it("shows interstitial only at third completion and after the frequency cap", async () => {
    const service = new AdService();
    await service.initialize();
    await service.levelComplete(1);
    await service.levelComplete(2);
    expect(fake.created).toHaveLength(0);
    const third = service.levelComplete(3);
    latest().emit("closed");
    await third;
    await service.levelComplete(3);
    await service.levelComplete(4);
    await service.levelComplete(5);
    await service.levelComplete(6);
    expect(fake.created).toHaveLength(1);
    vi.advanceTimersByTime(180000);
    await service.levelComplete(7);
    await service.levelComplete(8);
    const ninth = service.levelComplete(9);
    latest().emit("closed");
    await ninth;
    expect(fake.created).toHaveLength(2);
  });
  it("initializes after consent changes and cancels pending ads on disposal", async () => {
    const service = new AdService();
    fake.canRequestAds = false;
    await service.initialize();
    fake.canRequestAds = true;
    await service.privacy();
    expect(fake.initialize).toHaveBeenCalledTimes(1);
    await service.privacy();
    expect(fake.initialize).toHaveBeenCalledTimes(1);
    const pending = service.rewarded();
    service.dispose();
    expect(await pending).toBe(false);
  });
});
