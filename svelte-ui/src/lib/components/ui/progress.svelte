<script lang="ts">
  import { cn } from "$utils/index.js";

  interface Props {
    value?: number;
    max?: number;
    class?: string;
    indicatorClass?: string;
  }

  let { value = 0, max = 100, class: className, indicatorClass }: Props = $props();

  let percent = $derived(Math.min(100, Math.max(0, (value / max) * 100)));
</script>

<div
  data-slot="progress"
  role="progressbar"
  aria-valuenow={value}
  aria-valuemin={0}
  aria-valuemax={max}
  class={cn("relative h-2 w-full overflow-hidden rounded-full bg-primary/20", className)}
>
  <div
    data-slot="progress-indicator"
    class={cn("h-full w-full flex-1 bg-primary transition-all duration-300 ease-out", indicatorClass)}
    style="transform: translateX(-{100 - percent}%)"
  ></div>
</div>
