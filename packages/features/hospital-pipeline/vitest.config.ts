import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // .test.tsx included: the HTML5 renderer component test lives under
    // lib/html5-world/__tests__/ (jsdom via per-file pragma)
    include: ["lib/**/__tests__/**/*.test.{ts,tsx}"],
    globals: true,
    environment: "node",
    env: {
      FREELLM_STUB: "true",
    },
    alias: {
      "@": path.resolve(__dirname, "."),
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json-summary", "lcov"],
      include: ["lib/**/*.{ts,tsx}", "server.ts"],
      exclude: [
        "lib/**/__tests__/**",
        "lib/**/*.test.{ts,tsx}",
        "lib/**/index.ts", // barrel re-exports only (test-coverage: N/A)
      ],
      // 80% line hard gate (test-coverage skill). Uncomment after the first
      // `bun run test:coverage` run confirms the current level, then keep the
      // gate on for every subsequent change.
      // thresholds: { lines: 80, functions: 80, branches: 60, statements: 80 },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
