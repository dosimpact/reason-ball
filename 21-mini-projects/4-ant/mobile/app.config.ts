import type { ExpoConfig } from "expo/config";
const production =
  process.env.ANT_ADS_PRODUCTION === "1" ||
  process.env.EAS_BUILD_PROFILE === "production";
if (production) {
  if (process.env.EXPO_PUBLIC_ANT_ADS_PRODUCTION !== "1")
    throw new Error("Production requires EXPO_PUBLIC_ANT_ADS_PRODUCTION=1");
  for (const name of [
    "EXPO_PUBLIC_ADMOB_IOS_REWARDED_ID",
    "EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID",
    "EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_ID",
    "EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID",
  ]) {
    const value = process.env[name];
    if (
      !value ||
      !/^ca-app-pub-\d+\/\d+$/.test(value) ||
      value.includes("3940256099942544")
    )
      throw new Error(`Production requires a real ${name}`);
  }
}
function appId(name: string, fallback: string) {
  const value = process.env[name];
  if (
    production &&
    (!value ||
      !/^ca-app-pub-\d+~\d+$/.test(value) ||
      value.includes("3940256099942544"))
  ) {
    throw new Error(`Production requires a real ${name}`);
  }
  return production ? value! : fallback;
}
const config: ExpoConfig = {
  platforms: ["ios", "android"],
  name: "Cat Atelier",
  slug: "ant-atelier",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  newArchEnabled: true,
  ios: { bundleIdentifier: "com.reasonball.antatelier", supportsTablet: true },
  android: { package: "com.reasonball.antatelier" },
  plugins: [
    [
      "react-native-google-mobile-ads",
      {
        androidAppId: appId(
          "ANT_ADMOB_ANDROID_APP_ID",
          "ca-app-pub-3940256099942544~3347511713",
        ),
        iosAppId: appId(
          "ANT_ADMOB_IOS_APP_ID",
          "ca-app-pub-3940256099942544~1458002511",
        ),
        delayAppMeasurementInit: true,
        userTrackingUsageDescription:
          "Your permission helps support Cat Atelier through relevant advertising.",
      },
    ],
  ],
};
export default config;
