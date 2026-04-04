<script lang="ts">
  import { cn } from "$utils/index.js";
  import type { Snippet } from "svelte";

  interface Props {
    variant?: "default" | "destructive" | "warning" | "success";
    class?: string;
    children: Snippet;
  }

  let { variant = "default", class: className, children }: Props = $props();

  const variantStyles: Record<string, string> = {
    default: "bg-card text-card-foreground border-border",
    destructive: "border-red-500/30 bg-red-500/[0.06] text-red-700 dark:text-red-300 [&>svg]:text-red-600 dark:[&>svg]:text-red-400",
    warning: "border-amber-500/30 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400",
    success: "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-400",
  };
</script>

<div
  data-slot="alert"
  role="alert"
  class={cn(
    "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
    variantStyles[variant],
    className,
  )}
>
  {@render children()}
</div>
