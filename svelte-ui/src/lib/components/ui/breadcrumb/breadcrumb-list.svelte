<script lang="ts">
  import { cn } from "$utils/index.js";
  import type { HTMLOlAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  type Props = HTMLOlAttributes & { class?: string; children?: Snippet };
  let { class: className, children, ...rest }: Props = $props();
</script>

<ol data-slot="breadcrumb-list" class={cn("text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5", className)} {...rest}>
  {#if children}{@render children()}{/if}
</ol>
