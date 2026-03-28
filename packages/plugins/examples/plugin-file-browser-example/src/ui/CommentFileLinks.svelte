<!--
  Comment annotation: shows file-path links extracted from comment body.
-->
<script lang="ts">
  import { pluginData } from "@clawdev/plugin-sdk/ui-svelte";
  import type { PluginCommentAnnotationProps } from "@clawdev/plugin-sdk/ui-svelte";

  const PLUGIN_KEY = "clawdev-file-browser-example";
  const FILES_TAB_SLOT_ID = "files-tab";

  type PluginConfig = { showFilesInSidebar?: boolean; commentAnnotationMode: string };

  let { context }: PluginCommentAnnotationProps = $props();

  const config = pluginData<PluginConfig>("plugin-config", {});
  const links = pluginData<{ links: string[] }>("comment-file-links", {
    commentId: context.entityId,
    issueId: context.parentEntityId,
    companyId: context.companyId,
  });

  let mode = $derived($config.data?.commentAnnotationMode ?? "both");
  let hidden = $derived(mode === "contextMenu" || mode === "none" || !$links.data?.links?.length);
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
  <div class="flex flex-wrap items-center gap-1.5">
    <span class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Files:</span>
    {#each $links.data?.links ?? [] as link (link)}
      {@const href = buildHref(link)}
      <a
        {href}
        onclick={(e) => navigate(href, e)}
        class="inline-flex items-center rounded-md border border-border bg-accent/30 px-1.5 py-0.5 text-xs font-mono text-primary hover:bg-accent/60 hover:underline transition-colors"
        title="Open {link} in file browser"
      >
        {link}
      </a>
    {/each}
  </div>
{/if}
