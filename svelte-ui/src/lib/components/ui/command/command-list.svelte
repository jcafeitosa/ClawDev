<script lang="ts">
  import { cn } from "$utils/index.js";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  type Props = HTMLAttributes<HTMLDivElement> & { class?: string; children?: Snippet };
  let { class: className, children, ...rest }: Props = $props();
</script>

<div data-slot="command-list" class={cn("max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto", className)} role="listbox" {...rest}>
  {#if children}{@render children()}{/if}
</div>
