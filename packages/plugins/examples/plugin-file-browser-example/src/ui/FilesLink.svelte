<!--
  Project sidebar item: link to Files tab.
-->
<script lang="ts">
  import { pluginData } from "@clawdev/plugin-sdk/ui-svelte";
  import type { PluginProjectSidebarItemProps } from "@clawdev/plugin-sdk/ui-svelte";

  const PLUGIN_KEY = "clawdev-file-browser-example";
  const FILES_TAB_SLOT_ID = "files-tab";

  type PluginConfig = {
    showFilesInSidebar?: boolean;
    commentAnnotationMode: "annotation" | "contextMenu" | "both" | "none";
  };

  let { context }: PluginProjectSidebarItemProps = $props();

  const config = pluginData<PluginConfig>("plugin-config", {});
  let showFilesInSidebar = $derived($config.data?.showFilesInSidebar ?? false);

  let projectId = $derived(context.entityId);
  let prefix = $derived(context.companyPrefix ? `/${context.companyPrefix}` : "");
  let tabValue = $derived(`plugin:${PLUGIN_KEY}:${FILES_TAB_SLOT_ID}`);
  let href = $derived(`${prefix}/projects/${projectId}?tab=${encodeURIComponent(tabValue)}`);

  let isActive = $derived.by(() => {
    if (typeof window === "undefined") return false;
    const pathname = window.location.pathname.replace(/\/+$/, "");
    const segments = pathname.split("/").filter(Boolean);
    const projectsIndex = segments.indexOf("projects");
    const activeProjectRef = projectsIndex >= 0 ? segments[projectsIndex + 1] ?? null : null;
    const activeTab = new URLSearchParams(window.location.search).get("tab");
    return activeTab === tabValue && activeProjectRef === projectId;
  });

  function handleClick(event: MouseEvent) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    window.history.pushState({}, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
</script>

{#if !$config.loading && showFilesInSidebar}
  <a
    {href}
    onclick={handleClick}
    aria-current={isActive ? "page" : undefined}
    class="block px-3 py-1 text-[12px] truncate transition-colors {isActive
      ? 'bg-accent text-foreground font-medium'
      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}"
  >
    Files
  </a>
{/if}
