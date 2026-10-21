import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  cacheDir: "../node_modules/.cache/frontend/vite",
  plugins: [tailwindcss(), react()],
});
