<!--
  Plugin settings page — allows configuring which UI slots are shown.
-->
<script lang="ts">
  import { pluginData, pluginAction, pluginToast } from "@clawdev/plugin-sdk/ui-svelte";
  import type { PluginSettingsPageProps } from "@clawdev/plugin-sdk/ui-svelte";
  import type { PluginConfigData } from "./types.js";

  let { context }: PluginSettingsPageProps = $props();

  const configStore = pluginData<PluginConfigData>("plugin-config", {});
  const saveConfig = pluginAction("save-config");
  const toast = pluginToast();

  let localConfig = $state<PluginConfigData>({});
  let saving = $state(false);

  // Sync from bridge
  $effect(() => {
    if ($configStore.data) {
      localConfig = { ...$configStore.data };
    }
  });

  async function handleSave() {
    saving = true;
    try {
      await saveConfig(localConfig);
      toast({ title: "Settings saved", tone: "success" });
    } catch (err) {
      toast({ title: "Failed to save", body: err instanceof Error ? err.message : String(err), tone: "error" });
    } finally {
      saving = false;
    }
  }

  type ConfigKey = keyof PluginConfigData;
  const toggles: Array<{ key: ConfigKey; label: string }> = [
    { key: "showSidebarEntry", label: "Show sidebar entry" },
    { key: "showSidebarPanel", label: "Show sidebar panel" },
    { key: "showProjectSidebarItem", label: "Show project sidebar item" },
    { key: "showCommentAnnotation", label: "Show comment annotations" },
    { key: "showCommentContextMenuItem", label: "Show comment context menu" },
    { key: "enableWorkspaceDemos", label: "Enable workspace demos" },
    { key: "enableProcessDemos", label: "Enable process demos" },
  ];
</script>

<div style="display: grid; gap: 16px; max-width: 480px;">
  <strong style="font-size: 16px;">Kitchen Sink Settings</strong>

  {#if $configStore.loading}
    <p style="color: var(--muted-foreground);">Loading…</p>
  {:else}
    {#each toggles as toggle (toggle.key)}
      <label style="display: flex; align-items: center; gap: 10px; font-size: 13px; cursor: pointer;">
        <input
          type="checkbox"
          checked={localConfig[toggle.key] !== false}
          onchange={(e) => { localConfig = { ...localConfig, [toggle.key]: (e.target as HTMLInputElement).checked }; }}
        />
        {toggle.label}
      </label>
    {/each}

    <button
      onclick={handleSave}
      disabled={saving}
      style="margin-top: 8px; padding: 8px 16px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; background: var(--primary); color: var(--primary-foreground); cursor: pointer;"
    >
      {saving ? "Saving…" : "Save Settings"}
    </button>
  {/if}
</div>
