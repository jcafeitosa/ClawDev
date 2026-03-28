<script lang="ts">
  import { cn } from "$utils/index.js";
  import { MoreHorizontal } from "lucide-svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type Props = HTMLAttributes<HTMLSpanElement> & { class?: string };
  let { class: className, ...rest }: Props = $props();
</script>

<span data-slot="breadcrumb-ellipsis" role="presentation" aria-hidden="true" class={cn("flex size-9 items-center justify-center", className)} {...rest}>
  <MoreHorizontal class="size-4" />
  <span class="sr-only">More</span>
</span>
