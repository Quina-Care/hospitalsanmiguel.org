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
      name: "Arimo",
      cssVariable: "--astro-font-arimo",
      weights: [400, 500, 600, 700],
      styles: ["normal"],
      subsets: ["latin"],
    },
  ],
});
