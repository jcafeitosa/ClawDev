<script lang="ts">
  import { cn } from "$utils/index.js";
  import { Separator as SeparatorPrimitive } from "bits-ui";

  type Props = SeparatorPrimitive.RootProps & {
    class?: string;
    orientation?: "horizontal" | "vertical";
    decorative?: boolean;
  };

  let { class: className, orientation = "horizontal", decorative = true, ...rest }: Props = $props();
</script>

<SeparatorPrimitive.Root
  data-slot="separator"
  {decorative}
  {orientation}
  class={cn(
    "bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
    className,
  )}
  {...rest}
/>
