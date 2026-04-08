import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: process.env.DOCS_SITE ?? "https://docs.clawdev.ing",
  integrations: [
    starlight({
      title: "ClawDev",
      description: "Open-source orchestration for AI agent companies.",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/jcafeitosa/ClawDev",
        },
      ],
      sidebar: [
        {
          label: "Getting Started",
          autogenerate: { directory: "getting-started" },
        },
        {
          label: "Guides",
          autogenerate: { directory: "guides" },
        },
        {
          label: "API Reference",
          autogenerate: { directory: "api" },
        },
        {
          label: "Self-Hosting",
          autogenerate: { directory: "self-hosting" },
        },
      ],
    }),
  ],
});
