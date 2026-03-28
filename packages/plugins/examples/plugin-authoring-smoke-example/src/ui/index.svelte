<!--
  DashboardWidget — smoke test plugin demonstrating data + actions.
  Svelte 5 port of the React version.
-->
<script lang="ts">
  import { pluginData, pluginAction } from "@clawdev/plugin-sdk/ui-svelte";
  import type { PluginWidgetProps } from "@clawdev/plugin-sdk/ui-svelte";

  type HealthData = {
    status: "ok" | "degraded" | "error";
    checkedAt: string;
  };

  let { context }: PluginWidgetProps = $props();

  const health = pluginData<HealthData>("health");
  const ping = pluginAction("ping");
</script>

{#if $health.loading}
  <div>Loading plugin health...</div>
{:else if $health.error}
  <div>Plugin error: {$health.error.message}</div>
{:else}
  <div style="display: grid; gap: 0.5rem;">
    <strong>Plugin Authoring Smoke Example</strong>
    <div>Health: {$health.data?.status ?? "unknown"}</div>
    <div>Checked: {$health.data?.checkedAt ?? "never"}</div>
    <button onclick={() => void ping()}>Ping Worker</button>
  </div>
{/if}
