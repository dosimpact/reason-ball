import {defineConfig} from 'steiger';
import fsd from '@feature-sliced/steiger-plugin';
export default defineConfig([
 ...fsd.configs.recommended,
 // Domain state and dashboard interaction remain explicit boundaries as the workspace grows.
 {files:['./src/features/dashboard/**','./src/entities/dashboard/**'],rules:{'fsd/insignificant-slice':'off'}},
]);
