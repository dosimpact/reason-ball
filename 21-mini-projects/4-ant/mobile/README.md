# Cat Atelier native app

Expo SDK 54 / React Native 0.81 hosts the exact React Canvas game in an offline WebView. No remote game URL or arbitrary bridge script is loaded. The native shell supplies safe areas, app lifecycle pause, UMP privacy choices, and AdMob ads. Navigation is limited to the inline document.

From repository root:

```sh
pnpm --filter ant-atelier build:mobile
pnpm --filter @ant-atelier/mobile typecheck
pnpm --filter @ant-atelier/mobile build
pnpm --filter @ant-atelier/mobile prebuild
pnpm --filter @ant-atelier/mobile android
# Requires full Xcode, not only Command Line Tools:
pnpm --filter @ant-atelier/mobile ios
```

The web build creates ignored `mobile/generated/game-html.ts`; regenerate it after game edits. Native folders are generated and ignored. Expo Go cannot run the AdMob native module: install a development build and use `pnpm --filter @ant-atelier/mobile dev` instead. Offline game loading does not mean ads work offline; unavailable or failed ads never grant a hint.

## Advertising

Development and preview always use Google test app and unit IDs. Ads initialize only after UMP returns `canRequestAds`. Configure consent/ATT messages in AdMob before shipping. Privacy options reopen the native UMP form. The shell pauses the game during ads and when the app is backgrounded. A rewarded hint is granted only after `EARNED_REWARD`; closing or errors return no reward. Interstitials occur only on every third newly completed level with a minimum three minute interval. There are no launch ads or banner overlays.

Production builds fail without all IDs below. Set `ANT_ADS_PRODUCTION=1` and `EXPO_PUBLIC_ANT_ADS_PRODUCTION=1`, plus:

- `ANT_ADMOB_IOS_APP_ID` and `ANT_ADMOB_ANDROID_APP_ID` (app IDs use `~`)
- `EXPO_PUBLIC_ADMOB_IOS_REWARDED_ID` and `EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_ID`
- `EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID` and `EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID` (unit IDs use `/`)

EAS production profile sets the flags; supply actual IDs through EAS environment configuration. Identifiers are public configuration, not secrets. Replace example application identifiers with owned identifiers, add store icons/privacy disclosures, and configure the AdMob account before release. No store publication or revenue result is implied by this implementation.

## Bridge

Web sends `{v:1,type:'READY'}`, `{v:1,type:'REWARDED_HINT',requestId}`, or `{v:1,type:'LEVEL_COMPLETE',level}` through `ReactNativeWebView.postMessage`. Native validates size/version/types and dispatches `ant:native` with `{v:1,type:'PAUSE',paused}` or `{v:1,type:'REWARDED_RESULT',requestId,earned}`. A request ID is matched by the game; an unsolicited result must never grant a hint. Bridge payloads contain no executable code.

Official references: [Expo WebView](https://docs.expo.dev/versions/v54.0.0/sdk/webview/), [development builds](https://docs.expo.dev/develop/development-builds/introduction/), [AdMob integration](https://docs.page/invertase/react-native-google-mobile-ads), [UMP consent](https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent).

## Validation (2026-10-01)

- Typecheck, bridge/ad adapter mock tests, Expo config, clean native prebuild, and iOS/Android Hermes export passed.
- Android debug and release native compilation, installation, and actual WebView rendering passed on an owned Pixel 8 Pro API 35 emulator.
- Release app was force stopped and relaunched with Wi-Fi/data disabled and Metro stopped: the game rendered from the bundled HTML. Offline ad initialization failed safely while play remained available.
- An actual Google rewarded test ad displayed and reported “Reward granted”; advertiser links were never clicked. A stable release repeat delivered the expected “1번 상자를 선택해 보세요.” message and highlighted lane 1 after closing the earned test ad. The initial debug attempt overlapped hot reload and is not used as hint-delivery evidence.
- iOS native compilation/device validation is unavailable on this machine because only Xcode Command Line Tools are installed. Expo iOS export is not an iOS native build.

`react-native-google-mobile-ads` is pinned to 16.0.0 because 16.5.0 brings Android GMA 25.4 compiled with Kotlin 2.3 metadata, while Expo SDK 54 uses Kotlin 2.1 and does not support the required Kotlin 2.3 KSP mapping. The compatible pin compiled successfully; upgrade Expo/native dependencies together before upgrading this library.

EAS runs from `21-mini-projects/4-ant/mobile` (`pnpm exec eas build --profile development --platform android`). Upload the entire Git workspace with its root pnpm lockfile and web sources; the committed `eas-build-post-install` hook runs the root workspace filtered web build to generate the ignored offline HTML module on the build worker. Do not upload only the mobile directory.
