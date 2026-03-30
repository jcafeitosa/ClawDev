import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  integrations: [
    starlight({
      title: "ClawDev",
      description: "Open-source orchestration for AI agent companies.",
      social: {
        github: "https://github.com/jcafeitosa/ClawDev",
      },
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Introduction", slug: "getting-started/introduction" },
            { label: "Quick Start", slug: "getting-started/quickstart" },
            { label: "Configuration", slug: "getting-started/configuration" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Companies", slug: "guides/companies" },
            { label: "Agents", slug: "guides/agents" },
            { label: "Issues & Projects", slug: "guides/issues" },
            { label: "Plugins", slug: "guides/plugins" },
          ],
        },
        {
          label: "API Reference",
          autogenerate: { directory: "api" },
        },
        {
          label: "Self-Hosting",
          items: [
            { label: "Docker", slug: "self-hosting/docker" },
            { label: "Environment Variables", slug: "self-hosting/env-vars" },
          ],
        },
      ],
    }),
  ],
});
