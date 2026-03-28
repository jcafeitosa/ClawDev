<script lang="ts">
  import { cn } from "$utils/index.js";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  type Props = HTMLAttributes<HTMLDivElement> & { class?: string; children?: Snippet };
  let { class: className, children, ...rest }: Props = $props();
</script>

<div data-slot="card-action" class={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
