// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import netlify from "@astrojs/netlify";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "static",
  adapter: netlify({
    imageCDN: false,
  }),
  image: {
    quality: 75,
  },
  vite: {
    plugins: [tailwindcss()],
  },
  fonts: [
    {
      provider: fontProviders.google(),
      name: "Lora",
      cssVariable: "--astro-font-lora",
      weights: [400, 500, 600, 700],
      styles: ["normal", "italic"],
      subsets: ["latin"],
    },
  ],
});
