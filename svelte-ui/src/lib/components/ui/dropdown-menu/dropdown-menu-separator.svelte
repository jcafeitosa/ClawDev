<script lang="ts">
  import { cn } from "$utils/index.js";
  import { DropdownMenu as Primitive } from "bits-ui";

  type Props = Primitive.SeparatorProps & { class?: string };
  let { class: className, ...rest }: Props = $props();
</script>

<Primitive.Separator data-slot="dropdown-menu-separator" class={cn("bg-border -mx-1 my-1 h-px", className)} {...rest} />
