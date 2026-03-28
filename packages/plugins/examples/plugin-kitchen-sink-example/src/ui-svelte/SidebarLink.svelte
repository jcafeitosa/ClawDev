<!--
  Sidebar navigation link for the Kitchen Sink plugin.
-->
<script lang="ts">
  import { pluginData } from "@clawdev/plugin-sdk/ui-svelte";
  import type { PluginSidebarProps, PluginConfigData } from "./types.js";
  import { PLUGIN_ID, PAGE_ROUTE } from "../constants.js";

  let { context }: PluginSidebarProps = $props();

  const config = pluginData<PluginConfigData>("plugin-config", {});
  let show = $derived($config.data?.showSidebarEntry !== false);
  let prefix = $derived(context.companyPrefix ? `/${context.companyPrefix}` : "");
  let href = $derived(`${prefix}${PAGE_ROUTE}`);
</script>

{#if show}
  <a
    {href}
    class="block px-3 py-1 text-[12px] truncate text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
  >
    🧪 Kitchen Sink
  </a>
{/if}
