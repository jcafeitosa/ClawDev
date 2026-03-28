<script lang="ts">
  import { cn } from "$utils/index.js";
  import type { HTMLLiAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  type Props = HTMLLiAttributes & { class?: string; children?: Snippet };
  let { class: className, children, ...rest }: Props = $props();
</script>

<li data-slot="breadcrumb-item" class={cn("inline-flex items-center gap-1.5", className)} {...rest}>
  {#if children}{@render children()}{/if}
</li>
