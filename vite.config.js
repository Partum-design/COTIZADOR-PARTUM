import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import noraHandler from "./api/nora.js";

function noraLocalApi() {
  return {
    name: "nora-local-api",
    configureServer(server) {
      server.middlewares.use("/api/nora", async (request, nativeResponse) => {
        let rawBody = "";
        for await (const chunk of request) rawBody += chunk;

        try {
          request.body = rawBody ? JSON.parse(rawBody) : {};
        } catch {
          request.body = {};
        }

        const response = {
          setHeader: (...args) => nativeResponse.setHeader(...args),
          status(code) {
            nativeResponse.statusCode = code;
            return response;
          },
          json(payload) {
            nativeResponse.setHeader("Content-Type", "application/json; charset=utf-8");
            nativeResponse.end(JSON.stringify(payload));
          },
        };

        await noraHandler(request, response);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  }

  return {
    plugins: [react(), noraLocalApi()],
    publicDir: "LOGOS",
  };
});
