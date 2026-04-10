import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API = "http://127.0.0.1:3001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: API,
        changeOrigin: true,
        timeout: 600_000,
        proxyTimeout: 600_000,
        configure(proxy) {
          proxy.on("error", (err, _req, res) => {
            if (res && !res.headersSent && typeof res.writeHead === "function") {
              res.writeHead(502, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  error: "API unreachable",
                  detail: err.message || String(err),
                })
              );
            }
          });
        },
      },
    },
  },
});
