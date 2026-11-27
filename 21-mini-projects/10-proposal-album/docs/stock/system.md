# Proposal album system design

The React and Vite app is a standalone package in `21-mini-projects/10-proposal-album` within the Reason Ball Git repository. Reason Ball's pnpm workspace excludes this directory. Run `pnpm install --ignore-workspace` to install using the project's local `pnpm-lock.yaml`.

`src/App.jsx` selects and loads the 17 demos in `src/demos`. Sample captions come from `src/data.js` and sample photos from `public/images`. The Vite `@bits` alias resolves to the eight React Bits components included under `src/react-bits` with their license.

`pnpm dev` serves the app on port 4000. `pnpm build` writes the static site to `dist/`. `pnpm test` runs the chapter playback and confession progression tests.
