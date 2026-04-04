<script lang="ts">
  import { cn } from "$utils/index.js";
  import type { Snippet } from "svelte";

  interface Props {
    class?: string;
    children: Snippet;
  }

  let { class: className, children }: Props = $props();
</script>

<div
  data-slot="alert-title"
  class={cn("col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight", className)}
>
  {@render children()}
</div>
