import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@calcom/features/hospital-pipeline": path.resolve(__dirname, "../hospital-pipeline/lib"),
    },
  },
  build: {
    lib: {
      entry: "src/index.ts",
      name: "Hospital3DRenderer",
      fileName: "hospital-3d-renderer",
    },
    rollupOptions: {
      external: ["react", "react-dom", "three", "@react-three/fiber", "@react-three/drei", "@calcom/features/hospital-pipeline"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          three: "THREE",
        },
      },
    },
  },
});