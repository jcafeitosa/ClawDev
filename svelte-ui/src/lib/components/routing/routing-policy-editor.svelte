<script lang="ts">
  import { api } from "$lib/api";
  import { toastStore } from "$stores/toast.svelte.js";
  import { Button, Badge, Card, CardHeader, CardTitle, CardContent, CardFooter, Input, Label, Separator } from "$components/ui/index.js";
  import { Settings, Zap, Brain, DollarSign, Save, X, Sparkles, Gauge, Shield } from "lucide-svelte";

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------
  type RoutingMode = "manual" | "auto_constrained" | "full_auto";

  type RoutingPolicy = {
    mode: RoutingMode;
    qualityBias: number;
    maxCostPerRunUsd: number | null;
    preferredTier: "premium" | "standard" | "fast" | "auto";
    allowedProviders: string[];
    blockedProviders: string[];
  };

  type Props = {
    agentId: string;
    companyId: string;
    currentPolicy: RoutingPolicy | null;
    onSaved?: (policy: RoutingPolicy) => void;
    onCancel?: () => void;
  };

  let { agentId, companyId, currentPolicy = null, onSaved, onCancel }: Props = $props();

  // ---------------------------------------------------------------------------
  // Available providers
  // ---------------------------------------------------------------------------
  const ALL_PROVIDERS = ["anthropic", "openai", "google", "mistral", "meta", "cohere", "deepseek"];
  const TIER_OPTIONS: { value: RoutingPolicy["preferredTier"]; label: string }[] = [
    { value: "auto", label: "Auto" },
    { value: "premium", label: "Premium" },
    { value: "standard", label: "Standard" },
    { value: "fast", label: "Fast" },
  ];

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let mode = $state<RoutingMode>(currentPolicy?.mode ?? "manual");
  let qualityBias = $state(currentPolicy?.qualityBias ?? 0.5);
  let maxCostPerRunUsd = $state<string>(currentPolicy?.maxCostPerRunUsd?.toString() ?? "");
  let preferredTier = $state<RoutingPolicy["preferredTier"]>(currentPolicy?.preferredTier ?? "auto");
  let allowedProviders = $state<Set<string>>(new Set(currentPolicy?.allowedProviders ?? ALL_PROVIDERS));
  let blockedProviders = $state<Set<string>>(new Set(currentPolicy?.blockedProviders ?? []));
  let saving = $state(false);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  let qualityBiasPercent = $derived(Math.round(qualityBias * 100));
  let qualityBiasLabel = $derived(
    qualityBias < 0.3 ? "Cost Optimized" : qualityBias < 0.7 ? "Balanced" : "Quality First"
  );

  // ---------------------------------------------------------------------------
  // Presets
  // ---------------------------------------------------------------------------
  function applyPreset(preset: "cost_saver" | "balanced" | "quality_first") {
    switch (preset) {
      case "cost_saver":
        qualityBias = 0.2;
        preferredTier = "fast";
        if (mode === "manual") mode = "auto_constrained";
        break;
      case "balanced":
        qualityBias = 0.5;
        preferredTier = "auto";
        if (mode === "manual") mode = "auto_constrained";
        break;
      case "quality_first":
        qualityBias = 0.9;
        preferredTier = "premium";
        if (mode === "manual") mode = "auto_constrained";
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Provider toggle
  // ---------------------------------------------------------------------------
  function toggleProvider(provider: string) {
    const newAllowed = new Set(allowedProviders);
    const newBlocked = new Set(blockedProviders);

    if (newAllowed.has(provider)) {
      newAllowed.delete(provider);
      newBlocked.add(provider);
    } else {
      newBlocked.delete(provider);
      newAllowed.add(provider);
    }

    allowedProviders = newAllowed;
    blockedProviders = newBlocked;
  }

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------
  async function handleSave() {
    saving = true;
    try {
      const policy: RoutingPolicy = {
        mode,
        qualityBias,
        maxCostPerRunUsd: maxCostPerRunUsd ? parseFloat(maxCostPerRunUsd) : null,
        preferredTier,
        allowedProviders: [...allowedProviders],
        blockedProviders: [...blockedProviders],
      };

      const res = await api(`/api/agents/${agentId}`, {
        method: "PATCH",
        body: JSON.stringify({ routingPolicy: policy }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to save routing policy" }));
        toastStore.error(err.message ?? "Failed to save routing policy");
        return;
      }

      toastStore.success("Routing policy saved");
      onSaved?.(policy);
    } catch (e) {
      toastStore.error("Network error saving routing policy");
    } finally {
      saving = false;
    }
  }
</script>

<Card class="rounded-lg">
  <CardHeader class="px-6">
    <CardTitle class="flex items-center gap-2 text-base">
      <Settings class="size-4 text-muted-foreground" />
      Routing Policy
    </CardTitle>
  </CardHeader>

  <CardContent class="px-6 space-y-6">
    <!-- Mode Toggle -->
    <div class="space-y-2">
      <Label class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Mode</Label>
      <div class="flex gap-1 rounded-lg bg-muted p-1">
        <button
          class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors {mode === 'manual' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          onclick={() => (mode = "manual")}
        >
          <span class="flex items-center justify-center gap-1.5">
            <Shield class="size-3.5" />
            Manual
          </span>
        </button>
        <button
          class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors {mode === 'auto_constrained' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          onclick={() => (mode = "auto_constrained")}
        >
          <span class="flex items-center justify-center gap-1.5">
            <Gauge class="size-3.5" />
            Auto-Constrained
          </span>
        </button>
        <button
          class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors {mode === 'full_auto' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          onclick={() => (mode = "full_auto")}
        >
          <span class="flex items-center justify-center gap-1.5">
            <Brain class="size-3.5" />
            Full Auto
          </span>
        </button>
      </div>
    </div>

    <!-- Manual Mode Info -->
    {#if mode === "manual"}
      <div class="rounded-md border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
        <p class="font-medium text-foreground mb-1">Manual Routing</p>
        <p>The agent uses its currently configured adapter and model. No automatic model selection is performed.</p>
      </div>
    {/if}

    <!-- Auto Modes -->
    {#if mode === "auto_constrained" || mode === "full_auto"}
      {#if mode === "full_auto"}
        <div class="rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-200">
          <span class="font-medium">Full Auto:</span> The system will choose the best model for each task based on complexity analysis and available capacity.
        </div>
      {/if}

      <!-- Presets -->
      <div class="space-y-2">
        <Label class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Quick Presets</Label>
        <div class="flex gap-2">
          <Button variant="outline" size="sm" onclick={() => applyPreset("cost_saver")} class="flex items-center gap-1.5">
            <DollarSign class="size-3.5" />
            Cost Saver
          </Button>
          <Button variant="outline" size="sm" onclick={() => applyPreset("balanced")} class="flex items-center gap-1.5">
            <Gauge class="size-3.5" />
            Balanced
          </Button>
          <Button variant="outline" size="sm" onclick={() => applyPreset("quality_first")} class="flex items-center gap-1.5">
            <Sparkles class="size-3.5" />
            Quality First
          </Button>
        </div>
      </div>

      <Separator />

      <!-- Quality Bias Slider -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <Label class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Quality Bias</Label>
          <Badge variant="secondary" class="text-xs">{qualityBiasLabel} ({qualityBiasPercent}%)</Badge>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          bind:value={qualityBias}
          class="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted accent-primary"
        />
        <div class="flex justify-between text-xs text-muted-foreground">
          <span>Cost Optimized</span>
          <span>Quality First</span>
        </div>
      </div>

      <!-- Max Cost Per Run -->
      <div class="space-y-2">
        <Label class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Max Cost Per Run (USD)</Label>
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="No limit"
            bind:value={maxCostPerRunUsd}
            class="pl-7"
          />
        </div>
        <p class="text-xs text-muted-foreground">Leave empty for no cost limit per run.</p>
      </div>

      <!-- Preferred Tier -->
      <div class="space-y-2">
        <Label class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Preferred Tier</Label>
        <div class="flex gap-1 rounded-lg bg-muted p-1">
          {#each TIER_OPTIONS as opt}
            <button
              class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors {preferredTier === opt.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
              onclick={() => (preferredTier = opt.value)}
            >
              {opt.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Providers -->
      <div class="space-y-2">
        <Label class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Allowed Providers</Label>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {#each ALL_PROVIDERS as provider}
            {@const isAllowed = allowedProviders.has(provider)}
            <button
              class="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors {isAllowed ? 'border-primary/50 bg-primary/10 text-foreground' : 'border-border bg-muted/30 text-muted-foreground line-through'}"
              onclick={() => toggleProvider(provider)}
            >
              <span class="size-3 rounded-full {isAllowed ? 'bg-green-500' : 'bg-red-500/50'}"></span>
              <span class="capitalize">{provider}</span>
            </button>
          {/each}
        </div>
        <p class="text-xs text-muted-foreground">Click a provider to toggle it on/off.</p>
      </div>
    {/if}
  </CardContent>

  <CardFooter class="px-6 flex justify-end gap-2">
    {#if onCancel}
      <Button variant="outline" onclick={onCancel} disabled={saving}>
        <X class="size-4 mr-1.5" />
        Cancel
      </Button>
    {/if}
    <Button onclick={handleSave} disabled={saving}>
      {#if saving}
        <span class="size-4 mr-1.5 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
        Saving...
      {:else}
        <Save class="size-4 mr-1.5" />
        Save Policy
      {/if}
    </Button>
  </CardFooter>
</Card>
