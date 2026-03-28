<script lang="ts">
  import { cn } from "$utils/index.js";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  type Props = HTMLAttributes<HTMLDivElement> & { class?: string; children?: Snippet };
  let { class: className, children, ...rest }: Props = $props();
</script>

<div data-slot="card-footer" class={cn("flex items-center px-6 [.border-t]:pt-6", className)} {...rest}>
  {#if children}{@render children()}{/if}
</div>
