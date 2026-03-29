<script lang="ts">
  import { page } from "$app/stores";
  import { api } from "$lib/api/client";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { toastStore } from "$stores/toast.svelte.js";
  import { Save, AlertCircle } from "lucide-svelte";
  import { onMount } from "svelte";

  let pluginId = $derived($page.params.pluginId);
  let companyPrefix = $derived($page.params.companyPrefix);
  let plugin = $state<any>(null);
  let config = $state<Record<string, any>>({});
  let schema = $state<any[]>([]);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    if (!pluginId) return;
    loading = true;
    error = null;

    api.api.plugins({ id: pluginId }).get()
      .then((res) => {
        plugin = res.data as any;
        config = { ...(plugin?.config ?? {}) };
        schema = plugin?.configSchema ?? [];
      })
      .catch((err) => {
        error = err instanceof Error ? err.message : "Failed to load plugin";
      })
      .finally(() => {
        loading = false;
      });
  });

  $effect(() => {
    breadcrumbStore.set([
      { label: "Plugins", href: `/${companyPrefix}/plugins` },
      { label: plugin?.name ?? "Plugin", href: `/${companyPrefix}/plugins/${pluginId}` },
      { label: "Settings" },
    ]);
  });

  function setConfigValue(key: string, value: any) {
    config = { ...config, [key]: value };
  }

  async function handleSave() {
    saving = true;
    error = null;

    try {
      await api.api.plugins({ id: pluginId }).config.put(config);
      toastStore.push({ title: "Plugin settings saved", tone: "success" });
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to save settings";
    } finally {
      saving = false;
    }
  }
</script>

{#if loading}
  <div class="p-6 space-y-4 max-w-2xl">
    <div class="h-8 w-48 rounded bg-muted animate-pulse"></div>
    {#each Array(3) as _}
      <div class="space-y-1.5">
        <div class="h-4 w-24 rounded bg-muted animate-pulse"></div>
        <div class="h-9 w-full rounded-md bg-muted animate-pulse"></div>
      </div>
    {/each}
  </div>
{:else if error && !plugin}
  <div class="p-6">
    <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
      <p class="text-sm text-destructive">{error}</p>
    </div>
  </div>
{:else if plugin}
  <div class="p-6 max-w-2xl space-y-6">
    <div>
      <h1 class="text-xl font-semibold text-foreground">{plugin.name} Settings</h1>
      <p class="text-sm text-muted-foreground mt-1">Configure plugin-specific options.</p>
    </div>

    <form class="space-y-5" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
      {#if schema.length > 0}
        {#each schema as field}
          <div class="space-y-1.5">
            <label for="cfg-{field.key}" class="text-sm font-medium text-foreground">
              {field.label ?? field.key}
              {#if field.required}
                <span class="text-destructive">*</span>
              {/if}
            </label>

            {#if field.type === "boolean"}
              <button
                id="cfg-{field.key}"
                type="button"
                role="switch"
                aria-checked={!!config[field.key]}
                onclick={() => setConfigValue(field.key, !config[field.key])}
                class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors
                  {config[field.key] ? 'bg-primary' : 'bg-muted'}"
              >
                <span
                  class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform
                    {config[field.key] ? 'translate-x-5' : 'translate-x-0'}"
                ></span>
              </button>
            {:else if field.type === "select" && field.options}
              <select
                id="cfg-{field.key}"
                value={config[field.key] ?? ""}
                onchange={(e) => setConfigValue(field.key, (e.target as HTMLSelectElement).value)}
                class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select...</option>
                {#each field.options as opt}
                  <option value={opt.value ?? opt}>{opt.label ?? opt}</option>
                {/each}
              </select>
            {:else if field.type === "textarea"}
              <textarea
                id="cfg-{field.key}"
                value={config[field.key] ?? ""}
                oninput={(e) => setConfigValue(field.key, (e.target as HTMLTextAreaElement).value)}
                rows="4"
                placeholder={field.placeholder ?? ""}
                class="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
              ></textarea>
            {:else if field.type === "number"}
              <input
                id="cfg-{field.key}"
                type="number"
                value={config[field.key] ?? ""}
                oninput={(e) => setConfigValue(field.key, Number((e.target as HTMLInputElement).value))}
                min={field.min}
                max={field.max}
                placeholder={field.placeholder ?? ""}
                class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            {:else}
              <input
                id="cfg-{field.key}"
                type={field.type === "secret" ? "password" : "text"}
                value={config[field.key] ?? ""}
                oninput={(e) => setConfigValue(field.key, (e.target as HTMLInputElement).value)}
                placeholder={field.placeholder ?? ""}
                class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            {/if}

            {#if field.description}
              <p class="text-xs text-muted-foreground">{field.description}</p>
            {/if}
          </div>
        {/each}
      {:else}
        <!-- Freeform JSON config editor for plugins without schema -->
        <div class="space-y-1.5">
          <label for="raw-config" class="text-sm font-medium text-foreground">Configuration (JSON)</label>
          <textarea
            id="raw-config"
            value={JSON.stringify(config, null, 2)}
            oninput={(e) => {
              try {
                config = JSON.parse((e.target as HTMLTextAreaElement).value);
              } catch {
                // Invalid JSON, skip
              }
            }}
            rows="10"
            class="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y font-mono"
          ></textarea>
          <p class="text-xs text-muted-foreground">This plugin does not provide a config schema. Edit the JSON directly.</p>
        </div>
      {/if}

      {#if error}
        <div class="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <AlertCircle class="size-4 text-destructive shrink-0 mt-0.5" />
          <p class="text-sm text-destructive">{error}</p>
        </div>
      {/if}

      <div class="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          class="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Save class="size-4" />
          {saving ? "Saving..." : "Save Settings"}
        </button>
        <a
          href="/{companyPrefix}/plugins/{pluginId}"
          class="inline-flex h-9 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground shadow-sm hover:bg-muted transition-colors"
        >
          Cancel
        </a>
      </div>
    </form>
  </div>
{/if}
