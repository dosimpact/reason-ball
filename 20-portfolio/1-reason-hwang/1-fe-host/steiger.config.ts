import { defineConfig } from 'steiger';
import fsd from '@feature-sliced/steiger-plugin';

export default defineConfig([
  ...fsd.configs.recommended,
  // Official Next.js/FSD layer aliases. All dependency/public-API rules still apply.
  // https://fsd.how/docs/guides/tech/with-nextjs/
  { files: ['./src/_app/**', './src/_pages/**'], rules: { 'fsd/typo-in-layer-name': 'off' } },
]);
