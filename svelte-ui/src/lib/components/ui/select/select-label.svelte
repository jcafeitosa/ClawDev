<script lang="ts">
  import { cn } from "$utils/index.js";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  type Props = HTMLAttributes<HTMLDivElement> & { class?: string; children?: Snippet };
  let { class: className, children, ...rest }: Props = $props();
</script>

<div data-slot="select-label" class={cn("text-muted-foreground px-2 py-1.5 text-xs", className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
