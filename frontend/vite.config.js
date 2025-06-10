import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		VitePWA({
			registerType: "autoUpdate",
			devOptions: {
				enabled: true,
			},
			injectRegister: "auto",
			workbox: {
				globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
				maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
			},
			manifest: {
				name: "101 Workspace",
				short_name: "101",
				description: "A Workspace dashboard and inventory management PWA.",
				start_url: ".",
				display: "standalone",
				background_color: "#f3f4f6",
				theme_color: "#e7000b",
				orientation: "any",
				icons: [
					{
						src: "static/images/101-logo-192x192.png",
						sizes: "192x192",
						type: "image/png",
					},
					{
						src: "static/images/101-logo-512x512.png",
						sizes: "512x512",
						type: "image/png",
					},
					{
						src: "static/images/101-logo.png",
						sizes: "1024x1024",
						type: "image/png",
					},
				],
			},
		}),
	],
	build: {
		rollupOptions: {
			input: {
				app: "./index.html",
				"service-worker": "./src/service-worker.js",
			},
		},
	},
});
