import { defineConfig } from "vitest/config";

// Default environment is Node. Tests that need a DOM opt in per-file with the
// `// @vitest-environment jsdom` pragma. UI Kit components reconcile to a Forge
// element tree (not the DOM), so frontend tests use react-test-renderer instead
// of a DOM testing library — see DECISIONS.md.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    globals: false,
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/frontend/index.tsx", "src/index.ts"],
    },
  },
});
