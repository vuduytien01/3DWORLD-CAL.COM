#!/usr/bin/env node
// Wrapper script for the enum generator that ensures correct path resolution
// regardless of the current working directory (e.g., running prisma from repo root).
// Prisma resolves providers starting with "./" relative to the schema file directory.
// ts-node reads the nearest tsconfig from cwd (root tsconfig sets module NodeNext,
// which TS5109-rejects with default CommonJS transpile), so pin compilerOptions here.
require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "commonjs", moduleResolution: "node" },
});
require("./enum-generator.ts");
