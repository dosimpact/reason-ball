import type { Page } from "@playwright/test";

export async function installCleanAppState(page: Page) {
  await page.addInitScript(() => {
    const marker = "lingua-e2e-storage-cleared";

    if (window.sessionStorage.getItem(marker) !== "1") {
      window.localStorage.clear();
      window.sessionStorage.setItem(marker, "1");
    }
  });
}

export async function installChatBrowserStubs(page: Page) {
  await page.addInitScript(() => {
    const state = window as typeof window & {
      __e2eClipboardText?: string;
    };

    class E2EAudio {
      pause() {}

      removeAttribute() {}

      load() {}

      addEventListener() {
        // Keep playback active so the visible playing state can be asserted.
      }

      play() {
        return Promise.resolve();
      }
    }

    Object.defineProperty(window, "Audio", {
      configurable: true,
      value: E2EAudio,
    });

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          state.__e2eClipboardText = text;
        },
      },
    });

    URL.createObjectURL = () => "blob:lingua-e2e-audio";
  });
}
