<script lang="ts">
  import { api } from "$lib/api";
  import { toastStore } from "$stores/toast.svelte.js";
  import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Textarea, Separator, Progress } from "$components/ui/index.js";
  import { Play, Loader2, Cpu, DollarSign, Brain, Zap, ArrowRight } from "lucide-svelte";

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------
  type Props = {
    companyId: string;
    agentId: string;
  };

  let { companyId, agentId }: Props = $props();

  // ---------------------------------------------------------------------------
  // Preset tasks
  // ---------------------------------------------------------------------------
  const PRESETS = [
    { label: "Fix Typo", description: "Fix a typo in README", complexity: "trivial" },
    { label: "REST Endpoint", description: "Implement new REST API endpoint with validation and tests", complexity: "moderate" },
    { label: "Microservices", description: "Architect a microservices migration from monolith with event sourcing", complexity: "complex" },
  ] as const;

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let customPrompt = $state("");
  let activePrompt = $state("");
  let simulating = $state(false);
  let result = $state<{
    selectedModel: { model: string; adapter: string; tier: number; tierLabel: string };
    reasoning: string;
    alternatives: { model: string; adapter: string; tier: number; score: number }[];
    estimatedCostUsd: number;
    complexityScore: number;
    complexityLabel: string;
  } | null>(null);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  let tierColor = $derived.by(() => {
    if (!result) return "";
    switch (result.selectedModel.tier) {
      case 1: return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case 2: return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case 3: return "bg-green-500/20 text-green-400 border-green-500/30";
      default: return "bg-muted text-muted-foreground";
    }
  });

  let complexityColor = $derived.by(() => {
    if (!result) return "bg-muted";
    if (result.complexityScore < 0.3) return "bg-green-500";
    if (result.complexityScore < 0.7) return "bg-amber-500";
    return "bg-red-500";
  });

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  function selectPreset(description: string) {
    customPrompt = description;
  }

  async function simulate() {
    const prompt = customPrompt.trim();
    if (!prompt) {
      toastStore.error("Enter a task description to simulate");
      return;
    }

    activePrompt = prompt;
    simulating = true;
    result = null;

    try {
      const res = await api(`/api/companies/${companyId}/routing/dry-run`, {
        method: "POST",
        body: JSON.stringify({ agentId, taskDescription: prompt }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Simulation failed" }));
        toastStore.error(err.message ?? "Simulation failed");
        return;
      }

      result = await res.json();
    } catch (e) {
      toastStore.error("Network error during simulation");
    } finally {
      simulating = false;
    }
  }
</script>

<Card class="rounded-lg">
  <CardHeader class="px-6">
    <CardTitle class="flex items-center gap-2 text-base">
      <Play class="size-4 text-muted-foreground" />
      Routing Dry Run
    </CardTitle>
  </CardHeader>

  <CardContent class="px-6 space-y-4">
    <!-- Presets -->
    <div class="flex flex-wrap gap-2">
      {#each PRESETS as preset}
        <Button
          variant="outline"
          size="sm"
          onclick={() => selectPreset(preset.description)}
          class="text-xs"
        >
          {preset.label}
          <Badge variant="secondary" class="ml-1.5 text-[10px]">{preset.complexity}</Badge>
        </Button>
      {/each}
    </div>

    <!-- Custom prompt -->
    <Textarea
      placeholder="Describe the task to simulate routing for..."
      bind:value={customPrompt}
      rows={3}
      class="resize-none"
    />

    <!-- Simulate button -->
    <Button onclick={simulate} disabled={simulating || !customPrompt.trim()} class="w-full">
      {#if simulating}
        <Loader2 class="size-4 mr-1.5 animate-spin" />
        Simulating...
      {:else}
        <Zap class="size-4 mr-1.5" />
        Simulate Routing
      {/if}
    </Button>

    <!-- Results -->
    {#if result}
      <Separator />

      <div class="space-y-4">
        <!-- Task context -->
        <div class="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          <span class="font-medium text-foreground">Task:</span> {activePrompt}
        </div>

        <!-- Selected Model -->
        <div class="rounded-md border border-border p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Cpu class="size-4 text-primary" />
              <span class="font-semibold text-foreground">{result.selectedModel.model}</span>
            </div>
            <Badge class="border {tierColor}">
              Tier {result.selectedModel.tier} &mdash; {result.selectedModel.tierLabel}
            </Badge>
          </div>

          <div class="text-xs text-muted-foreground">
            Adapter: <span class="font-medium text-foreground">{result.selectedModel.adapter}</span>
          </div>
        </div>

        <!-- Reasoning -->
        <div class="space-y-1">
          <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reasoning</p>
          <p class="text-sm text-foreground leading-relaxed">{result.reasoning}</p>
        </div>

        <!-- Stats row -->
        <div class="grid grid-cols-2 gap-3">
          <!-- Estimated cost -->
          <div class="rounded-md border border-border p-3 space-y-1">
            <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <DollarSign class="size-3" />
              Estimated Cost
            </div>
            <p class="text-lg font-semibold text-foreground">${result.estimatedCostUsd.toFixed(4)}</p>
          </div>

          <!-- Complexity -->
          <div class="rounded-md border border-border p-3 space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Brain class="size-3" />
                Complexity
              </div>
              <span class="text-xs font-medium text-foreground capitalize">{result.complexityLabel}</span>
            </div>
            <div class="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500 {complexityColor}"
                style="width: {result.complexityScore * 100}%"
              ></div>
            </div>
          </div>
        </div>

        <!-- Alternatives table -->
        {#if result.alternatives.length > 0}
          <div class="space-y-2">
            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Alternatives Considered</p>
            <div class="rounded-md border border-border overflow-hidden">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-border bg-muted/50">
                    <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Model</th>
                    <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Adapter</th>
                    <th class="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Tier</th>
                    <th class="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {#each result.alternatives as alt, i}
                    <tr class="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td class="px-3 py-2 font-medium text-foreground">{alt.model}</td>
                      <td class="px-3 py-2 text-muted-foreground">{alt.adapter}</td>
                      <td class="px-3 py-2 text-center">
                        <Badge variant="outline" class="text-xs">T{alt.tier}</Badge>
                      </td>
                      <td class="px-3 py-2 text-right">
                        <div class="flex items-center justify-end gap-2">
                          <div class="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                            <div class="h-full rounded-full bg-primary/70" style="width: {alt.score * 100}%"></div>
                          </div>
                          <span class="text-xs text-muted-foreground w-8 text-right">{(alt.score * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </CardContent>
</Card>
