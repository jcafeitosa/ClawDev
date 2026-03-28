<script lang="ts">
  import { cn } from "$utils/index.js";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  type Props = HTMLAttributes<HTMLDivElement> & { class?: string; children?: Snippet };
  let { class: className, children, ...rest }: Props = $props();
</script>

<div data-slot="dialog-footer" class={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
