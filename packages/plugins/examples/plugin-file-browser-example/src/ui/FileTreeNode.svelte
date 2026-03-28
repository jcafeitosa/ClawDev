<!--
  Recursive file tree node. Directories expand on click to show children.
-->
<script lang="ts">
  import { pluginData } from "@clawdev/plugin-sdk/ui-svelte";

  type FileEntry = { name: string; path: string; isDirectory: boolean };

  let {
    entry,
    companyId,
    projectId,
    workspaceId,
    selectedPath,
    onSelect,
    depth = 0,
  }: {
    entry: FileEntry;
    companyId: string | null;
    projectId: string;
    workspaceId: string;
    selectedPath: string | null;
    onSelect: (path: string) => void;
    depth?: number;
  } = $props();

  let isExpanded = $state(false);
  let isSelected = $derived(selectedPath === entry.path);

  // Lazy-load children only when directory is expanded
  let childStore = $derived(
    entry.isDirectory && isExpanded
      ? pluginData<{ entries: FileEntry[] }>("fileList", {
          companyId,
          projectId,
          workspaceId,
          directoryPath: entry.path,
        })
      : null,
  );

  let children: FileEntry[] = $derived(
    childStore ? ($childStore?.data?.entries ?? []) : [],
  );
</script>

{#if entry.isDirectory}
  <li>
    <button
      type="button"
      class="flex w-full items-center gap-2 rounded-none px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent/60"
      style:padding-left="{depth * 14 + 8}px"
      onclick={() => (isExpanded = !isExpanded)}
      aria-expanded={isExpanded}
    >
      <span class="w-3 text-xs text-muted-foreground">{isExpanded ? "▾" : "▸"}</span>
      <span class="truncate font-medium">{entry.name}</span>
    </button>
    {#if isExpanded && children.length > 0}
      <ul class="space-y-0.5">
        {#each children as child (child.path)}
          <svelte:self
            entry={child}
            {companyId}
            {projectId}
            {workspaceId}
            {selectedPath}
            {onSelect}
            depth={depth + 1}
          />
        {/each}
      </ul>
    {/if}
  </li>
{:else}
  <li>
    <button
      type="button"
      class="block w-full rounded-none px-2 py-1.5 text-left text-sm transition-colors {isSelected
        ? 'bg-accent text-foreground'
        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}"
      style:padding-left="{depth * 14 + 23}px"
      onclick={() => onSelect(entry.path)}
    >
      <span class="truncate">{entry.name}</span>
    </button>
  </li>
{/if}
