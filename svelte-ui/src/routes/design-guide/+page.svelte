<script lang="ts">
  import {
    Button,
    Badge,
    Input,
    Textarea,
    Label,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
    Separator,
    Checkbox,
    Skeleton,
  } from "$components/ui/index.js";
  import { StatusBadge } from "$components/index.js";
  import { toastStore } from "$stores/toast.svelte.js";
  import { Copy, Check, Zap, Info, AlertTriangle, XCircle } from "lucide-svelte";

  // Interactive state
  let checkboxChecked = $state(false);
  let inputValue = $state("");
  let textareaValue = $state("");
  let clickCount = $state(0);

  function showToast(tone: "info" | "success" | "warn" | "error", title: string) {
    toastStore.push({ title, body: `Triggered from the design guide.`, tone });
  }

  const buttonVariants = [
    { variant: "default" as const, label: "Default" },
    { variant: "destructive" as const, label: "Destructive" },
    { variant: "outline" as const, label: "Outline" },
    { variant: "secondary" as const, label: "Secondary" },
    { variant: "ghost" as const, label: "Ghost" },
  ];

  const buttonSizes = [
    { size: "xs" as const, label: "XS" },
    { size: "sm" as const, label: "SM" },
    { size: "default" as const, label: "Default" },
    { size: "lg" as const, label: "LG" },
  ];

  const badgeVariants = [
    { variant: "default" as const, label: "Default" },
    { variant: "secondary" as const, label: "Secondary" },
    { variant: "destructive" as const, label: "Destructive" },
    { variant: "outline" as const, label: "Outline" },
  ];

  const statusValues = [
    "active", "idle", "running", "paused", "failed",
    "completed", "pending", "approved", "rejected", "blocked",
  ];

  const colors = [
    { name: "Primary", hex: "#2563EB", class: "bg-[#2563EB]" },
    { name: "Success", hex: "#10B981", class: "bg-emerald-500" },
    { name: "Warning", hex: "#F59E0B", class: "bg-amber-500" },
    { name: "Error", hex: "#EF4444", class: "bg-red-500" },
    { name: "Muted", hex: "#94A3B8", class: "bg-[#94A3B8]" },
  ];
</script>

<div class="design-guide">
  <!-- Header -->
  <header class="dg-header">
    <div class="dg-header-inner">
      <div class="flex items-center gap-3">
        <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563EB]/15">
          <Zap class="size-5 text-[#60a5fa]" />
        </div>
        <div>
          <h1 class="text-2xl font-bold text-[#F8FAFC] tracking-tight">Design Guide</h1>
          <p class="text-sm text-[#64748b]">ClawDev UI Components</p>
        </div>
      </div>
    </div>
  </header>

  <main class="dg-main">
    <!-- 1. Buttons -->
    <section class="dg-section">
      <h2 class="dg-section-title">Buttons</h2>
      <p class="dg-section-desc">All button variants and sizes. Click any button to increment the counter.</p>

      <div class="dg-subsection">
        <h3 class="dg-subsection-title">Variants</h3>
        <div class="flex flex-wrap gap-3 items-center">
          {#each buttonVariants as { variant, label }}
            <Button {variant} onclick={() => { clickCount++; showToast('info', `${label} button clicked (${clickCount})`); }}>
              {label}
            </Button>
          {/each}
        </div>
      </div>

      <div class="dg-subsection">
        <h3 class="dg-subsection-title">Sizes</h3>
        <div class="flex flex-wrap gap-3 items-end">
          {#each buttonSizes as { size, label }}
            <Button {size} onclick={() => clickCount++}>
              {label}
            </Button>
          {/each}
          <Button size="icon" onclick={() => clickCount++}>
            <Zap class="size-4" />
          </Button>
        </div>
        <p class="dg-counter">Click count: <strong>{clickCount}</strong></p>
      </div>

      <div class="dg-subsection">
        <h3 class="dg-subsection-title">With Icons</h3>
        <div class="flex flex-wrap gap-3 items-center">
          <Button variant="default" onclick={() => showToast('success', 'Copied!')}>
            <Copy class="size-4" />
            Copy
          </Button>
          <Button variant="outline">
            <Check class="size-4" />
            Confirm
          </Button>
          <Button variant="destructive">
            <XCircle class="size-4" />
            Delete
          </Button>
        </div>
      </div>
    </section>

    <Separator class="border-white/[0.06]" />

    <!-- 2. Badges -->
    <section class="dg-section">
      <h2 class="dg-section-title">Badges</h2>
      <p class="dg-section-desc">Badge component with multiple variants.</p>

      <div class="flex flex-wrap gap-3 items-center">
        {#each badgeVariants as { variant, label }}
          <Badge {variant}>{label}</Badge>
        {/each}
      </div>

      <div class="dg-subsection">
        <h3 class="dg-subsection-title">Colored Badges</h3>
        <div class="flex flex-wrap gap-3 items-center">
          <Badge class="bg-blue-500/15 text-blue-400 border-blue-500/20">Feature</Badge>
          <Badge class="bg-emerald-500/15 text-emerald-400 border-emerald-500/20">Shipped</Badge>
          <Badge class="bg-amber-500/15 text-amber-400 border-amber-500/20">In Progress</Badge>
          <Badge class="bg-red-500/15 text-red-400 border-red-500/20">Critical</Badge>
          <Badge class="bg-purple-500/15 text-purple-400 border-purple-500/20">Plugin</Badge>
          <Badge class="bg-cyan-500/15 text-cyan-400 border-cyan-500/20">Beta</Badge>
        </div>
      </div>
    </section>

    <Separator class="border-white/[0.06]" />

    <!-- 3. Status Badges -->
    <section class="dg-section">
      <h2 class="dg-section-title">Status Badges</h2>
      <p class="dg-section-desc">Contextual status indicators used across issues, agents, runs, and approvals.</p>

      <div class="flex flex-wrap gap-3 items-center">
        {#each statusValues as status}
          <StatusBadge {status} />
        {/each}
      </div>
    </section>

    <Separator class="border-white/[0.06]" />

    <!-- 4. Cards -->
    <section class="dg-section">
      <h2 class="dg-section-title">Cards</h2>
      <p class="dg-section-desc">Card compound component with header, content, and footer slots.</p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card class="rounded-xl border-white/[0.08] bg-[#0a0a0f]">
          <CardHeader>
            <CardTitle class="text-[#F8FAFC]">Agent Performance</CardTitle>
            <CardDescription class="text-[#64748b]">Overview of agent metrics for the past 7 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="flex items-baseline gap-2">
              <span class="text-3xl font-bold text-[#F8FAFC]">94.2%</span>
              <span class="text-sm text-emerald-400">+2.1%</span>
            </div>
            <p class="text-sm text-[#94A3B8] mt-1">Success rate across all runs</p>
          </CardContent>
          <CardFooter class="text-xs text-[#64748b]">
            Last updated 3 minutes ago
          </CardFooter>
        </Card>

        <Card class="rounded-xl border-white/[0.08] bg-[#0a0a0f]">
          <CardHeader>
            <CardTitle class="text-[#F8FAFC]">Active Issues</CardTitle>
            <CardDescription class="text-[#64748b]">Current open issues requiring attention.</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="space-y-2">
              {#each [{ title: 'Fix auth timeout', status: 'in_progress' }, { title: 'Update API docs', status: 'pending' }, { title: 'Deploy v2.3', status: 'approved' }] as issue}
                <div class="flex items-center justify-between py-1.5">
                  <span class="text-sm text-[#cbd5e1]">{issue.title}</span>
                  <StatusBadge status={issue.status} />
                </div>
              {/each}
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm" class="border-white/[0.08] text-[#94A3B8]">View All</Button>
          </CardFooter>
        </Card>
      </div>
    </section>

    <Separator class="border-white/[0.06]" />

    <!-- 5. Form Elements -->
    <section class="dg-section">
      <h2 class="dg-section-title">Form Elements</h2>
      <p class="dg-section-desc">Input, Textarea, Checkbox, and Select form controls.</p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
          <div class="space-y-2">
            <Label class="text-[#cbd5e1]">Text Input</Label>
            <Input
              bind:value={inputValue}
              placeholder="Type something..."
              class="border-white/[0.08] bg-[#121218] text-[#F8FAFC] placeholder:text-[#475569]"
            />
            {#if inputValue}
              <p class="text-xs text-[#94A3B8]">Value: "{inputValue}"</p>
            {/if}
          </div>

          <div class="space-y-2">
            <Label class="text-[#cbd5e1]">Disabled Input</Label>
            <Input
              value="Cannot edit this"
              disabled
              class="border-white/[0.08] bg-[#121218] text-[#F8FAFC]"
            />
          </div>

          <div class="space-y-2">
            <Label class="text-[#cbd5e1]">Select</Label>
            <select class="dg-select">
              <option value="">Choose an option...</option>
              <option value="agent">Agent</option>
              <option value="project">Project</option>
              <option value="routine">Routine</option>
            </select>
          </div>
        </div>

        <div class="space-y-4">
          <div class="space-y-2">
            <Label class="text-[#cbd5e1]">Textarea</Label>
            <Textarea
              bind:value={textareaValue}
              placeholder="Write a description..."
              rows={4}
              class="border-white/[0.08] bg-[#121218] text-[#F8FAFC] placeholder:text-[#475569] resize-y"
            />
          </div>

          <div class="flex items-center gap-3">
            <Checkbox
              checked={checkboxChecked}
              onCheckedChange={(v) => { checkboxChecked = !!v; }}
            />
            <Label class="text-[#cbd5e1] cursor-pointer" onclick={() => { checkboxChecked = !checkboxChecked; }}>
              {checkboxChecked ? "Checked" : "Unchecked"} — click to toggle
            </Label>
          </div>
        </div>
      </div>
    </section>

    <Separator class="border-white/[0.06]" />

    <!-- 6. Typography -->
    <section class="dg-section">
      <h2 class="dg-section-title">Typography</h2>
      <p class="dg-section-desc">Heading levels, body text, and code formatting.</p>

      <div class="space-y-4">
        <h1 class="text-4xl font-bold text-[#F8FAFC] tracking-tight">Heading 1 — The Quick Brown Fox</h1>
        <h2 class="text-3xl font-semibold text-[#F8FAFC] tracking-tight">Heading 2 — Agent Orchestration</h2>
        <h3 class="text-2xl font-semibold text-[#e2e8f0]">Heading 3 — Run Management</h3>
        <h4 class="text-xl font-medium text-[#cbd5e1]">Heading 4 — Configuration Details</h4>

        <Separator class="border-white/[0.06]" />

        <p class="text-base text-[#94A3B8] leading-relaxed max-w-2xl">
          Body text renders in the muted color for comfortable reading on dark backgrounds.
          ClawDev uses a carefully tuned palette that balances contrast and visual hierarchy
          across all interface elements.
        </p>

        <p class="text-sm text-[#64748b]">
          Secondary text is dimmer, used for descriptions, timestamps, and meta information.
        </p>

        <div class="space-y-2">
          <p class="text-sm text-[#cbd5e1]">
            Inline code: <code class="dg-code">{"const agent = new Agent({ model: 'claude-4' })"}</code>
          </p>
          <pre class="dg-pre"><code>{`async function runAgent(agentId: string) {
  const result = await api.runs.create({
    agentId,
    input: "Analyze the latest metrics",
    timeout: 30_000,
  });
  return result;
}`}</code></pre>
        </div>
      </div>
    </section>

    <Separator class="border-white/[0.06]" />

    <!-- 7. Colors -->
    <section class="dg-section">
      <h2 class="dg-section-title">Colors</h2>
      <p class="dg-section-desc">Core color palette used throughout ClawDev.</p>

      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {#each colors as color}
          <button
            class="dg-color-card group"
            onclick={() => {
              navigator.clipboard.writeText(color.hex);
              showToast('success', `Copied ${color.hex}`);
            }}
          >
            <div class="dg-color-swatch {color.class}"></div>
            <div class="px-3 py-2.5">
              <p class="text-sm font-medium text-[#F8FAFC]">{color.name}</p>
              <p class="text-xs text-[#64748b] font-mono group-hover:text-[#94A3B8] transition-colors">{color.hex}</p>
            </div>
          </button>
        {/each}
      </div>

      <div class="dg-subsection">
        <h3 class="dg-subsection-title">Surface Colors</h3>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {#each [
            { name: 'Base', bg: '#050508' },
            { name: 'Surface', bg: '#0a0a0f' },
            { name: 'Elevated', bg: '#121218' },
            { name: 'Border', bg: 'rgba(255,255,255,0.08)' },
          ] as surface}
            <div class="rounded-lg border border-white/[0.08] overflow-hidden">
              <div class="h-12" style:background={surface.bg}></div>
              <div class="px-3 py-2 bg-[#0a0a0f]">
                <p class="text-xs font-medium text-[#cbd5e1]">{surface.name}</p>
                <p class="text-[10px] text-[#64748b] font-mono">{surface.bg}</p>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </section>

    <Separator class="border-white/[0.06]" />

    <!-- 8. Toast Triggers -->
    <section class="dg-section">
      <h2 class="dg-section-title">Toasts</h2>
      <p class="dg-section-desc">Trigger notification toasts with different tones.</p>

      <div class="flex flex-wrap gap-3">
        <Button variant="outline" class="border-blue-500/30 text-blue-400 hover:bg-blue-500/10" onclick={() => showToast('info', 'Info notification')}>
          <Info class="size-4" />
          Info Toast
        </Button>
        <Button variant="outline" class="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" onclick={() => showToast('success', 'Success notification')}>
          <Check class="size-4" />
          Success Toast
        </Button>
        <Button variant="outline" class="border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onclick={() => showToast('warn', 'Warning notification')}>
          <AlertTriangle class="size-4" />
          Warning Toast
        </Button>
        <Button variant="outline" class="border-red-500/30 text-red-400 hover:bg-red-500/10" onclick={() => showToast('error', 'Error notification')}>
          <XCircle class="size-4" />
          Error Toast
        </Button>
      </div>
    </section>

    <!-- Skeleton Preview -->
    <Separator class="border-white/[0.06]" />

    <section class="dg-section">
      <h2 class="dg-section-title">Skeleton</h2>
      <p class="dg-section-desc">Loading placeholders for content that is being fetched.</p>

      <div class="flex items-center gap-4">
        <Skeleton class="h-12 w-12 rounded-full" />
        <div class="space-y-2 flex-1">
          <Skeleton class="h-4 w-3/4" />
          <Skeleton class="h-3 w-1/2" />
        </div>
      </div>
    </section>

    <div class="h-16"></div>
  </main>
</div>

<style>
  .design-guide {
    min-height: 100vh;
    background: #050508;
    color: #F8FAFC;
  }

  .dg-header {
    position: sticky;
    top: 0;
    z-index: 10;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(5, 5, 8, 0.85);
    backdrop-filter: blur(12px);
  }

  .dg-header-inner {
    max-width: 960px;
    margin: 0 auto;
    padding: 1rem 2rem;
  }

  .dg-main {
    max-width: 960px;
    margin: 0 auto;
    padding: 2rem;
  }

  .dg-section {
    padding: 2rem 0;
  }

  .dg-section-title {
    font-size: 1.375rem;
    font-weight: 700;
    color: #F8FAFC;
    margin: 0 0 0.375rem;
    letter-spacing: -0.01em;
  }

  .dg-section-desc {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0 0 1.5rem;
  }

  .dg-subsection {
    margin-top: 1.5rem;
  }

  .dg-subsection-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #94A3B8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 0.75rem;
  }

  .dg-counter {
    font-size: 0.8125rem;
    color: #64748b;
    margin-top: 0.75rem;
  }

  .dg-counter strong {
    color: #F8FAFC;
    font-variant-numeric: tabular-nums;
  }

  .dg-select {
    width: 100%;
    height: 40px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: #121218;
    color: #F8FAFC;
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    appearance: auto;
  }

  .dg-select:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }

  .dg-code {
    padding: 0.15em 0.4em;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.06);
    font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
    font-size: 0.8125em;
    color: #60a5fa;
  }

  .dg-pre {
    padding: 1rem 1.25rem;
    border-radius: 12px;
    background: #0a0a0f;
    border: 1px solid rgba(255, 255, 255, 0.06);
    overflow-x: auto;
    font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
    font-size: 0.8125rem;
    line-height: 1.7;
    color: #cbd5e1;
    margin: 0;
  }

  .dg-color-card {
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: #0a0a0f;
    overflow: hidden;
    cursor: pointer;
    transition: border-color 0.2s, transform 0.15s;
    text-align: left;
  }

  .dg-color-card:hover {
    border-color: rgba(255, 255, 255, 0.16);
    transform: translateY(-1px);
  }

  .dg-color-swatch {
    height: 56px;
    width: 100%;
  }

  @media (max-width: 640px) {
    .dg-header-inner,
    .dg-main {
      padding-left: 1rem;
      padding-right: 1rem;
    }
  }
</style>
