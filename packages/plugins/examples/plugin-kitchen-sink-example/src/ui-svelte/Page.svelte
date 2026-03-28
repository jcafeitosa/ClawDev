<!--
  Main Kitchen Sink page — comprehensive API surface demonstration.
  Modular Svelte 5 port (the React version was a 2400-line monolith).
-->
<script lang="ts">
  import { pluginData, pluginAction, pluginStream, pluginToast, hostContext } from "@clawdev/plugin-sdk/ui-svelte";
  import type { PluginPageProps } from "@clawdev/plugin-sdk/ui-svelte";
  import type { OverviewData, EntityRecord, StateValueData } from "./types.js";
  import { STREAM_CHANNELS, SAFE_COMMANDS, JOB_KEYS, WEBHOOK_KEYS, TOOL_NAMES } from "../constants.js";

  let { context }: PluginPageProps = $props();

  const ctx = hostContext();
  const overview = pluginData<OverviewData>("overview", { companyId: context.companyId });
  const entities = pluginData<{ entities: EntityRecord[] }>("entities", { companyId: context.companyId });
  const logStream = pluginStream("activity-log", { companyId: context.companyId });
  const toast = pluginToast();

  // Actions
  const ping = pluginAction("ping");
  const triggerJob = pluginAction("trigger-job");
  const triggerWebhook = pluginAction("trigger-webhook");
  const createEntity = pluginAction("create-test-entity");
  const runCommand = pluginAction("run-command");

  let activeTab = $state<"overview" | "entities" | "stream" | "actions">("overview");
  let actionLog = $state<string[]>([]);

  function logAction(msg: string) {
    actionLog = [...actionLog, `[${new Date().toLocaleTimeString()}] ${msg}`];
  }

  async function handlePing() {
    try {
      const result = await ping({ companyId: context.companyId });
      logAction(`Ping: ${JSON.stringify(result)}`);
      toast({ title: "Pong!", tone: "success" });
    } catch (err) {
      logAction(`Ping error: ${err}`);
      toast({ title: "Ping failed", tone: "error" });
    }
  }

  async function handleTriggerJob(jobKey: string) {
    try {
      await triggerJob({ jobKey, companyId: context.companyId });
      logAction(`Job triggered: ${jobKey}`);
      toast({ title: `Job ${jobKey} triggered`, tone: "info" });
    } catch (err) {
      logAction(`Job error: ${err}`);
    }
  }

  async function handleCreateEntity() {
    try {
      await createEntity({
        entityType: "test",
        title: `Test entity ${Date.now()}`,
        scopeKind: "company",
        scopeId: context.companyId,
        companyId: context.companyId,
      });
      logAction("Entity created");
      toast({ title: "Entity created", tone: "success" });
    } catch (err) {
      logAction(`Entity creation error: ${err}`);
    }
  }
</script>

<div style="display: grid; gap: 16px;">
  <div style="display: flex; align-items: center; justify-content: space-between;">
    <h1 style="font-size: 20px; font-weight: 600;">🧪 Kitchen Sink</h1>
    <span style="font-size: 11px; color: var(--muted-foreground);">
      Company: {$ctx.companyId ?? "none"}
    </span>
  </div>

  <!-- Tab navigation -->
  <div style="display: flex; gap: 2px; border-bottom: 1px solid var(--border);">
    {#each ["overview", "entities", "stream", "actions"] as tab}
      <button
        onclick={() => activeTab = tab}
        style="padding: 8px 16px; font-size: 13px; border: none; background: none; cursor: pointer; border-bottom: 2px solid {activeTab === tab ? 'var(--primary)' : 'transparent'}; color: {activeTab === tab ? 'var(--foreground)' : 'var(--muted-foreground)'};"
      >
        {tab[0].toUpperCase()}{tab.slice(1)}
      </button>
    {/each}
  </div>

  <!-- Overview tab -->
  {#if activeTab === "overview"}
    {#if $overview.loading}
      <p style="color: var(--muted-foreground);">Loading overview…</p>
    {:else if $overview.data}
      <div style="display: grid; gap: 12px;">
        <div style="border: 1px solid var(--border); border-radius: 12px; padding: 14px;">
          <div style="font-weight: 600; margin-bottom: 8px;">Plugin Info</div>
          <div style="font-size: 13px; display: grid; gap: 4px;">
            <div>ID: <code>{$overview.data.pluginId}</code></div>
            <div>Version: {$overview.data.version}</div>
            <div>Capabilities: {$overview.data.capabilities.join(", ")}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px;">
          {#each Object.entries($overview.data.counts) as [key, value]}
            <div style="border: 1px solid var(--border); border-radius: 8px; padding: 12px; text-align: center;">
              <div style="font-size: 20px; font-weight: 600;">{value}</div>
              <div style="font-size: 11px; color: var(--muted-foreground); text-transform: capitalize;">{key}</div>
            </div>
          {/each}
        </div>

        <div style="border: 1px solid var(--border); border-radius: 12px; padding: 14px;">
          <div style="font-weight: 600; margin-bottom: 8px;">Manifest</div>
          <div style="font-size: 12px; display: grid; gap: 4px;">
            <div>Jobs: {$overview.data.manifest.jobs.map((j) => j.jobKey).join(", ") || "none"}</div>
            <div>Webhooks: {$overview.data.manifest.webhooks.map((w) => w.endpointKey).join(", ") || "none"}</div>
            <div>Tools: {$overview.data.manifest.tools.map((t) => t.name).join(", ") || "none"}</div>
          </div>
        </div>
      </div>
    {/if}

  <!-- Entities tab -->
  {:else if activeTab === "entities"}
    <div style="display: grid; gap: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <strong>Plugin Entities</strong>
        <button
          onclick={handleCreateEntity}
          style="padding: 4px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 12px; background: var(--background); cursor: pointer;"
        >
          Create Test Entity
        </button>
      </div>

      {#if $entities.loading}
        <p style="color: var(--muted-foreground);">Loading…</p>
      {:else if $entities.data?.entities?.length}
        <div style="display: grid; gap: 6px;">
          {#each $entities.data.entities as entity (entity.id)}
            <div style="border: 1px solid var(--border); border-radius: 8px; padding: 10px;">
              <div style="font-weight: 500; font-size: 13px;">{entity.title ?? entity.id}</div>
              <div style="font-size: 11px; color: var(--muted-foreground);">
                {entity.entityType} · {entity.status ?? "—"} · {entity.scopeKind}:{entity.scopeId ?? "—"}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p style="color: var(--muted-foreground); font-size: 13px;">No entities yet.</p>
      {/if}
    </div>

  <!-- Stream tab -->
  {:else if activeTab === "stream"}
    <div style="display: grid; gap: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <strong>Activity Stream</strong>
        <span style="font-size: 11px; color: {$logStream.connected ? 'var(--chart-2)' : 'var(--muted-foreground)'};">
          {$logStream.connected ? "● Connected" : $logStream.connecting ? "Connecting…" : "Disconnected"}
        </span>
      </div>

      <div style="border: 1px solid var(--border); border-radius: 8px; padding: 12px; max-height: 400px; overflow-y: auto; font-family: monospace; font-size: 12px; line-height: 1.6;">
        {#if $logStream.events.length === 0}
          <span style="color: var(--muted-foreground);">Waiting for events…</span>
        {:else}
          {#each $logStream.events as event, i}
            <div>{JSON.stringify(event)}</div>
          {/each}
        {/if}
      </div>
    </div>

  <!-- Actions tab -->
  {:else if activeTab === "actions"}
    <div style="display: grid; gap: 12px;">
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        <button onclick={handlePing} style="padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 12px; background: var(--background); cursor: pointer;">
          Ping
        </button>
        <button onclick={() => handleTriggerJob("example-job")} style="padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 12px; background: var(--background); cursor: pointer;">
          Trigger Job
        </button>
        <button onclick={handleCreateEntity} style="padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 12px; background: var(--background); cursor: pointer;">
          Create Entity
        </button>
      </div>

      <div style="border: 1px solid var(--border); border-radius: 8px; padding: 12px; max-height: 300px; overflow-y: auto; font-family: monospace; font-size: 11px; line-height: 1.6;">
        {#if actionLog.length === 0}
          <span style="color: var(--muted-foreground);">No actions executed yet.</span>
        {:else}
          {#each actionLog as line}
            <div>{line}</div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>
