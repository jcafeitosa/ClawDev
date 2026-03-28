<script lang="ts">
  import { cn } from "$utils/index.js";
  import { ChevronRight } from "lucide-svelte";
  import type { HTMLLiAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  type Props = HTMLLiAttributes & { class?: string; children?: Snippet };
  let { class: className, children, ...rest }: Props = $props();
</script>

<li data-slot="breadcrumb-separator" role="presentation" aria-hidden="true" class={cn("[&>svg]:size-3.5", className)} {...rest}>
  {#if children}
    {@render children()}
  {:else}
    <ChevronRight />
  {/if}
</li>
