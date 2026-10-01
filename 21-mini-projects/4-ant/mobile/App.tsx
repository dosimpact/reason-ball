import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";
import { gameHtml } from "./generated/game-html";
import { AdService } from "./ads";
import { eventScript, parseMessage, type NativeMessage } from "./bridge";
export default function App() {
  const web = useRef<WebView>(null);
  const ads = useMemo(() => new AdService(), []);
  const [notice, setNotice] = useState(
    process.env.EXPO_PUBLIC_ANT_ADS_PRODUCTION === "1"
      ? "Offline game"
      : "Test ads · offline game",
  );
  const active = useRef(AppState.currentState === "active");
  const adOpen = useRef(true);
  const processed = useRef(new Set<string>());
  const pending = useRef(new Set<string>());
  const send = (message: NativeMessage) =>
    web.current?.injectJavaScript(eventScript(message));
  const syncPause = () =>
    send({ v: 1, type: "PAUSE", paused: !active.current || adOpen.current });
  useEffect(() => {
    void ads
      .initialize()
      .catch(() => setNotice("Ads unavailable · game works offline"))
      .finally(() => {
        adOpen.current = false;
        syncPause();
      });
    const subscription = AppState.addEventListener("change", (state) => {
      active.current = state === "active";
      syncPause();
    });
    return () => {
      subscription.remove();
      ads.dispose();
    };
  }, [ads]);
  async function privacy() {
    adOpen.current = true;
    syncPause();
    try {
      await ads.privacy();
      setNotice("Privacy choices updated");
    } catch {
      setNotice("Privacy form unavailable; try again online");
    } finally {
      adOpen.current = false;
      syncPause();
    }
  }
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <View style={styles.bar}>
          <Text style={styles.notice}>{notice}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Advertising privacy options"
            onPress={() => void privacy()}
          >
            <Text style={styles.button}>Privacy options</Text>
          </Pressable>
        </View>
        <WebView
          ref={web}
          style={styles.game}
          source={{ html: gameHtml, baseUrl: "about:blank" }}
          originWhitelist={["about:blank"]}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled
          allowFileAccess={false}
          allowUniversalAccessFromFileURLs={false}
          mixedContentMode="never"
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={(request) =>
            request.url === "about:blank" || request.url === "about:srcdoc"
          }
          onMessage={(event) => {
            const message = parseMessage(event.nativeEvent.data);
            if (!message) return;
            if (message.type === "READY") {
              syncPause();
              return;
            }
            if (!active.current || adOpen.current) {
              if (
                message.type === "REWARDED_HINT" &&
                !pending.current.has(message.requestId)
              ) {
                send({
                  v: 1,
                  type: "REWARDED_RESULT",
                  requestId: message.requestId,
                  earned: false,
                });
              }
              return;
            }
            if (message.type === "REWARDED_HINT") {
              if (
                pending.current.has(message.requestId) ||
                processed.current.has(message.requestId)
              )
                return;
              processed.current.add(message.requestId);
              if (processed.current.size > 256)
                processed.current.delete(
                  processed.current.values().next().value!,
                );
              pending.current.add(message.requestId);
              adOpen.current = true;
              syncPause();
              void ads
                .rewarded()
                .then((earned) => {
                  send({
                    v: 1,
                    type: "REWARDED_RESULT",
                    requestId: message.requestId,
                    earned,
                  });
                  if (!earned)
                    setNotice(
                      "No reward earned · try again when an ad is available",
                    );
                })
                .finally(() => {
                  pending.current.delete(message.requestId);
                  adOpen.current = false;
                  syncPause();
                });
            } else {
              adOpen.current = true;
              syncPause();
              void ads.levelComplete(message.level).finally(() => {
                adOpen.current = false;
                syncPause();
              });
            }
          }}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#111510" },
  game: { flex: 1, backgroundColor: "#111510" },
  bar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 10,
  },
  notice: { color: "#b5bca8", fontSize: 11, flex: 1 },
  button: { color: "#d6eba5", fontSize: 12, padding: 6 },
});
