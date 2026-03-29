<script lang="ts">
  import { page } from "$app/stores";
  import { api } from "$lib/api/client";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { companyStore } from "$stores/company.svelte.js";
  import { toastStore } from "$stores/toast.svelte.js";
  import { Download, Package, AlertCircle } from "lucide-svelte";
  import { onMount } from "svelte";

  let companyPrefix = $derived($page.params.companyPrefix);
  let exporting = $state(false);
  let error = $state<string | null>(null);

  interface ExportSection {
    key: string;
    label: string;
    description: string;
    selected: boolean;
  }

  let sections = $state<ExportSection[]>([
    { key: "agents", label: "Agents", description: "Agent configurations, roles, and system prompts.", selected: true },
    { key: "issues", label: "Issues", description: "All issues, comments, and status history.", selected: true },
    { key: "goals", label: "Goals", description: "Goal tree with progress tracking data.", selected: true },
    { key: "projects", label: "Projects", description: "Project metadata and issue associations.", selected: true },
    { key: "skills", label: "Skills", description: "Company skill configurations.", selected: true },
    { key: "routines", label: "Routines", description: "Scheduled routine definitions.", selected: false },
    { key: "documents", label: "Documents", description: "Stored documents and attachments.", selected: false },
    { key: "settings", label: "Company Settings", description: "Company configuration and preferences.", selected: true },
  ]);

  let selectedCount = $derived(sections.filter((s) => s.selected).length);

  onMount(() => {
    breadcrumbStore.set([{ label: "Export" }]);
  });

  function toggleSection(key: string) {
    sections = sections.map((s) =>
      s.key === key ? { ...s, selected: !s.selected } : s,
    );
  }

  function selectAll() {
    sections = sections.map((s) => ({ ...s, selected: true }));
  }

  function deselectAll() {
    sections = sections.map((s) => ({ ...s, selected: false }));
  }

  async function handleExport() {
    const selected = sections.filter((s) => s.selected).map((s) => s.key);
    if (selected.length === 0) {
      error = "Select at least one section to export.";
      return;
    }

    exporting = true;
    error = null;

    try {
      const result = await api.api.companies({ id: companyStore.selectedCompanyId ?? "" }).export.post({
        sections: selected,
      });

      const data = result.data as any;
      if (data?.downloadUrl) {
        // Trigger browser download
        const link = document.createElement("a");
        link.href = data.downloadUrl;
        link.download = data.filename ?? `${companyPrefix}-export.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toastStore.push({ title: "Export started", body: "Download will begin shortly.", tone: "success" });
      } else if (data && typeof data === "object") {
        // Fallback: download as JSON blob
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${companyPrefix}-export.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toastStore.push({ title: "Export complete", tone: "success" });
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Export failed";
    } finally {
      exporting = false;
    }
  }
</script>

<div class="p-6 max-w-2xl space-y-6">
  <div class="flex items-center gap-3">
    <Package class="size-5 text-muted-foreground" />
    <div>
      <h1 class="text-xl font-semibold text-foreground">Export Company</h1>
      <p class="text-sm text-muted-foreground mt-0.5">
        Select what to include in the export package.
      </p>
    </div>
  </div>

  <!-- Selection controls -->
  <div class="flex items-center gap-3">
    <button
      onclick={selectAll}
      class="text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      Select all
    </button>
    <span class="text-xs text-muted-foreground">/</span>
    <button
      onclick={deselectAll}
      class="text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      Deselect all
    </button>
    <span class="ml-auto text-xs text-muted-foreground">{selectedCount} selected</span>
  </div>

  <!-- Export sections -->
  <div class="space-y-2">
    {#each sections as section}
      <label
        class="flex items-start gap-3 p-3 rounded-lg border border-border bg-card cursor-pointer hover:bg-muted/50 transition-colors
          {section.selected ? 'ring-1 ring-primary/30' : ''}"
      >
        <input
          type="checkbox"
          checked={section.selected}
          onchange={() => toggleSection(section.key)}
          class="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-ring"
        />
        <div class="space-y-0.5">
          <p class="text-sm font-medium text-foreground">{section.label}</p>
          <p class="text-xs text-muted-foreground">{section.description}</p>
        </div>
      </label>
    {/each}
  </div>

  {#if error}
    <div class="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
      <AlertCircle class="size-4 text-destructive shrink-0 mt-0.5" />
      <p class="text-sm text-destructive">{error}</p>
    </div>
  {/if}

  <div class="flex items-center gap-3">
    <button
      onclick={handleExport}
      disabled={exporting || selectedCount === 0}
      class="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
    >
      <Download class="size-4" />
      {exporting ? "Exporting..." : "Export ZIP"}
    </button>
    <a
      href="/{companyPrefix}"
      class="inline-flex h-9 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground shadow-sm hover:bg-muted transition-colors"
    >
      Cancel
    </a>
  </div>
</div>
