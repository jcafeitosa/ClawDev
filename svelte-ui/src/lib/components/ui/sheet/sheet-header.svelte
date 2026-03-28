<script lang="ts">
  import { cn } from "$utils/index.js";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  type Props = HTMLAttributes<HTMLDivElement> & { class?: string; children?: Snippet };
  let { class: className, children, ...rest }: Props = $props();
</script>

<div data-slot="sheet-header" class={cn("flex flex-col gap-1.5 p-4", className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
