<script lang="ts">
  import { cn } from "$utils/index.js";
  import type { HTMLImgAttributes } from "svelte/elements";

  type Props = HTMLImgAttributes & { class?: string };
  let { class: className, ...rest }: Props = $props();
</script>

<img data-slot="avatar-image" class={cn("aspect-square size-full", className)} {...rest} alt={rest.alt ?? ""} />
