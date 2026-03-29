<script lang="ts">
  import { page } from "$app/stores";
  import { api } from "$lib/api/client";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { companyStore } from "$stores/company.svelte.js";
  import { toastStore } from "$stores/toast.svelte.js";
  import { Upload, FileArchive, AlertCircle, Check } from "lucide-svelte";
  import { onMount } from "svelte";

  let companyPrefix = $derived($page.params.companyPrefix);
  let file = $state<File | null>(null);
  let preview = $state<any>(null);
  let importing = $state(false);
  let parsing = $state(false);
  let error = $state<string | null>(null);
  let success = $state(false);
  let dragOver = $state(false);

  let fileInputRef: HTMLInputElement;

  onMount(() => {
    breadcrumbStore.set([{ label: "Import" }]);
  });

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    dragOver = true;
  }

  function handleDragLeave() {
    dragOver = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const dropped = e.dataTransfer?.files?.[0];
    if (dropped) {
      selectFile(dropped);
    }
  }

  function handleFileInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const selected = input.files?.[0];
    if (selected) {
      selectFile(selected);
    }
  }

  async function selectFile(f: File) {
    file = f;
    preview = null;
    error = null;
    parsing = true;

    try {
      if (f.name.endsWith(".json")) {
        const text = await f.text();
        const data = JSON.parse(text);
        preview = buildPreview(data);
      } else if (f.name.endsWith(".zip")) {
        // For ZIP files, show basic info
        preview = {
          type: "zip",
          filename: f.name,
          size: formatBytes(f.size),
          sections: ["Contents will be analyzed on import"],
        };
      } else {
        error = "Unsupported file format. Please upload a .json or .zip file.";
        file = null;
      }
    } catch {
      error = "Failed to parse file. Ensure it is a valid export file.";
      file = null;
    } finally {
      parsing = false;
    }
  }

  function buildPreview(data: any): any {
    const sections: string[] = [];
    if (data.agents?.length) sections.push(`${data.agents.length} agents`);
    if (data.issues?.length) sections.push(`${data.issues.length} issues`);
    if (data.goals?.length) sections.push(`${data.goals.length} goals`);
    if (data.projects?.length) sections.push(`${data.projects.length} projects`);
    if (data.skills?.length) sections.push(`${data.skills.length} skills`);
    if (data.routines?.length) sections.push(`${data.routines.length} routines`);
    if (data.documents?.length) sections.push(`${data.documents.length} documents`);
    if (data.settings) sections.push("Company settings");

    return {
      type: "json",
      filename: file?.name,
      size: formatBytes(file?.size ?? 0),
      sections,
      companyName: data.companyName ?? data.company?.name,
      exportedAt: data.exportedAt,
    };
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  function clearFile() {
    file = null;
    preview = null;
    error = null;
    success = false;
    if (fileInputRef) fileInputRef.value = "";
  }

  async function handleImport() {
    if (!file) return;
    importing = true;
    error = null;

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("companyId", companyStore.selectedCompanyId ?? "");

      const res = await fetch(`/api/companies/${companyStore.selectedCompanyId}/import`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `Import failed (${res.status})`);
      }

      success = true;
      toastStore.push({ title: "Import complete", tone: "success" });
    } catch (err) {
      error = err instanceof Error ? err.message : "Import failed";
    } finally {
      importing = false;
    }
  }
</script>

<div class="p-6 max-w-2xl space-y-6">
  <div class="flex items-center gap-3">
    <Upload class="size-5 text-muted-foreground" />
    <div>
      <h1 class="text-xl font-semibold text-foreground">Import Company Data</h1>
      <p class="text-sm text-muted-foreground mt-0.5">
        Upload an export file to import data into this company.
      </p>
    </div>
  </div>

  {#if success}
    <div class="rounded-lg border border-green-500/50 bg-green-500/10 p-6 text-center space-y-3">
      <Check class="size-10 text-green-500 mx-auto" />
      <p class="text-sm font-medium text-green-500">Import completed successfully!</p>
      <a
        href="/{companyPrefix}"
        class="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
      >
        Go to Dashboard
      </a>
    </div>
  {:else}
    <!-- Drop zone -->
    <div
      role="button"
      tabindex="0"
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      ondrop={handleDrop}
      onclick={() => fileInputRef?.click()}
      onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef?.click(); }}
      class="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors cursor-pointer
        {dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'}"
    >
      <FileArchive class="size-10 text-muted-foreground" />
      <div class="text-center">
        <p class="text-sm font-medium text-foreground">
          {file ? file.name : "Drop your export file here"}
        </p>
        <p class="text-xs text-muted-foreground mt-0.5">
          {file ? formatBytes(file.size) : "Supports .json and .zip files"}
        </p>
      </div>
      {#if file}
        <button
          onclick|stopPropagation={clearFile}
          class="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Choose a different file
        </button>
      {/if}
    </div>

    <input
      bind:this={fileInputRef}
      type="file"
      accept=".json,.zip"
      onchange={handleFileInput}
      class="hidden"
    />

    <!-- Preview -->
    {#if parsing}
      <div class="rounded-lg border border-border bg-card p-4 animate-pulse">
        <div class="h-4 w-32 rounded bg-muted mb-2"></div>
        <div class="h-3 w-64 rounded bg-muted"></div>
      </div>
    {:else if preview}
      <div class="rounded-lg border border-border bg-card p-4 space-y-3">
        <h3 class="text-sm font-medium text-foreground">Import Preview</h3>

        {#if preview.companyName}
          <div class="text-xs text-muted-foreground">
            Source: <span class="text-foreground">{preview.companyName}</span>
          </div>
        {/if}

        {#if preview.exportedAt}
          <div class="text-xs text-muted-foreground">
            Exported: <span class="text-foreground">{new Date(preview.exportedAt).toLocaleString()}</span>
          </div>
        {/if}

        {#if preview.sections?.length}
          <div class="space-y-1">
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contents</p>
            <ul class="space-y-0.5">
              {#each preview.sections as section}
                <li class="text-sm text-foreground flex items-center gap-2">
                  <span class="size-1.5 rounded-full bg-primary/50"></span>
                  {section}
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    {/if}

    {#if error}
      <div class="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
        <AlertCircle class="size-4 text-destructive shrink-0 mt-0.5" />
        <p class="text-sm text-destructive">{error}</p>
      </div>
    {/if}

    {#if file && preview && !parsing}
      <div class="flex items-center gap-3">
        <button
          onclick={handleImport}
          disabled={importing}
          class="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Upload class="size-4" />
          {importing ? "Importing..." : "Apply Import"}
        </button>
        <button
          onclick={clearFile}
          class="inline-flex h-9 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground shadow-sm hover:bg-muted transition-colors"
        >
          Cancel
        </button>
      </div>
    {/if}
  {/if}
</div>
