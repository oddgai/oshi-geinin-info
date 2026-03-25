import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    projects: [
      {
        // API route tests: node environment
        test: {
          name: "node",
          globals: true,
          include: ["src/__tests__/**/*.test.ts"],
          environment: "node",
        },
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "./src"),
          },
        },
      },
      {
        // Component tests: jsdom environment
        plugins: [react()],
        test: {
          name: "components",
          globals: true,
          include: ["__tests__/components/**/*.test.tsx"],
          environment: "jsdom",
        },
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "./src"),
          },
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
