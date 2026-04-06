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

<div class="min-h-screen bg-[#050508] text-[#F8FAFC]">
  <!-- Header -->
  <header class="sticky top-0 z-10 border-b border-white/6 bg-[#050508]/85 backdrop-blur-xl">
    <div class="mx-auto max-w-[960px] px-8 py-4 max-sm:px-4">
      <div class="flex items-center gap-3">
        <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563EB]/15">
          <Zap class="size-5 text-[#60a5fa]" />
        </div>
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-[#F8FAFC]">Design Guide</h1>
          <p class="text-sm text-[#64748b]">ClawDev UI Components</p>
        </div>
      </div>
    </div>
  </header>

  <main class="mx-auto max-w-[960px] px-8 py-8 max-sm:px-4">
    <!-- 1. Buttons -->
    <section class="py-8">
      <h2 class="mb-1 text-[1.375rem] font-bold tracking-tight text-[#F8FAFC]">Buttons</h2>
      <p class="mb-6 text-sm text-[#64748b]">All button variants and sizes. Click any button to increment the counter.</p>

      <div class="mt-6">
        <h3 class="mb-3 text-[0.8125rem] font-semibold uppercase tracking-widest text-[#94A3B8]">Variants</h3>
        <div class="flex flex-wrap items-center gap-3">
          {#each buttonVariants as { variant, label }}
            <Button {variant} onclick={() => { clickCount++; showToast('info', `${label} button clicked (${clickCount})`); }}>
              {label}
            </Button>
          {/each}
        </div>
      </div>

      <div class="mt-6">
        <h3 class="mb-3 text-[0.8125rem] font-semibold uppercase tracking-widest text-[#94A3B8]">Sizes</h3>
        <div class="flex flex-wrap items-end gap-3">
          {#each buttonSizes as { size, label }}
            <Button {size} onclick={() => clickCount++}>
              {label}
            </Button>
          {/each}
          <Button size="icon" onclick={() => clickCount++}>
            <Zap class="size-4" />
          </Button>
        </div>
        <p class="mt-3 text-[0.8125rem] text-[#64748b]">Click count: <strong class="tabular-nums text-[#F8FAFC]">{clickCount}</strong></p>
      </div>

      <div class="mt-6">
        <h3 class="mb-3 text-[0.8125rem] font-semibold uppercase tracking-widest text-[#94A3B8]">With Icons</h3>
        <div class="flex flex-wrap items-center gap-3">
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
    <section class="py-8">
      <h2 class="mb-1 text-[1.375rem] font-bold tracking-tight text-[#F8FAFC]">Badges</h2>
      <p class="mb-6 text-sm text-[#64748b]">Badge component with multiple variants.</p>

      <div class="flex flex-wrap items-center gap-3">
        {#each badgeVariants as { variant, label }}
          <Badge {variant}>{label}</Badge>
        {/each}
      </div>

      <div class="mt-6">
        <h3 class="mb-3 text-[0.8125rem] font-semibold uppercase tracking-widest text-[#94A3B8]">Colored Badges</h3>
        <div class="flex flex-wrap items-center gap-3">
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
    <section class="py-8">
      <h2 class="mb-1 text-[1.375rem] font-bold tracking-tight text-[#F8FAFC]">Status Badges</h2>
      <p class="mb-6 text-sm text-[#64748b]">Contextual status indicators used across issues, agents, runs, and approvals.</p>

      <div class="flex flex-wrap items-center gap-3">
        {#each statusValues as status}
          <StatusBadge {status} />
        {/each}
      </div>
    </section>

    <Separator class="border-white/[0.06]" />

    <!-- 4. Cards -->
    <section class="py-8">
      <h2 class="mb-1 text-[1.375rem] font-bold tracking-tight text-[#F8FAFC]">Cards</h2>
      <p class="mb-6 text-sm text-[#64748b]">Card compound component with header, content, and footer slots.</p>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle class="text-[#F8FAFC]">Agent Performance</CardTitle>
            <CardDescription class="text-[#64748b]">Overview of agent metrics for the past 7 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="flex items-baseline gap-2">
              <span class="text-3xl font-bold text-[#F8FAFC]">94.2%</span>
              <span class="text-sm text-emerald-400">+2.1%</span>
            </div>
            <p class="mt-1 text-sm text-[#94A3B8]">Success rate across all runs</p>
          </CardContent>
          <CardFooter class="text-xs text-[#64748b]">
            Last updated 3 minutes ago
          </CardFooter>
        </Card>

        <Card>
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

      <div class="mt-6">
        <h3 class="mb-3 text-[0.8125rem] font-semibold uppercase tracking-widest text-[#94A3B8]">Card Surface</h3>
        <p class="mb-4 text-sm text-[#64748b]">The <code class="rounded-md border border-white/6 bg-white/6 px-1.5 py-0.5 font-mono text-[0.8125em] text-[#60a5fa]">Card</code> compound from the UI kit provides the standard elevated surface with border, background, and structured spacing.</p>
        <Card class="p-6">
          <p class="text-sm text-[#94A3B8]">This container uses the <code class="rounded-md border border-white/6 bg-white/6 px-1.5 py-0.5 font-mono text-[0.8125em] text-[#60a5fa]">Card</code> component. Hover to see the lift effect.</p>
        </Card>
      </div>
    </section>

    <Separator class="border-white/[0.06]" />

    <!-- 5. Form Elements -->
    <section class="py-8">
      <h2 class="mb-1 text-[1.375rem] font-bold tracking-tight text-[#F8FAFC]">Form Elements</h2>
      <p class="mb-6 text-sm text-[#64748b]">Input, Textarea, Checkbox, and Select form controls.</p>

      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
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
            <select class="h-10 w-full rounded-lg border border-white/8 bg-[#121218] px-3 text-sm text-[#F8FAFC] outline-none transition-all focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15">
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
    <section class="py-8">
      <h2 class="mb-1 text-[1.375rem] font-bold tracking-tight text-[#F8FAFC]">Typography</h2>
      <p class="mb-6 text-sm text-[#64748b]">Heading levels, body text, and code formatting.</p>

      <div class="space-y-4">
        <h1 class="text-4xl font-bold tracking-tight text-[#F8FAFC]">Heading 1 — The Quick Brown Fox</h1>
        <h2 class="text-3xl font-semibold tracking-tight text-[#F8FAFC]">Heading 2 — Agent Orchestration</h2>
        <h3 class="text-2xl font-semibold text-[#e2e8f0]">Heading 3 — Run Management</h3>
        <h4 class="text-xl font-medium text-[#cbd5e1]">Heading 4 — Configuration Details</h4>

        <Separator class="border-white/[0.06]" />

        <p class="max-w-2xl text-base leading-relaxed text-[#94A3B8]">
          Body text renders in the muted color for comfortable reading on dark backgrounds.
          ClawDev uses a carefully tuned palette that balances contrast and visual hierarchy
          across all interface elements.
        </p>

        <p class="text-sm text-[#64748b]">
          Secondary text is dimmer, used for descriptions, timestamps, and meta information.
        </p>

        <div class="space-y-2">
          <p class="text-sm text-[#cbd5e1]">
            Inline code: <code class="rounded-md border border-white/6 bg-white/6 px-1.5 py-0.5 font-mono text-[0.8125em] text-[#60a5fa]">{"const agent = new Agent({ model: 'claude-4' })"}</code>
          </p>
          <pre class="overflow-x-auto rounded-xl border border-white/6 bg-[#0a0a0f] px-5 py-4 font-mono text-[0.8125rem] leading-[1.7] text-[#cbd5e1]"><code>{`async function runAgent(agentId: string) {
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
    <section class="py-8">
      <h2 class="mb-1 text-[1.375rem] font-bold tracking-tight text-[#F8FAFC]">Colors</h2>
      <p class="mb-6 text-sm text-[#64748b]">Core color palette used throughout ClawDev.</p>

      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        {#each colors as color}
          <button
            class="group cursor-pointer overflow-hidden text-left"
            onclick={() => {
              navigator.clipboard.writeText(color.hex);
              showToast('success', `Copied ${color.hex}`);
            }}
          >
            <div class="h-14 w-full {color.class}"></div>
            <div class="px-3 py-2.5">
              <p class="text-sm font-medium text-[#F8FAFC]">{color.name}</p>
              <p class="font-mono text-xs text-[#64748b] transition-colors group-hover:text-[#94A3B8]">{color.hex}</p>
            </div>
          </button>
        {/each}
      </div>

      <div class="mt-6">
        <h3 class="mb-3 text-[0.8125rem] font-semibold uppercase tracking-widest text-[#94A3B8]">Surface Colors</h3>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {#each [
            { name: 'Base', bg: '#050508' },
            { name: 'Surface', bg: '#0a0a0f' },
            { name: 'Elevated', bg: '#121218' },
            { name: 'Border', bg: 'rgba(255,255,255,0.08)' },
          ] as surface}
            <div class="overflow-hidden rounded-lg border border-white/8">
              <div class="h-12" style:background={surface.bg}></div>
              <div class="bg-[#0a0a0f] px-3 py-2">
                <p class="text-xs font-medium text-[#cbd5e1]">{surface.name}</p>
                <p class="font-mono text-[10px] text-[#64748b]">{surface.bg}</p>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </section>

    <Separator class="border-white/[0.06]" />

    <!-- 8. Toast Triggers -->
    <section class="py-8">
      <h2 class="mb-1 text-[1.375rem] font-bold tracking-tight text-[#F8FAFC]">Toasts</h2>
      <p class="mb-6 text-sm text-[#64748b]">Trigger notification toasts with different tones.</p>

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

    <Separator class="border-white/[0.06]" />

    <!-- Skeleton Preview -->
    <section class="py-8">
      <h2 class="mb-1 text-[1.375rem] font-bold tracking-tight text-[#F8FAFC]">Skeleton</h2>
      <p class="mb-6 text-sm text-[#64748b]">Loading placeholders for content that is being fetched.</p>

      <div class="flex items-center gap-4">
        <Skeleton class="h-12 w-12 rounded-full" />
        <div class="flex-1 space-y-2">
          <Skeleton class="h-4 w-3/4" />
          <Skeleton class="h-3 w-1/2" />
        </div>
      </div>
    </section>

    <div class="h-16"></div>
  </main>
</div>
