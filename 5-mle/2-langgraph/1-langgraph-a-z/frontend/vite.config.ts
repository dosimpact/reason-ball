import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  envDir: "..",
  server: {
    port: 2940,
    strictPort: true,
    allowedHosts: ["dodonet.iptime.org"],
    proxy: {
      "/api/copilotkit": {
        target: "http://127.0.0.1:2942",
        changeOrigin: true,
      },
    },
  },
});
