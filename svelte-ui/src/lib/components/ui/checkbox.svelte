<script lang="ts">
  import { cn } from "$utils/index.js";
  import { Checkbox as CheckboxPrimitive } from "bits-ui";
  import { Check } from "lucide-svelte";

  type Props = CheckboxPrimitive.RootProps & {
    class?: string;
  };

  let { class: className, ...rest }: Props = $props();
</script>

<CheckboxPrimitive.Root
  data-slot="checkbox"
  class={cn(
    "peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
    className,
  )}
  {...rest}
>
  {#snippet children({ checked })}
    <div class="grid place-content-center text-current">
      {#if checked}
        <Check class="size-3.5" />
      {/if}
    </div>
  {/snippet}
</CheckboxPrimitive.Root>
