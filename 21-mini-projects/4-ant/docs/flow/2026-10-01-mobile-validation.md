# 2026-10-01 mobile implementation and validation

## Context and current change

Ant Atelier now has an Expo SDK 54 / React Native 0.81 native shell for iOS and Android alongside the React web game. The WebView receives an inline bundled HTML module generated from the same web source. Safe areas, app background pause, validated versioned bridge messages, UMP initialization/privacy form, earned-only rewarded hints, and capped interstitials are implemented. Current architecture/ad requirements should be folded into the project's system/test stock designs; this record supplies evidence rather than replacing stock.

AdMob requests use test IDs for development/preview and require all actual app/unit identifiers and both production flags for production config. `ANT_ADS_PRODUCTION=1 EXPO_PUBLIC_ANT_ADS_PRODUCTION=1 pnpm --filter @ant-atelier/mobile exec expo config --type public` fails explicitly without the real rewarded ID. No production ad/account/store operation was performed.

AdMob is pinned to 16.0.0: resolving ^16 to16.5 selected GMA25.4 Kotlin2.3 metadata, which failed with Expo54 Kotlin2.1. The attempted Kotlin2.3 build-properties override also failed because SDK54 has no matching KSP mapping. Clean prebuild with16.0/GMA24.6 compiled successfully. Generated native folders remain ignored.

## Validation

| Check | Result | Evidence / limitation |
|---|---|---|
| Native TypeScript | PASS | `pnpm --filter @ant-atelier/mobile typecheck` |
| Bridge and ad adapter | PASS | `pnpm --filter ant-atelier test:mobile`: 8 tests. Invalid payloads, consent gate, earned-only rewards, error/close denial, concurrency/load timeout, interstitial cap, privacy initialization, disposal. SDK is mocked. |
| Expo config and clean prebuild | PASS | iOS/Android native config generated; Android manifest contains Google test app ID and delayed measurement. |
| iOS/Android JS export | PASS | Hermes bundles generated for both platforms. Export is not native iOS compilation. |
| Android debug native build | PASS | Installed and rendered actual WebView on owned Pixel8Pro API35 AVD. |
| Android release native build | PASS | `expo run:android --variant release --no-bundler --device Pixel_8_Pro_API_35`; native compile completed in2m52s. APK: `mobile/android/app/build/outputs/apk/release/app-release.apk` (ignored build output; local debug signing). |
| Offline cold launch | PASS | Stopped Metro, disabled emulator Wi-Fi/data, force-stopped package, then launched `com.reasonball.antatelier/.MainActivity`. Game rendered without network/Metro, and ads failed safely with “Ads unavailable · game works offline”. [Screenshot](evidence/android-release-offline.png). Network restored afterward. |
| Actual rewarded test ad | PASS | Stable release package displayed Google TEST AD; watched until native “Reward granted”, clicked only close X. On return, actual game showed “1번 상자를 선택해 보세요.” and outlined first lane. [Earned test ad](evidence/android-reward-earned.png), [hint delivery](evidence/android-hint-granted.png). No advertiser/Install link clicked. |
| Background pause | PASS | Sent HOME from active game (2:45 countdown), waited10seconds, resumed same task. Immediate activity-return animation still displayed2:45, then foreground countdown resumed. Native lifecycle pause is also observed during rewarded ad. |
| Actual interstitial | NOT RUN | Natural-break policy tested through mocked SDK; no forced level completion/native interstitial exposure. |
| iOS native simulator/device | BLOCKED | `xcode-select -p` points to CommandLineTools; full Xcode/simctl unavailable. |
| EAS cloud build | NOT RUN | Committed `eas-build-post-install` generates offline module from uploaded workspace source. Cloud build/auth/account not exercised. |

The initial debug test overlapped Metro hot reload while the ad was open. Its queue labels and timer reset were incorrectly inferred as reward effects; neither is an ad reward. The stable release repeat above supersedes that observation and verifies only a hint message/lane highlight.

## Build reproduction and lifecycle

Use root workspace `pnpm --filter ant-atelier build:mobile` before native typecheck/export or local native build. EAS invocation runs in the mobile folder, but upload the whole Git workspace/root lockfile; `eas-build-post-install` regenerates the ignored HTML module on the worker. No nested pnpm workspace or lockfile exists.

The validation owned AVD `Pixel_8_Pro_API_35`, adb serial `emulator-5554`, qemu PID50324. Owned Metro session on8081 was stopped after native debug validation, before offline release testing. The initial owned emulator was shut down after collection, then relaunched at the parent agent request to leave the release game available for user inspection. Unrelated servers/devices were not terminated.

Final inspection state: relaunched owned emulator qemu PID58052 / adb `emulator-5554`; release package remains installed and MainActivity is foreground. Metro8081 remains stopped. This emulator is intentionally left running for inspection at the parent agent request.
