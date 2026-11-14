import type { ConfigContext, ExpoConfig } from 'expo/config'
import { resolveWebUrl } from './src/web-policy'

export default ({ config }: ConfigContext): ExpoConfig => {
  // APP_ENV is explicit for EAS; local release exports must also opt into production.
  const development =
    process.env.APP_ENV === 'development' ||
    (!process.env.APP_ENV && process.env.NODE_ENV !== 'production')
  const webUrl = resolveWebUrl(process.env.EXPO_PUBLIC_WEB_URL, development)
  const host = new URL(webUrl).hostname
  const http = development && webUrl.startsWith('http:')
  return {
    ...config,
    name: 'Rain Room',
    slug: 'rain-room',
    version: '0.1.0',
    icon: './assets/icon.png',
    scheme: 'rainroom',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    // Provisional identity: confirm ownership before creating the EAS project or store records.
    ios: {
      bundleIdentifier: 'com.dosimpact.rainroom',
      supportsTablet: true,
      buildNumber: '1',
      infoPlist: http
        ? {
            NSAppTransportSecurity: {
              NSAllowsLocalNetworking: true,
              NSExceptionDomains: {
                [host]: { NSExceptionAllowsInsecureHTTPLoads: true, NSIncludesSubdomains: false },
              },
            },
          }
        : {},
    },
    android: { package: 'com.dosimpact.rainroom', versionCode: 1 },
    plugins: [
      'expo-dev-client',
      [
        'expo-splash-screen',
        { image: './assets/splash.png', imageWidth: 200, backgroundColor: '#182820' },
      ],
      ['./plugins/with-development-http.cjs', { enabled: http, host }],
    ],
    extra: {
      webUrl,
      development,
      ...(process.env.EXPO_PROJECT_ID ? { eas: { projectId: process.env.EXPO_PROJECT_ID } } : {}),
    },
    ...(process.env.EXPO_OWNER ? { owner: process.env.EXPO_OWNER } : {}),
  }
}
