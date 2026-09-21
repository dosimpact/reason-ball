import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

import { playwright } from '@vitest/browser-playwright';

const dirname =
  typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'a2ui',
          environment: 'node',
          include: ['src/lib/a2ui/**/*.test.ts'],
        },
      },
      {
        extends: true,
        // Prebundle the catalog before browser tests start; late discovery reloads test iframes.
        optimizeDeps: {
          include: [
            '@base-ui/react',
            '@base-ui/react/accordion',
            '@base-ui/react/alert-dialog',
            '@base-ui/react/avatar',
            '@base-ui/react/button',
            '@base-ui/react/checkbox',
            '@base-ui/react/collapsible',
            '@base-ui/react/context-menu',
            '@base-ui/react/dialog',
            '@base-ui/react/direction-provider',
            '@base-ui/react/drawer',
            '@base-ui/react/input',
            '@base-ui/react/menu',
            '@base-ui/react/menubar',
            '@base-ui/react/merge-props',
            '@base-ui/react/navigation-menu',
            '@base-ui/react/popover',
            '@base-ui/react/preview-card',
            '@base-ui/react/progress',
            '@base-ui/react/radio',
            '@base-ui/react/radio-group',
            '@base-ui/react/scroll-area',
            '@base-ui/react/select',
            '@base-ui/react/separator',
            '@base-ui/react/slider',
            '@base-ui/react/switch',
            '@base-ui/react/tabs',
            '@base-ui/react/toast',
            '@base-ui/react/toggle',
            '@base-ui/react/toggle-group',
            '@base-ui/react/tooltip',
            '@base-ui/react/use-render',
            '@shadcn/react/message-scroller',
            '@shadcn/react/questionnaire',
            'next/link',
            'cmdk',
            'cn',
            'date-fns',
            'embla-carousel-react',
            'input-otp',
            'react-day-picker',
            'react-resizable-panels',
            'recharts',
          ],
        },
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({ configDir: path.join(dirname, '.storybook') }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
