import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Constants from 'expo-constants'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import { navigationAction, resolveWebUrl } from './web-policy'
import { nativeI18n, deviceLanguage, parseNativeLanguage, configurationKey } from './native-i18n'

export default function App() {
  const webView = useRef<WebView<object>>(null)
  const [canGoBack, setCanGoBack] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<'connection' | 'http' | 'terminated' | null>(null)
  const [httpStatus, setHttpStatus] = useState(0)
  const [language, setLanguage] = useState(deviceLanguage)
  const [externalNotice, setExternalNotice] = useState(false)
  const t = nativeI18n.getFixedT(language)
  const [attempt, setAttempt] = useState(0)
  let webUrl = ''
  let configurationError: ReturnType<typeof configurationKey> | null = null
  try {
    webUrl = resolveWebUrl(
      Constants.expoConfig?.extra?.webUrl,
      Constants.expoConfig?.extra?.development === true,
    )
  } catch (reason) {
    configurationError = configurationKey(reason)
  }

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack || error) return false
      webView.current?.goBack()
      return true
    })
    return () => handler.remove()
  }, [canGoBack, error])

  const openExternal = (url: string) => {
    if (navigationAction(url, webUrl) === 'external') {
      void Linking.openURL(url).catch(() => setExternalNotice(true))
    }
  }
  const failure = configurationError
    ? t(configurationError)
    : error
      ? t(error, { status: httpStatus })
      : null
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        {!configurationError && !error && (
          <WebView<object>
            key={attempt}
            ref={webView}
            source={{ uri: webUrl }}
            style={styles.web}
            originWhitelist={['*']}
            onShouldStartLoadWithRequest={(request) => {
              const action = navigationAction(request.url, webUrl)
              if (action === 'external') openExternal(request.url)
              return action === 'internal'
            }}
            onMessage={({ nativeEvent }) => {
              const next = parseNativeLanguage(nativeEvent.data, nativeEvent.url, webUrl)
              if (next) setLanguage(next)
            }}
            onOpenWindow={({ nativeEvent }) => openExternal(nativeEvent.targetUrl)}
            onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
            onLoadStart={({ nativeEvent }) => setLoading(nativeEvent.loading)}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false)
              setError('connection')
            }}
            onHttpError={({ nativeEvent }) => {
              if (nativeEvent.url === webUrl) {
                setLoading(false)
                setHttpStatus(nativeEvent.statusCode)
                setError('http')
              }
            }}
            onContentProcessDidTerminate={() => {
              setLoading(false)
              setError('terminated')
            }}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction
            allowsFullscreenVideo={false}
            mixedContentMode="never"
            setSupportMultipleWindows
            allowFileAccess={false}
            allowFileAccessFromFileURLs={false}
            allowUniversalAccessFromFileURLs={false}
          />
        )}
        {loading && !failure && (
          <View style={styles.overlay} accessibilityLiveRegion="polite">
            <ActivityIndicator color="#d9c8a3" />
            <Text style={styles.text}>{t('loading')}</Text>
          </View>
        )}
        {externalNotice && !failure && (
          <View style={styles.notice} accessibilityLiveRegion="polite">
            <Text style={styles.text} accessibilityRole="alert">
              {t('external')}
            </Text>
            <Pressable
              accessibilityRole="button"
              style={styles.button}
              onPress={() => setExternalNotice(false)}
            >
              <Text style={styles.buttonText}>{t('dismiss')}</Text>
            </Pressable>
          </View>
        )}
        {failure && (
          <View style={styles.overlay}>
            <Text style={styles.title}>{t('title')}</Text>
            <Text style={styles.text}>{failure}</Text>
            {!configurationError && (
              <Pressable
                accessibilityRole="button"
                style={styles.button}
                onPress={() => {
                  setError(null)
                  setLoading(true)
                  setCanGoBack(false)
                  setAttempt((value) => value + 1)
                }}
              >
                <Text style={styles.buttonText}>{t('retry')}</Text>
              </Pressable>
            )}
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  )
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#182820' },
  web: { flex: 1, backgroundColor: '#182820' },
  notice: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: '#182820',
    borderColor: '#d9c8a3',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#182820',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 18,
  },
  text: { color: '#e4ddce', textAlign: 'center', lineHeight: 24 },
  title: { color: '#f4ead7', fontSize: 22, fontWeight: '600' },
  button: {
    backgroundColor: '#d9c8a3',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
    minHeight: 48,
  },
  buttonText: { color: '#182820', fontWeight: '600' },
})
