import { Platform } from "react-native";
import mobileAds, {
  AdsConsent,
  AdEventType,
  RewardedAdEventType,
  RewardedAd,
  InterstitialAd,
  TestIds,
} from "react-native-google-mobile-ads";
const production = process.env.EXPO_PUBLIC_ANT_ADS_PRODUCTION === "1";
function unit(format: "rewarded" | "interstitial"): string {
  const value =
    Platform.OS === "ios"
      ? format === "rewarded"
        ? process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED_ID
        : process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID
      : format === "rewarded"
        ? process.env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_ID
        : process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID;
  if (!production)
    return format === "rewarded" ? TestIds.REWARDED : TestIds.INTERSTITIAL;
  if (
    !value ||
    !/^ca-app-pub-\d+\/\d+$/.test(value) ||
    value.includes("3940256099942544")
  )
    throw new Error(`Production ${format} ad unit is missing`);
  return value;
}
export class AdService {
  private enabled = false;
  private busy = false;
  private disposed = false;
  private initialized = false;
  private lastInterstitial = 0;
  private lastLevel = 0;
  private completed = 0;
  private cancel: (() => void) | null = null;
  async initialize() {
    await AdsConsent.gatherConsent();
    const info = await AdsConsent.getConsentInfo();
    if (!info.canRequestAds || this.disposed) return;
    await this.initializeSDK();
    this.enabled = !this.disposed;
  }
  async privacy() {
    if (this.busy) return;
    await AdsConsent.showPrivacyOptionsForm();
    const info = await AdsConsent.getConsentInfo();
    if (info.canRequestAds && !this.disposed) await this.initializeSDK();
    this.enabled = info.canRequestAds && !this.disposed;
  }
  private async initializeSDK() {
    if (this.initialized) return;
    await mobileAds().initialize();
    this.initialized = true;
  }
  dispose() {
    this.disposed = true;
    this.enabled = false;
    this.cancel?.();
  }
  rewarded(): Promise<boolean> {
    if (!this.enabled || this.busy || this.disposed)
      return Promise.resolve(false);
    return this.show("rewarded");
  }
  async levelComplete(level: number): Promise<void> {
    if (level <= this.lastLevel) return;
    this.lastLevel = level;
    this.completed++;
    if (
      !this.enabled ||
      this.busy ||
      this.completed % 3 !== 0 ||
      Date.now() - this.lastInterstitial < 180_000
    )
      return;
    this.lastInterstitial = Date.now();
    await this.show("interstitial");
  }
  private show(format: "rewarded" | "interstitial"): Promise<boolean> {
    this.busy = true;
    return new Promise((resolve) => {
      let earned = false;
      let finished = false;
      const cleanups: (() => void)[] = [];
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        cleanups.forEach((off) => off());
        this.cancel = null;
        this.busy = false;
        resolve(earned);
      };
      let timeout = setTimeout(finish, 15_000);
      this.cancel = finish;
      try {
        const ad =
          format === "rewarded"
            ? RewardedAd.createForAdRequest(unit(format))
            : InterstitialAd.createForAdRequest(unit(format));
        if (ad instanceof RewardedAd) {
          cleanups.push(ad.addAdEventListener(AdEventType.ERROR, finish));
          cleanups.push(ad.addAdEventListener(AdEventType.CLOSED, finish));
          cleanups.push(
            ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
              earned = true;
            }),
          );
          cleanups.push(
            ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
              clearTimeout(timeout);
              timeout = setTimeout(finish, 180_000);
              void ad.show().catch(finish);
            }),
          );
        } else {
          cleanups.push(ad.addAdEventListener(AdEventType.ERROR, finish));
          cleanups.push(ad.addAdEventListener(AdEventType.CLOSED, finish));
          cleanups.push(
            ad.addAdEventListener(AdEventType.LOADED, () => {
              clearTimeout(timeout);
              timeout = setTimeout(finish, 180_000);
              void ad.show().catch(finish);
            }),
          );
        }
        ad.load();
      } catch {
        finish();
      }
    });
  }
}
