import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  cacheDir: "../node_modules/.cache/frontend/vite",
  plugins: [
    tailwindcss(),
    react(),
    {
      name: "rota-offline-shell",
      closeBundle() {
        const root = resolve(import.meta.dirname, "dist");
        const assets = readdirSync(resolve(root, "assets")).map((name) => `/assets/${name}`);
        const precache = [
          "/index.html",
          "/favicon.svg",
          "/manifest.webmanifest",
          "/pwa-192.png",
          "/pwa-512.png",
          ...assets,
        ];
        const digest = createHash("sha256");
        for (const asset of precache)
          digest.update(asset).update(readFileSync(resolve(root, asset.slice(1))));
        const version = digest.digest("hex").slice(0, 16);
        writeFileSync(
          resolve(root, "sw.js"),
          `
const CACHE = "rota-shell-" + ${JSON.stringify(version)};
const STATIC = ${JSON.stringify(precache)};
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC))));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("rota-shell-")&&key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener("fetch",event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=="GET" || url.origin!==self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth"))return;
 if(request.mode==="navigate")event.respondWith(fetch(request).catch(()=>caches.open(CACHE).then(cache=>cache.match("/index.html"))));
 else if(STATIC.includes(url.pathname))event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.pathname))||fetch(request)));
});`,
        );
      },
    },
  ],
});
