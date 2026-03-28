<!--
  Kitchen Sink dashboard widget — shows plugin overview data.
-->
<script lang="ts">
  import { pluginData, pluginAction, hostContext } from "@clawdev/plugin-sdk/ui-svelte";
  import type { PluginWidgetProps } from "@clawdev/plugin-sdk/ui-svelte";
  import type { OverviewData } from "./types.js";

  let { context }: PluginWidgetProps = $props();

  const ctx = hostContext();
  const overview = pluginData<OverviewData>("overview", { companyId: context.companyId });
  const ping = pluginAction("ping");

  let pingResult = $state<string | null>(null);

  async function handlePing() {
    try {
      const result = await ping({ companyId: context.companyId });
      pingResult = JSON.stringify(result);
    } catch (err) {
      pingResult = `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
</script>

<div style="display: grid; gap: 12px;">
  <div style="border: 1px solid var(--border); border-radius: 12px; padding: 14px; background: var(--card, transparent);">
    <strong style="font-size: 14px;">Kitchen Sink Plugin</strong>

    {#if $overview.loading}
      <p style="color: var(--muted-foreground); font-size: 13px;">Loading overview…</p>
    {:else if $overview.error}
      <p style="color: var(--destructive); font-size: 13px;">Error: {$overview.error.message}</p>
    {:else if $overview.data}
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px;">
        <div style="text-align: center;">
          <div style="font-size: 20px; font-weight: 600;">{$overview.data.counts.companies}</div>
          <div style="font-size: 11px; color: var(--muted-foreground);">Companies</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 20px; font-weight: 600;">{$overview.data.counts.issues}</div>
          <div style="font-size: 11px; color: var(--muted-foreground);">Issues</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 20px; font-weight: 600;">{$overview.data.counts.agents}</div>
          <div style="font-size: 11px; color: var(--muted-foreground);">Agents</div>
        </div>
      </div>

      <div style="margin-top: 12px; display: flex; gap: 8px; align-items: center;">
        <button
          onclick={handlePing}
          style="padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 12px; background: var(--background); cursor: pointer;"
        >
          Ping Worker
        </button>
        {#if pingResult}
          <span style="font-size: 11px; color: var(--muted-foreground);">{pingResult}</span>
        {/if}
      </div>

      <div style="margin-top: 8px; font-size: 11px; color: var(--muted-foreground);">
        v{$overview.data.version} · {$overview.data.capabilities.length} capabilities
      </div>
    {/if}
  </div>
</div>
