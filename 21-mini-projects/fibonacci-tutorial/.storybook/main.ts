import type { StorybookConfig } from "@storybook/react-vite";
import { fileURLToPath } from "node:url";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [],
  framework: { name: "@storybook/react-vite", options: {} },
  async viteFinal(config) {
    config.resolve ??= {};
    config.resolve.alias = { "@": fileURLToPath(new URL("../src", import.meta.url)) };
    return config;
  },
};

export default config;
