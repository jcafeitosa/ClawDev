<!--
  Issue detail tab — shows plugin entities related to this issue.
-->
<script lang="ts">
  import { pluginData, pluginAction } from "@clawdev/plugin-sdk/ui-svelte";
  import type { PluginDetailTabProps } from "@clawdev/plugin-sdk/ui-svelte";
  import type { EntityRecord } from "./types.js";

  let { context }: PluginDetailTabProps = $props();

  const entities = pluginData<{ entities: EntityRecord[] }>("issue-entities", {
    issueId: context.entityId,
    companyId: context.companyId,
  });
  const createEntity = pluginAction("create-test-entity");

  let creating = $state(false);

  async function handleCreate() {
    creating = true;
    try {
      await createEntity({
        entityType: "test",
        title: `Test entity from issue ${context.entityId}`,
        scopeKind: "issue",
        scopeId: context.entityId,
        companyId: context.companyId,
      });
    } finally {
      creating = false;
    }
  }
</script>

<div style="display: grid; gap: 12px;">
  <div style="display: flex; justify-content: space-between; align-items: center;">
    <strong style="font-size: 14px;">Kitchen Sink — Issue Tab</strong>
    <button
      onclick={handleCreate}
      disabled={creating}
      style="padding: 4px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 12px; background: var(--background); cursor: pointer;"
    >
      {creating ? "Creating…" : "Create Test Entity"}
    </button>
  </div>

  {#if $entities.loading}
    <p style="color: var(--muted-foreground); font-size: 13px;">Loading entities…</p>
  {:else if $entities.error}
    <p style="color: var(--destructive); font-size: 13px;">Error: {$entities.error.message}</p>
  {:else if $entities.data?.entities?.length}
    <ul style="list-style: none; padding: 0; margin: 0; display: grid; gap: 6px;">
      {#each $entities.data.entities as entity (entity.id)}
        <li style="border: 1px solid var(--border); border-radius: 8px; padding: 10px; font-size: 13px;">
          <div style="font-weight: 500;">{entity.title ?? entity.id}</div>
          <div style="font-size: 11px; color: var(--muted-foreground);">
            {entity.entityType} · {entity.status ?? "—"} · {entity.scopeKind}
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <p style="color: var(--muted-foreground); font-size: 13px;">No entities linked to this issue.</p>
  {/if}
</div>
