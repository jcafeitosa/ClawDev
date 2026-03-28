<!--
  Project detail tab: workspace selector, file tree, and CodeMirror editor.
  Svelte 5 port — CodeMirror is framework-agnostic, mounts via action.
-->
<script lang="ts">
  import { pluginData, pluginAction } from "@clawdev/plugin-sdk/ui-svelte";
  import type { PluginDetailTabProps } from "@clawdev/plugin-sdk/ui-svelte";
  import { onMount, onDestroy } from "svelte";
  import { EditorView } from "@codemirror/view";
  import { basicSetup } from "codemirror";
  import { javascript } from "@codemirror/lang-javascript";
  import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
  import { tags } from "@lezer/highlight";
  import FileTreeNode from "./FileTreeNode.svelte";

  type Workspace = { id: string; projectId: string; name: string; path: string; isPrimary: boolean };
  type FileEntry = { name: string; path: string; isDirectory: boolean };

  let { context }: PluginDetailTabProps = $props();

  let companyId = $derived(context.companyId);
  let projectId = $derived(context.entityId);

  // Responsive + dark mode
  let isMobile = $state(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  let isDarkMode = $state(typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  let mobileView = $state<"browser" | "editor">("browser");

  // Workspace
  const workspacesStore = pluginData<Workspace[]>("workspaces", { projectId, companyId });
  let workspaces = $derived($workspacesStore.data ?? []);
  let workspaceId = $state<string | null>(null);
  let resolvedWorkspaceId = $derived(workspaceId ?? workspaces[0]?.id ?? null);
  let selectedWorkspace = $derived(workspaces.find((w) => w.id === resolvedWorkspaceId) ?? null);

  // File tree
  let fileListStore = $derived(
    selectedWorkspace
      ? pluginData<{ entries: FileEntry[] }>("fileList", { projectId, companyId, workspaceId: selectedWorkspace.id })
      : null,
  );
  let entries = $derived(fileListStore ? ($fileListStore?.data?.entries ?? []) : []);
  let fileListLoading = $derived(fileListStore ? $fileListStore?.loading ?? false : false);

  // File content + editor state
  let selectedPath = $state<string | null>(null);
  let fileContentStore = $derived(
    selectedPath && selectedWorkspace
      ? pluginData<{ content: string | null; error?: string }>("fileContent", {
          projectId,
          companyId,
          workspaceId: selectedWorkspace.id,
          filePath: selectedPath,
        })
      : null,
  );

  let isDirty = $state(false);
  let isSaving = $state(false);
  let saveMessage = $state<string | null>(null);
  let saveError = $state<string | null>(null);

  const writeFile = pluginAction("writeFile");

  // CodeMirror
  let editorEl: HTMLDivElement | undefined;
  let editorView: EditorView | null = null;
  let loadedContent = "";

  // Dark theme
  const editorBaseTheme = { "&": { height: "100%" }, ".cm-scroller": { overflow: "auto", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "13px", lineHeight: "1.6" }, ".cm-content": { padding: "12px 14px 18px" } };

  const darkHighlight = HighlightStyle.define([
    { tag: tags.keyword, color: "oklch(0.78 0.025 265)" },
    { tag: [tags.name, tags.variableName], color: "oklch(0.88 0.01 255)" },
    { tag: [tags.string, tags.special(tags.string)], color: "oklch(0.80 0.02 170)" },
    { tag: [tags.number, tags.bool, tags.null], color: "oklch(0.79 0.02 95)" },
    { tag: [tags.comment, tags.lineComment, tags.blockComment], color: "oklch(0.64 0.01 255)" },
    { tag: [tags.function(tags.variableName), tags.labelName], color: "oklch(0.84 0.018 220)" },
    { tag: [tags.typeName, tags.className], color: "oklch(0.82 0.02 245)" },
    { tag: [tags.operator, tags.punctuation], color: "oklch(0.77 0.01 255)" },
  ]);

  const lightHighlight = HighlightStyle.define([
    { tag: tags.keyword, color: "oklch(0.45 0.07 270)" },
    { tag: [tags.name, tags.variableName], color: "oklch(0.28 0.01 255)" },
    { tag: [tags.string, tags.special(tags.string)], color: "oklch(0.45 0.06 165)" },
    { tag: [tags.number, tags.bool, tags.null], color: "oklch(0.48 0.08 90)" },
    { tag: [tags.comment, tags.lineComment, tags.blockComment], color: "oklch(0.53 0.01 255)" },
    { tag: [tags.function(tags.variableName), tags.labelName], color: "oklch(0.42 0.07 220)" },
    { tag: [tags.typeName, tags.className], color: "oklch(0.40 0.06 245)" },
    { tag: [tags.operator, tags.punctuation], color: "oklch(0.36 0.01 255)" },
  ]);

  function createEditorTheme(dark: boolean) {
    const colors = dark
      ? { bg: "oklch(0.23 0.02 255)", fg: "oklch(0.93 0.01 255)", gutterBg: "oklch(0.25 0.015 255)", gutterFg: "oklch(0.74 0.015 255)", border: "oklch(0.34 0.01 255)", active: "oklch(0.30 0.012 255 / 0.55)", sel: "oklch(0.42 0.02 255 / 0.45)" }
      : { bg: "color-mix(in oklab, var(--card) 92%, var(--background))", fg: "var(--foreground)", gutterBg: "color-mix(in oklab, var(--card) 96%, var(--background))", gutterFg: "var(--muted-foreground)", border: "var(--border)", active: "color-mix(in oklab, var(--accent) 52%, transparent)", sel: "color-mix(in oklab, var(--accent) 72%, transparent)" };

    return EditorView.theme({
      ...editorBaseTheme,
      "&": { ...editorBaseTheme["&"], backgroundColor: colors.bg, color: colors.fg },
      ".cm-gutters": { backgroundColor: colors.gutterBg, color: colors.gutterFg, borderRight: `1px solid ${colors.border}` },
      ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: colors.active },
      ".cm-selectionBackground, .cm-content ::selection": { backgroundColor: colors.sel },
    }, dark ? { dark: true } : {});
  }

  function mountEditor(content: string) {
    if (!editorEl) return;
    editorView?.destroy();
    loadedContent = content;
    isDirty = false;
    saveMessage = null;
    saveError = null;

    editorView = new EditorView({
      doc: content,
      extensions: [
        basicSetup,
        javascript(),
        createEditorTheme(isDarkMode),
        syntaxHighlighting(isDarkMode ? darkHighlight : lightHighlight),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          isDirty = update.state.doc.toString() !== loadedContent;
          saveMessage = null;
          saveError = null;
        }),
      ],
      parent: editorEl,
    });
  }

  // Remount editor when file content changes
  $effect(() => {
    const content = fileContentStore ? ($fileContentStore?.data?.content ?? "") : "";
    if (editorEl) mountEditor(content);
  });

  async function handleSave() {
    if (!selectedWorkspace || !selectedPath || !editorView) return;
    const content = editorView.state.doc.toString();
    isSaving = true;
    saveError = null;
    saveMessage = null;
    try {
      await writeFile({ projectId, companyId, workspaceId: selectedWorkspace.id, filePath: selectedPath, content });
      loadedContent = content;
      isDirty = false;
      saveMessage = "Saved";
    } catch (err) {
      saveError = err instanceof Error ? err.message : String(err);
    } finally {
      isSaving = false;
    }
  }

  // Keyboard shortcut: Ctrl/Cmd+S
  function handleKeydown(event: KeyboardEvent) {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
    if (!selectedWorkspace || !selectedPath || !isDirty || isSaving) return;
    event.preventDefault();
    void handleSave();
  }

  // Responsive listeners
  onMount(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onResize = () => (isMobile = mq.matches);
    mq.addEventListener("change", onResize);

    const observer = new MutationObserver(() => {
      isDarkMode = document.documentElement.classList.contains("dark");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      mq.removeEventListener("change", onResize);
      observer.disconnect();
    };
  });

  onDestroy(() => editorView?.destroy());

  function workspaceLabel(w: Workspace): string {
    const path = w.path.trim();
    const name = w.name.trim();
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
    const base = /[\\/]/.test(path) && !uuid.test(path) ? path : name.length > 0 && !uuid.test(name) ? name : "";
    return base ? (w.isPrimary ? `${base} (primary)` : base) : w.isPrimary ? "(no path) (primary)" : "(no path)";
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="space-y-4">
  <!-- Workspace selector -->
  <div class="rounded-lg border border-border bg-card p-4">
    <label for="ws-select" class="text-sm font-medium text-muted-foreground">Workspace</label>
    <select
      id="ws-select"
      class="mt-2 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      value={resolvedWorkspaceId ?? ""}
      onchange={(e) => { workspaceId = (e.target as HTMLSelectElement).value || null; selectedPath = null; mobileView = "browser"; }}
    >
      {#each workspaces as w (w.id)}
        <option value={w.id}>{workspaceLabel(w)}</option>
      {/each}
    </select>
  </div>

  <!-- Panes: file tree + editor -->
  <div
    class="min-h-0"
    style:display={isMobile ? "block" : "grid"}
    style:gap="1rem"
    style:grid-template-columns={isMobile ? undefined : "320px minmax(0, 1fr)"}
    style:min-height={isMobile ? "20rem" : "26rem"}
  >
    <!-- File tree -->
    <div
      class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
      style:display={isMobile && mobileView === "editor" ? "none" : "flex"}
    >
      <div class="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        File Tree
      </div>
      <div class="min-h-0 flex-1 overflow-auto p-2">
        {#if selectedWorkspace}
          {#if fileListLoading}
            <p class="px-2 py-3 text-sm text-muted-foreground">Loading files...</p>
          {:else if entries.length > 0}
            <ul class="space-y-0.5">
              {#each entries as entry (entry.path)}
                <FileTreeNode
                  {entry}
                  {companyId}
                  {projectId}
                  workspaceId={selectedWorkspace.id}
                  {selectedPath}
                  onSelect={(path) => { selectedPath = path; mobileView = "editor"; }}
                />
              {/each}
            </ul>
          {:else}
            <p class="px-2 py-3 text-sm text-muted-foreground">No files found.</p>
          {/if}
        {:else}
          <p class="px-2 py-3 text-sm text-muted-foreground">Select a workspace.</p>
        {/if}
      </div>
    </div>

    <!-- Editor -->
    <div
      class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
      style:display={isMobile && mobileView === "browser" ? "none" : "flex"}
    >
      <div class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2">
        <div class="min-w-0">
          {#if isMobile}
            <button
              type="button"
              class="mb-2 inline-flex rounded-md border border-input bg-background px-2 py-1 text-xs font-medium text-muted-foreground"
              onclick={() => (mobileView = "browser")}
            >
              Back to files
            </button>
          {/if}
          <div class="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Editor</div>
          <div class="truncate text-sm text-foreground">{selectedPath ?? "No file selected"}</div>
        </div>
        <button
          type="button"
          class="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!selectedWorkspace || !selectedPath || !isDirty || isSaving}
          onclick={() => void handleSave()}
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>

      {#if isDirty || saveMessage || saveError}
        <div class="border-b border-border px-4 py-2 text-xs">
          {#if saveError}
            <span class="text-destructive">{saveError}</span>
          {:else if saveMessage}
            <span class="text-emerald-600">{saveMessage}</span>
          {:else}
            <span class="text-muted-foreground">Unsaved changes</span>
          {/if}
        </div>
      {/if}

      <div bind:this={editorEl} class="min-h-0 flex-1 overflow-auto overscroll-contain"></div>
    </div>
  </div>
</div>
