import type { StorybookConfig } from "@storybook/react-vite";
import { editorModuleAliases } from "../config/editor-modules";
const config: StorybookConfig = {
  viteFinal: async (config) => {
    config.resolve ??= {};
    config.resolve.alias = { ...config.resolve.alias, ...editorModuleAliases };
    return config;
  },
  stories: ["../src/**/*.stories.tsx"],
  framework: "@storybook/react-vite",
};
export default config;
