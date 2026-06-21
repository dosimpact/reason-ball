import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 2929,
    strictPort: false,
    allowedHosts: ["dodonet.iptime.org"],
    proxy: {
      "/api/copilotkit": {
        target: "http://localhost:2932",
        changeOrigin: true,
      },
    },
  },
});
