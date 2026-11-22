import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react-swc";
import fs from "node:fs";
import path from "node:path";
import { normalizePath, type Plugin } from "vite";
import copy from "rollup-plugin-copy";
import { defineConfig } from "vitest/config";
import tailwindcss from "@tailwindcss/vite";

/**
 * Modern-mode instrument samples ship as npm packages. Some file names contain
 * "#" (e.g. "D#3v8.mp3"), which can't be imported as URLs, so this copies them
 * into public/samples/<instrument>/ with URL-safe names ("#" → "s", velocity
 * suffix dropped) whenever the dev server or a build starts. The folder is
 * generated — it is git-ignored and recreated from node_modules.
 */
const SAMPLE_PACKAGES: Array<{ instrument: string; folder: string }> = [
	{
		instrument: "piano",
		folder: "node_modules/@audio-samples/piano-mp3-velocity8/audio",
	},
	{ instrument: "violin", folder: "node_modules/tonejs-instrument-violin-mp3" },
	{ instrument: "cello", folder: "node_modules/tonejs-instrument-cello-mp3" },
	{ instrument: "harp", folder: "node_modules/tonejs-instrument-harp-mp3" },
];

const toSafeSampleName = (fileName: string): string =>
	fileName.replaceAll("#", "s").replace(/v\d+(?=\.mp3$)/, "");

const modernSampleLibrary = (): Plugin => ({
	name: "modern-sample-library",
	// Runs before the dev server indexes public/, so the files are served at once
	configResolved(): void {
		if (process.env["VITEST"]) {
			return;
		}
		for (const { instrument, folder } of SAMPLE_PACKAGES) {
			const sourceFolder = path.resolve(folder);
			if (!fs.existsSync(sourceFolder)) {
				console.warn(
					`[modern-sample-library] Missing ${folder} — run "pnpm install" to get the modern-mode samples.`
				);
				continue;
			}
			const targetFolder = path.resolve("public/samples", instrument);
			fs.mkdirSync(targetFolder, { recursive: true });
			for (const fileName of fs.readdirSync(sourceFolder)) {
				// Skip alternate takes such as "F2 v2.mp3"
				if (!fileName.endsWith(".mp3") || fileName.includes(" ")) {
					continue;
				}
				const sourceFile = path.join(sourceFolder, fileName);
				const targetFile = path.join(targetFolder, toSafeSampleName(fileName));
				const sourceSize = fs.statSync(sourceFile).size;
				if (
					!fs.existsSync(targetFile) ||
					fs.statSync(targetFile).size !== sourceSize
				) {
					fs.copyFileSync(sourceFile, targetFile);
				}
			}
		}
	},
});

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		tanstackRouter(),
		modernSampleLibrary(),
		copy({
			targets: [
				{
					src: normalizePath(path.resolve("./src/assets/locales")),
					dest: normalizePath(path.resolve("./public")),
				},
			],
		}),
	],
	server: {
		host: true,
		strictPort: true,
	},
	test: {
		environment: "jsdom",
		setupFiles: ["./vitest.setup.ts"],
		css: true,
	},
});
