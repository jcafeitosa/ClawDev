<script lang="ts">
  import { Badge, Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/index.js';
  import { Box, GitBranch, FolderOpen, ArrowRight, MonitorCog } from 'lucide-svelte';

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------
  interface Props {
    workspace: any;
    prefix: string;
  }

  let { workspace, prefix }: Props = $props();

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  let hasWorkspace = $derived(!!workspace && !!workspace.id);

  let statusColor = $derived.by(() => {
    if (!workspace?.status) return 'bg-zinc-500/15 text-zinc-400';
    const map: Record<string, string> = {
      active: 'bg-emerald-500/15 text-emerald-400',
      running: 'bg-emerald-500/15 text-emerald-400',
      ready: 'bg-blue-500/15 text-blue-400',
      provisioning: 'bg-amber-500/15 text-amber-400',
      stopped: 'bg-zinc-500/15 text-zinc-400',
      error: 'bg-red-500/15 text-red-400',
      failed: 'bg-red-500/15 text-red-400',
    };
    return map[workspace.status] ?? 'bg-zinc-500/15 text-zinc-400';
  });

  let modeLabel = $derived.by(() => {
    if (!workspace?.mode) return null;
    const map: Record<string, string> = {
      shared: 'Shared',
      isolated: 'Isolated',
      exclusive: 'Exclusive',
    };
    return map[workspace.mode] ?? workspace.mode;
  });

  let strategyLabel = $derived.by(() => {
    if (!workspace?.strategy) return null;
    const map: Record<string, string> = {
      git_worktree: 'Git Worktree',
      docker: 'Docker',
      local: 'Local',
      remote: 'Remote',
    };
    return map[workspace.strategy] ?? workspace.strategy;
  });
</script>

<Card>
  <CardHeader>
    <div class="flex items-center justify-between w-full">
      <div class="flex items-center gap-2">
        <Box class="size-4 text-zinc-400" />
        <CardTitle>Execution Workspace</CardTitle>
      </div>
      {#if hasWorkspace}
        <a
          href="/{prefix}/workspaces/{workspace.id}"
          class="inline-flex items-center gap-1 text-xs font-medium text-[hsl(var(--primary))] hover:underline"
        >
          View
          <ArrowRight class="size-3" />
        </a>
      {/if}
    </div>
  </CardHeader>
  <CardContent>
    {#if hasWorkspace}
      <div class="space-y-3">
        <!-- Status + mode + strategy row -->
        <div class="flex flex-wrap items-center gap-2">
          <span class="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize {statusColor}">
            {workspace.status ?? 'unknown'}
          </span>
          {#if modeLabel}
            <Badge variant="outline" class="text-[11px]">{modeLabel}</Badge>
          {/if}
          {#if strategyLabel}
            <Badge variant="outline" class="text-[11px]">
              <MonitorCog class="size-3 mr-1" />
              {strategyLabel}
            </Badge>
          {/if}
        </div>

        <!-- Branch -->
        {#if workspace.branch}
          <div class="flex items-center gap-2 text-sm">
            <GitBranch class="size-3.5 text-zinc-400 shrink-0" />
            <code class="text-xs font-mono text-zinc-300 truncate">{workspace.branch}</code>
          </div>
        {/if}

        <!-- CWD path -->
        {#if workspace.cwd ?? workspace.path ?? workspace.workingDirectory}
          <div class="flex items-center gap-2 text-sm">
            <FolderOpen class="size-3.5 text-zinc-400 shrink-0" />
            <code class="text-xs font-mono text-zinc-400 truncate">{workspace.cwd ?? workspace.path ?? workspace.workingDirectory}</code>
          </div>
        {/if}
      </div>
    {:else}
      <div class="flex items-center gap-3 py-2">
        <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-500/10">
          <Box class="size-4 text-zinc-500" />
        </div>
        <p class="text-sm text-zinc-500 dark:text-zinc-400 italic">No workspace assigned</p>
      </div>
    {/if}
  </CardContent>
</Card>
