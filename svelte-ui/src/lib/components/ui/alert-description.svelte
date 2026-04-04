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
  data-slot="alert-description"
  class={cn("col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed", className)}
>
  {@render children()}
</div>
