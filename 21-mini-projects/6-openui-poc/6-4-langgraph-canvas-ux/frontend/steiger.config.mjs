import {defineConfig} from 'steiger';
import fsd from '@feature-sliced/steiger-plugin';
export default defineConfig([
 ...fsd.configs.recommended,
 // This user-facing feature owns thread persistence, streaming and Canvas mutations.
 // The feature and analysis entity have one page consumer today; retain this explicit boundary instead of merging its logic into the page.
 {files:['./src/features/manage-canvas/**','./src/entities/analysis/**'],rules:{'fsd/insignificant-slice':'off'}},
]);
