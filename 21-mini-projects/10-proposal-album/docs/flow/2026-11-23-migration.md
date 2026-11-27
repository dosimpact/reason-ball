# 2026-11-23 proposal album migration

Copied the 17-style demo from the original React Bits checkout at commit `d3162d29` into `21-mini-projects/10-proposal-album`. The copy includes the demo source, sample images, npm lockfile, tests, and the eight React Bits components it imports. The Vite alias now resolves within the app. The package uses Reason Ball's Git root and its own npm installation.

The [product design](../stock/product.md) records the preserved album behavior. The [system design](../stock/system.md) records the package boundary and asset layout.

Verified a clean npm install, three passing tests, a production build, and HTTP responses for the production preview's entry point and a sample image. The root pnpm filter found no matching package. The copied demo files and images match the source checkout.

## Follow-up installation with pnpm

Installed with `pnpm install --ignore-workspace`, which generated a package-local `pnpm-lock.yaml`. The root lockfile stayed unchanged. All three tests and the production build passed. The development server returned the album page, a demo module, and a sample image on port 4000.
