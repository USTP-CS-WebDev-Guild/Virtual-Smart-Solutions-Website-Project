import { availableParallelism } from "node:os";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Several suites start real PostgreSQL instances. More workers can make
    // Windows laptops slower and exhaust a cold-start deadline. Keep all tests
    // and per-file isolation; limit how many files run at the same time.
    maxWorkers: Math.min(2, availableParallelism()),
    isolate: true,
  },
});
