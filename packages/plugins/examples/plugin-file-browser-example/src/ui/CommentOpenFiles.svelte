<!--
  Comment context menu item: "Open in Files" action per comment.
-->
<script lang="ts">
  import { pluginData } from "@clawdev/plugin-sdk/ui-svelte";
  import type { PluginCommentContextMenuItemProps } from "@clawdev/plugin-sdk/ui-svelte";

  const PLUGIN_KEY = "clawdev-file-browser-example";
  const FILES_TAB_SLOT_ID = "files-tab";

  type PluginConfig = { showFilesInSidebar?: boolean; commentAnnotationMode: string };

  let { context }: PluginCommentContextMenuItemProps = $props();

  const config = pluginData<PluginConfig>("plugin-config", {});
  const linksStore = pluginData<{ links: string[] }>("comment-file-links", {
    commentId: context.entityId,
    issueId: context.parentEntityId,
    companyId: context.companyId,
  });

  let mode = $derived($config.data?.commentAnnotationMode ?? "both");
  let hidden = $derived(mode === "annotation" || mode === "none" || !$linksStore.data?.links?.length);
  let prefix = $derived(context.companyPrefix ? `/${context.companyPrefix}` : "");
  let projectId = $derived(context.projectId);

  function buildHref(filePath: string): string {
    if (!projectId) return "#";
    const tabValue = `plugin:${PLUGIN_KEY}:${FILES_TAB_SLOT_ID}`;
    return `${prefix}/projects/${projectId}?tab=${encodeURIComponent(tabValue)}&file=${encodeURIComponent(filePath)}`;
  }

  function navigate(href: string, event: MouseEvent) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    window.history.pushState({}, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
</script>

{#if !hidden}
  <div>
    <div class="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Files</div>
    {#each $linksStore.data?.links ?? [] as link (link)}
      {@const href = buildHref(link)}
      {@const fileName = link.split("/").pop() ?? link}
      <a
        {href}
        onclick={(e) => navigate(href, e)}
        class="flex w-full items-center gap-2 rounded px-2 py-1 text-xs text-foreground hover:bg-accent transition-colors"
        title="Open {link} in file browser"
      >
        <span class="truncate font-mono">{fileName}</span>
      </a>
    {/each}
  </div>
{/if}
