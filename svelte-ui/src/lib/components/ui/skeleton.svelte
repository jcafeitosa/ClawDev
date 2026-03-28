<script lang="ts">
  import { cn } from "$utils/index.js";
  import type { HTMLAttributes } from "svelte/elements";

  type Props = HTMLAttributes<HTMLDivElement> & {
    class?: string;
  };

  let { class: className, ...rest }: Props = $props();
</script>

<div data-slot="skeleton" class={cn("bg-accent/75 animate-pulse rounded-md", className)} {...rest}></div>
