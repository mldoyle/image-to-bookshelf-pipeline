import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@scanner-core": path.resolve(__dirname, "../packages/scanner-core/src")
        }
    },
    server: {
        fs: {
            allow: [".."]
        }
    }
});
