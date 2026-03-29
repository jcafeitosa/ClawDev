<script lang="ts">
  import { Settings, Save, AlertCircle } from "lucide-svelte";
  import { api } from "$lib/api/client";
  import { toastStore } from "$stores/toast.svelte.js";
  import { onMount } from "svelte";

  let instanceName = $state("");
  let publicUrl = $state("");
  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const res = await api.api["instance-settings"].get();
      const data = res.data as any;
      if (data) {
        instanceName = data.instanceName ?? "";
        publicUrl = data.publicUrl ?? "";
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load settings";
    } finally {
      loading = false;
    }
  });

  async function handleSave() {
    saving = true;
    error = null;

    try {
      await api.api["instance-settings"].put({
        instanceName: instanceName.trim(),
        publicUrl: publicUrl.trim(),
      });
      toastStore.push({ title: "Settings saved", tone: "success" });
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to save settings";
    } finally {
      saving = false;
    }
  }
</script>

<div class="p-6 max-w-2xl">
  <div class="flex items-center gap-3 mb-6">
    <Settings class="size-5 text-muted-foreground" />
    <h1 class="text-xl font-semibold text-foreground">General Settings</h1>
  </div>

  <nav class="flex gap-1 mb-6">
    <a
      href="/settings/general"
      class="inline-flex h-8 items-center justify-center rounded-md bg-primary/10 px-3 text-xs font-medium text-primary"
    >
      General
    </a>
    <a
      href="/settings/experimental"
      class="inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
    >
      Experimental
    </a>
  </nav>

  {#if loading}
    <div class="space-y-4">
      {#each Array(2) as _}
        <div class="space-y-1.5">
          <div class="h-4 w-24 rounded bg-muted animate-pulse"></div>
          <div class="h-9 w-full rounded-md bg-muted animate-pulse"></div>
        </div>
      {/each}
    </div>
  {:else}
    <form class="space-y-5" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
      <div class="space-y-1.5">
        <label for="instance-name" class="text-sm font-medium text-foreground">Instance Name</label>
        <input
          id="instance-name"
          type="text"
          bind:value={instanceName}
          placeholder="My ClawDev Instance"
          class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <p class="text-xs text-muted-foreground">A display name for this instance.</p>
      </div>

      <div class="space-y-1.5">
        <label for="public-url" class="text-sm font-medium text-foreground">Public URL</label>
        <input
          id="public-url"
          type="url"
          bind:value={publicUrl}
          placeholder="https://my-instance.example.com"
          class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <p class="text-xs text-muted-foreground">The publicly accessible URL for this instance. Used for webhooks and CLI auth.</p>
      </div>

      {#if error}
        <div class="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <AlertCircle class="size-4 text-destructive shrink-0 mt-0.5" />
          <p class="text-sm text-destructive">{error}</p>
        </div>
      {/if}

      <button
        type="submit"
        disabled={saving}
        class="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        <Save class="size-4" />
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </form>
  {/if}
</div>
