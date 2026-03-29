<script lang="ts">
  import { Badge, Separator } from "$components/ui/index.js";
  import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "$components/ui/index.js";
  import { Compass, Cpu, DollarSign, Brain, AlertTriangle, ChevronDown, ChevronRight, Repeat } from "lucide-svelte";

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------
  type RoutingDecision = {
    id?: string;
    selectedModel: string;
    selectedAdapter: string;
    tier: number;
    tierLabel: string;
    reasoning: string;
    estimatedCostUsd: number;
    complexityScore: number;
    complexityLabel: string;
    isFailover: boolean;
    failoverReason?: string;
    alternatives?: { model: string; adapter: string; tier: number; score: number }[];
  };

  type Props = {
    decision: RoutingDecision;
  };

  let { decision }: Props = $props();

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let alternativesOpen = $state(false);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  let tierColor = $derived.by(() => {
    switch (decision.tier) {
      case 1: return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case 2: return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case 3: return "bg-green-500/20 text-green-400 border-green-500/30";
      default: return "bg-muted text-muted-foreground";
    }
  });

  let complexityColor = $derived.by(() => {
    if (decision.complexityScore < 0.3) return "bg-green-500";
    if (decision.complexityScore < 0.7) return "bg-amber-500";
    return "bg-red-500";
  });

  let complexityPercent = $derived(Math.round(decision.complexityScore * 100));
</script>

<div class="rounded-lg border border-border bg-card p-4 space-y-3">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2 text-sm font-semibold text-foreground">
      <Compass class="size-4 text-primary" />
      Routing Decision
    </div>
    <div class="flex items-center gap-2">
      {#if decision.isFailover}
        <Badge variant="destructive" class="text-xs flex items-center gap-1">
          <Repeat class="size-3" />
          Failover
        </Badge>
      {/if}
      <Badge class="border {tierColor} text-xs">
        Tier {decision.tier} &mdash; {decision.tierLabel}
      </Badge>
    </div>
  </div>

  <!-- Failover reason -->
  {#if decision.isFailover && decision.failoverReason}
    <div class="rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300 flex items-start gap-2">
      <AlertTriangle class="size-3.5 shrink-0 mt-0.5" />
      <span>{decision.failoverReason}</span>
    </div>
  {/if}

  <!-- Model + Adapter -->
  <div class="flex items-center gap-2 text-sm">
    <Cpu class="size-3.5 text-muted-foreground" />
    <span class="font-medium text-foreground">{decision.selectedModel}</span>
    <span class="text-muted-foreground">&middot;</span>
    <span class="text-muted-foreground">{decision.selectedAdapter}</span>
  </div>

  <!-- Reasoning -->
  <p class="text-sm text-muted-foreground leading-relaxed">{decision.reasoning}</p>

  <!-- Stats row -->
  <div class="flex items-center gap-4 text-xs text-muted-foreground">
    <!-- Cost -->
    <div class="flex items-center gap-1">
      <DollarSign class="size-3" />
      <span class="text-foreground font-medium">${decision.estimatedCostUsd.toFixed(4)}</span>
    </div>

    <span class="text-muted-foreground/50">&middot;</span>

    <!-- Complexity bar -->
    <div class="flex items-center gap-2">
      <Brain class="size-3" />
      <div class="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
        <div
          class="h-full rounded-full transition-all {complexityColor}"
          style="width: {complexityPercent}%"
        ></div>
      </div>
      <span class="text-foreground font-medium capitalize">{decision.complexityLabel}</span>
    </div>
  </div>

  <!-- Collapsible alternatives -->
  {#if decision.alternatives && decision.alternatives.length > 0}
    <Separator />
    <Collapsible bind:open={alternativesOpen}>
      <CollapsibleTrigger class="flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
        {#if alternativesOpen}
          <ChevronDown class="size-3.5" />
        {:else}
          <ChevronRight class="size-3.5" />
        {/if}
        Alternatives ({decision.alternatives.length})
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div class="mt-2 space-y-1.5">
          {#each decision.alternatives as alt}
            <div class="flex items-center justify-between rounded-md bg-muted/30 px-3 py-1.5 text-xs">
              <div class="flex items-center gap-2">
                <span class="font-medium text-foreground">{alt.model}</span>
                <span class="text-muted-foreground">{alt.adapter}</span>
                <Badge variant="outline" class="text-[10px] px-1.5 py-0">T{alt.tier}</Badge>
              </div>
              <div class="flex items-center gap-2">
                <div class="h-1 w-12 rounded-full bg-muted overflow-hidden">
                  <div class="h-full rounded-full bg-primary/60" style="width: {alt.score * 100}%"></div>
                </div>
                <span class="w-8 text-right text-muted-foreground">{(alt.score * 100).toFixed(0)}%</span>
              </div>
            </div>
          {/each}
        </div>
      </CollapsibleContent>
    </Collapsible>
  {/if}
</div>
