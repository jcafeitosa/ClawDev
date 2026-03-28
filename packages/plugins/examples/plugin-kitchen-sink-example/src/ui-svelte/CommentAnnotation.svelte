<!--
  Comment annotation — rendered below each comment in issue timeline.
-->
<script lang="ts">
  import { pluginData, pluginAction } from "@clawdev/plugin-sdk/ui-svelte";
  import type { PluginCommentAnnotationProps } from "@clawdev/plugin-sdk/ui-svelte";
  import type { CommentContextData, PluginConfigData } from "./types.js";

  let { context }: PluginCommentAnnotationProps = $props();

  const config = pluginData<PluginConfigData>("plugin-config", {});
  const commentData = pluginData<CommentContextData>("comment-context", {
    commentId: context.entityId,
    issueId: context.parentEntityId,
    companyId: context.companyId,
  });

  let show = $derived($config.data?.showCommentAnnotation !== false);
  let data = $derived($commentData.data);
</script>

{#if show && data}
  <div style="display: flex; gap: 8px; align-items: center; font-size: 11px; color: var(--muted-foreground);">
    <span>🧪 {data.length} chars</span>
    {#if data.copiedCount > 0}
      <span>· copied {data.copiedCount}×</span>
    {/if}
  </div>
{/if}
