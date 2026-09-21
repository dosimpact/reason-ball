import type { StorybookConfig } from "@storybook/react-vite";
import { fileURLToPath } from "node:url";
const config: StorybookConfig = {
  stories: ["../src/**/*.stories.tsx"],
  framework: "@storybook/react-vite",
  async viteFinal(config) {
    return {
      ...config,
      resolve: {
        ...config.resolve,
        alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
      },
    };
  },
};
export default config;
