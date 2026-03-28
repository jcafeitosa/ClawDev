<script lang="ts">
  import { cn } from "$utils/index.js";
  import { Search } from "lucide-svelte";
  import type { HTMLInputAttributes } from "svelte/elements";

  type Props = HTMLInputAttributes & { class?: string };
  let { class: className, ...rest }: Props = $props();
</script>

<div data-slot="command-input-wrapper" class="flex h-9 items-center gap-2 border-b px-3">
  <Search class="size-4 shrink-0 opacity-50" />
  <input
    data-slot="command-input"
    class={cn(
      "placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...rest}
  />
</div>
