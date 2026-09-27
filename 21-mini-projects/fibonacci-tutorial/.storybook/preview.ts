import type { Preview } from "@storybook/react-vite";
import "../src/app/globals.css";

const preview: Preview = {
  initialGlobals: { theme: "light" },
  globalTypes: { theme: { description: "Primer color mode", toolbar: { icon: "circlehollow", items: ["light", "dark"], dynamicTitle: true } } },
  decorators: [(Story, context) => {
    document.documentElement.dataset.colorMode = context.globals.theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.lightTheme = "light";
    document.documentElement.dataset.darkTheme = "dark";
    return Story();
  }],
  parameters: { layout: "fullscreen", controls: { expanded: true } },
};

export default preview;
