<script lang="ts">
  /**
   * AgentConfigForm — comprehensive agent configuration form that adapts
   * its fields based on the selected adapter type.
   *
   * Usage:
   *   <AgentConfigForm adapterType="claude_local" bind:config mode="create" />
   */
  import {
    FolderOpen,
    ChevronDown,
    Info,
    Terminal,
    Settings,
    ShieldAlert,
  } from "lucide-svelte";

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------
  interface Props {
    adapterType: string;
    config: Record<string, any>;
    mode: "create" | "edit";
  }

  let { adapterType, config = $bindable({}), mode }: Props = $props();

  // ---------------------------------------------------------------------------
  // Adapter metadata
  // ---------------------------------------------------------------------------
  const LOCAL_ADAPTERS = [
    "claude_local",
    "codex_local",
    "cursor",
    "gemini_local",
    "pi_local",
    "opencode_local",
  ];

  const isLocal = $derived(LOCAL_ADAPTERS.includes(adapterType));

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function ensure(key: string, fallback: any = ""): void {
    if (config[key] === undefined) config[key] = fallback;
  }

  function setField(key: string, value: any): void {
    config[key] = value;
    config = config; // trigger reactivity
  }

  function toggleField(key: string): void {
    config[key] = !config[key];
    config = config;
  }

  // Initialize defaults when adapter changes
  $effect(() => {
    void adapterType;
    initDefaults();
  });

  function initDefaults(): void {
    switch (adapterType) {
      case "claude_local":
        ensure("cwd");
        ensure("model", "claude-sonnet-4-6");
        ensure("effort", "medium");
        ensure("maxTurnsPerRun", 25);
        ensure("dangerouslySkipPermissions", false);
        ensure("instructionsFilePath");
        break;
      case "codex_local":
        ensure("cwd");
        ensure("model", "gpt-5.3-codex");
        ensure("modelReasoningEffort", "medium");
        ensure("search", false);
        ensure("dangerouslyBypassApprovalsAndSandbox", false);
        break;
      case "cursor":
        ensure("cwd");
        ensure("model", "auto");
        ensure("mode", "plan");
        break;
      case "gemini_local":
        ensure("cwd");
        ensure("model", "gemini-2.5-pro");
        ensure("sandbox", false);
        break;
      case "pi_local":
        ensure("cwd");
        ensure("model");
        ensure("thinking", "medium");
        break;
      case "opencode_local":
        ensure("cwd");
        break;
      case "openclaw_gateway":
        ensure("url", "wss://");
        ensure("authToken");
        ensure("sessionKeyStrategy", "issue");
        break;
      case "process":
        ensure("command");
        ensure("args", "");
        ensure("cwd");
        break;
      case "http":
        ensure("url", "https://");
        ensure("method", "POST");
        ensure("headers", "{}");
        break;
    }

    // Common fields for local adapters
    if (isLocal) {
      ensure("instructionsFilePath");
      ensure("promptTemplate");
    }
  }

  // ---------------------------------------------------------------------------
  // CSS helpers
  // ---------------------------------------------------------------------------
  const inputCls =
    "w-full rounded-lg border border-white/[0.08] bg-[#0A0A0F] px-3.5 py-2.5 text-sm text-[#F8FAFC] placeholder:text-[#475569] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/30 transition";
  const selectCls =
    "w-full appearance-none rounded-lg border border-white/[0.08] bg-[#0A0A0F] px-3.5 py-2.5 pr-9 text-sm text-[#F8FAFC] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/30 transition cursor-pointer";
  const labelCls = "block text-sm font-medium text-[#CBD5E1]";
  const helpCls = "mt-1 text-xs text-[#64748B]";
  const sectionHeadingCls =
    "flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#64748B] border-b border-white/[0.06] pb-2 mb-4";
</script>

<div class="space-y-8">
  <!-- ===================================================================== -->
  <!-- SECTION: Adapter Settings                                              -->
  <!-- ===================================================================== -->
  <section>
    <div class={sectionHeadingCls}>
      <Terminal class="size-3.5" />
      <span>Adapter Settings</span>
    </div>

    <div class="space-y-5">
      <!-- claude_local -->
      {#if adapterType === "claude_local"}
        <div>
          <label for="cfg-model" class={labelCls}>Model</label>
          <div class="relative mt-1.5">
            <select
              id="cfg-model"
              class={selectCls}
              value={config.model ?? "claude-sonnet-4-6"}
              onchange={(e) => setField("model", e.currentTarget.value)}
            >
              <option value="claude-opus-4-6">Claude Opus 4.6</option>
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
              <option value="claude-haiku-4-5">Claude Haiku 4.5</option>
            </select>
            <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#64748B]" />
          </div>
          <p class={helpCls}>The Anthropic model to use for this agent.</p>
        </div>

        <div>
          <label for="cfg-effort" class={labelCls}>Effort</label>
          <div class="relative mt-1.5">
            <select
              id="cfg-effort"
              class={selectCls}
              value={config.effort ?? "medium"}
              onchange={(e) => setField("effort", e.currentTarget.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#64748B]" />
          </div>
          <p class={helpCls}>Controls reasoning depth. Higher effort uses more tokens.</p>
        </div>

        <div>
          <label for="cfg-maxTurns" class={labelCls}>Max Turns Per Run</label>
          <input
            id="cfg-maxTurns"
            type="number"
            min="1"
            max="500"
            class="{inputCls} mt-1.5"
            value={config.maxTurnsPerRun ?? 25}
            oninput={(e) => setField("maxTurnsPerRun", parseInt(e.currentTarget.value) || 25)}
          />
          <p class={helpCls}>Maximum number of tool-use turns before the agent stops.</p>
        </div>

      <!-- codex_local -->
      {:else if adapterType === "codex_local"}
        <div>
          <label for="cfg-model" class={labelCls}>Model</label>
          <div class="relative mt-1.5">
            <select
              id="cfg-model"
              class={selectCls}
              value={config.model ?? "gpt-5.3-codex"}
              onchange={(e) => setField("model", e.currentTarget.value)}
            >
              <option value="gpt-5.4">GPT-5.4</option>
              <option value="gpt-5.3-codex">GPT-5.3 Codex</option>
              <option value="o3">o3</option>
              <option value="o4-mini">o4-mini</option>
            </select>
            <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#64748B]" />
          </div>
          <p class={helpCls}>The OpenAI model to use for code generation.</p>
        </div>

        <div>
          <label for="cfg-reasoning" class={labelCls}>Model Reasoning Effort</label>
          <div class="relative mt-1.5">
            <select
              id="cfg-reasoning"
              class={selectCls}
              value={config.modelReasoningEffort ?? "medium"}
              onchange={(e) => setField("modelReasoningEffort", e.currentTarget.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#64748B]" />
          </div>
          <p class={helpCls}>Controls how much reasoning the model applies.</p>
        </div>

        <div class="flex items-center justify-between rounded-lg border border-white/[0.08] bg-[#0A0A0F] px-4 py-3">
          <div>
            <span class="text-sm font-medium text-[#CBD5E1]">Web Search</span>
            <p class="text-xs text-[#64748B] mt-0.5">Allow the agent to search the web for context.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={config.search ?? false}
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 {config.search ? 'bg-[#2563EB]' : 'bg-white/[0.12]'}"
            onclick={() => toggleField("search")}
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 {config.search ? 'translate-x-5' : 'translate-x-0'}"
            ></span>
          </button>
        </div>

      <!-- cursor -->
      {:else if adapterType === "cursor"}
        <div>
          <label for="cfg-model" class={labelCls}>Model</label>
          <input
            id="cfg-model"
            type="text"
            class="{inputCls} mt-1.5"
            value={config.model ?? "auto"}
            oninput={(e) => setField("model", e.currentTarget.value)}
            placeholder="auto"
          />
          <p class={helpCls}>Model identifier. Use "auto" for Cursor's default selection.</p>
        </div>

        <div>
          <label for="cfg-mode" class={labelCls}>Mode</label>
          <div class="relative mt-1.5">
            <select
              id="cfg-mode"
              class={selectCls}
              value={config.mode ?? "plan"}
              onchange={(e) => setField("mode", e.currentTarget.value)}
            >
              <option value="plan">Plan</option>
              <option value="ask">Ask</option>
            </select>
            <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#64748B]" />
          </div>
          <p class={helpCls}>Plan mode generates a plan before executing; Ask mode is conversational.</p>
        </div>

      <!-- gemini_local -->
      {:else if adapterType === "gemini_local"}
        <div>
          <label for="cfg-model" class={labelCls}>Model</label>
          <div class="relative mt-1.5">
            <select
              id="cfg-model"
              class={selectCls}
              value={config.model ?? "gemini-2.5-pro"}
              onchange={(e) => setField("model", e.currentTarget.value)}
            >
              <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
            </select>
            <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#64748B]" />
          </div>
          <p class={helpCls}>The Google Gemini model to use.</p>
        </div>

        <div class="flex items-center justify-between rounded-lg border border-white/[0.08] bg-[#0A0A0F] px-4 py-3">
          <div>
            <span class="text-sm font-medium text-[#CBD5E1]">Sandbox</span>
            <p class="text-xs text-[#64748B] mt-0.5">Run in an isolated sandbox environment.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={config.sandbox ?? false}
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 {config.sandbox ? 'bg-[#2563EB]' : 'bg-white/[0.12]'}"
            onclick={() => toggleField("sandbox")}
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 {config.sandbox ? 'translate-x-5' : 'translate-x-0'}"
            ></span>
          </button>
        </div>

      <!-- pi_local -->
      {:else if adapterType === "pi_local"}
        <div>
          <label for="cfg-model" class={labelCls}>
            Model
            <span class="ml-1 text-red-400">*</span>
          </label>
          <input
            id="cfg-model"
            type="text"
            class="{inputCls} mt-1.5"
            value={config.model ?? ""}
            oninput={(e) => setField("model", e.currentTarget.value)}
            placeholder="provider/model (e.g. openai/gpt-5.4)"
            required
          />
          <p class={helpCls}>Format: provider/model. This field is required for Pi adapters.</p>
        </div>

        <div>
          <label for="cfg-thinking" class={labelCls}>Thinking Level</label>
          <div class="relative mt-1.5">
            <select
              id="cfg-thinking"
              class={selectCls}
              value={config.thinking ?? "medium"}
              onchange={(e) => setField("thinking", e.currentTarget.value)}
            >
              <option value="off">Off</option>
              <option value="minimal">Minimal</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="xhigh">Extra High</option>
            </select>
            <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#64748B]" />
          </div>
          <p class={helpCls}>Controls the depth of chain-of-thought reasoning.</p>
        </div>

      <!-- openclaw_gateway -->
      {:else if adapterType === "openclaw_gateway"}
        <div>
          <label for="cfg-url" class={labelCls}>Gateway URL</label>
          <input
            id="cfg-url"
            type="text"
            class="{inputCls} mt-1.5"
            value={config.url ?? "wss://"}
            oninput={(e) => setField("url", e.currentTarget.value)}
            placeholder="wss://gateway.example.com"
          />
          <p class={helpCls}>WebSocket URL (ws:// or wss://) of the OpenClaw gateway.</p>
        </div>

        <div>
          <label for="cfg-authToken" class={labelCls}>Auth Token</label>
          <input
            id="cfg-authToken"
            type="password"
            class="{inputCls} mt-1.5"
            value={config.authToken ?? ""}
            oninput={(e) => setField("authToken", e.currentTarget.value)}
            placeholder="Bearer token or API key"
            autocomplete="off"
          />
          <p class={helpCls}>Authentication token for the gateway connection.</p>
        </div>

        <div>
          <label for="cfg-sessionKey" class={labelCls}>Session Key Strategy</label>
          <div class="relative mt-1.5">
            <select
              id="cfg-sessionKey"
              class={selectCls}
              value={config.sessionKeyStrategy ?? "issue"}
              onchange={(e) => setField("sessionKeyStrategy", e.currentTarget.value)}
            >
              <option value="issue">Per Issue</option>
              <option value="fixed">Fixed</option>
              <option value="run">Per Run</option>
            </select>
            <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#64748B]" />
          </div>
          <p class={helpCls}>How session keys are generated: per issue, fixed, or per run.</p>
        </div>

      <!-- process -->
      {:else if adapterType === "process"}
        <div>
          <label for="cfg-command" class={labelCls}>Command</label>
          <input
            id="cfg-command"
            type="text"
            class="{inputCls} mt-1.5"
            value={config.command ?? ""}
            oninput={(e) => setField("command", e.currentTarget.value)}
            placeholder="e.g. /usr/bin/python3"
          />
          <p class={helpCls}>Executable path or command to run.</p>
        </div>

        <div>
          <label for="cfg-args" class={labelCls}>Arguments</label>
          <input
            id="cfg-args"
            type="text"
            class="{inputCls} mt-1.5"
            value={config.args ?? ""}
            oninput={(e) => setField("args", e.currentTarget.value)}
            placeholder="arg1, arg2, --flag"
          />
          <p class={helpCls}>Comma-separated list of command arguments.</p>
        </div>

        <div>
          <label for="cfg-cwd-process" class={labelCls}>Working Directory</label>
          <div class="relative mt-1.5">
            <FolderOpen class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#64748B]" />
            <input
              id="cfg-cwd-process"
              type="text"
              class="{inputCls} pl-9"
              value={config.cwd ?? ""}
              oninput={(e) => setField("cwd", e.currentTarget.value)}
              placeholder="/path/to/workspace"
            />
          </div>
          <p class={helpCls}>The directory where the process will execute.</p>
        </div>

      <!-- http -->
      {:else if adapterType === "http"}
        <div>
          <label for="cfg-url" class={labelCls}>Endpoint URL</label>
          <input
            id="cfg-url"
            type="text"
            class="{inputCls} mt-1.5"
            value={config.url ?? "https://"}
            oninput={(e) => setField("url", e.currentTarget.value)}
            placeholder="https://api.example.com/agent"
          />
          <p class={helpCls}>The HTTP endpoint the agent will call.</p>
        </div>

        <div>
          <label for="cfg-method" class={labelCls}>HTTP Method</label>
          <div class="relative mt-1.5">
            <select
              id="cfg-method"
              class={selectCls}
              value={config.method ?? "POST"}
              onchange={(e) => setField("method", e.currentTarget.value)}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
            <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#64748B]" />
          </div>
        </div>

        <div>
          <label for="cfg-headers" class={labelCls}>Headers (JSON)</label>
          <textarea
            id="cfg-headers"
            rows={4}
            class="{inputCls} mt-1.5 font-mono text-xs"
            value={config.headers ?? "{}"}
            oninput={(e) => setField("headers", e.currentTarget.value)}
            placeholder='{"Authorization": "Bearer ..."}'
            spellcheck="false"
          ></textarea>
          <p class={helpCls}>Custom HTTP headers as a JSON object.</p>
        </div>
      {/if}
    </div>
  </section>

  <!-- ===================================================================== -->
  <!-- SECTION: Execution (local adapters only)                               -->
  <!-- ===================================================================== -->
  {#if isLocal}
    <section>
      <div class={sectionHeadingCls}>
        <Settings class="size-3.5" />
        <span>Execution</span>
      </div>

      <div class="space-y-5">
        <div>
          <label for="cfg-cwd" class={labelCls}>Working Directory</label>
          <div class="relative mt-1.5">
            <FolderOpen class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#64748B]" />
            <input
              id="cfg-cwd"
              type="text"
              class="{inputCls} pl-9"
              value={config.cwd ?? ""}
              oninput={(e) => setField("cwd", e.currentTarget.value)}
              placeholder="/path/to/project"
            />
          </div>
          <p class={helpCls}>Absolute path to the project directory where the agent will operate.</p>
        </div>

        <div>
          <label for="cfg-instructions" class={labelCls}>Instructions File Path</label>
          <input
            id="cfg-instructions"
            type="text"
            class="{inputCls} mt-1.5"
            value={config.instructionsFilePath ?? ""}
            oninput={(e) => setField("instructionsFilePath", e.currentTarget.value)}
            placeholder=".clawdev/instructions.md"
          />
          <p class={helpCls}>Relative path to a file containing additional agent instructions.</p>
        </div>

        <div>
          <label for="cfg-prompt" class={labelCls}>Prompt Template</label>
          <textarea
            id="cfg-prompt"
            rows={5}
            class="{inputCls} mt-1.5 font-mono text-xs"
            value={config.promptTemplate ?? ""}
            oninput={(e) => setField("promptTemplate", e.currentTarget.value)}
            placeholder="You are an agent working on {{issue.title}}..."
            spellcheck="false"
          ></textarea>
          <p class={helpCls}>
            Template for the prompt sent to the agent. Supports
            <code class="rounded bg-white/[0.06] px-1 py-0.5 text-[11px] text-[#94A3B8]">{"{{issue.title}}"}</code>
            placeholders.
          </p>
        </div>
      </div>
    </section>
  {/if}

  <!-- ===================================================================== -->
  <!-- SECTION: Advanced (danger zone toggles)                                -->
  <!-- ===================================================================== -->
  {#if adapterType === "claude_local" || adapterType === "codex_local"}
    <section>
      <div class={sectionHeadingCls}>
        <ShieldAlert class="size-3.5 text-amber-500" />
        <span class="text-amber-500/80">Advanced</span>
      </div>

      <div class="space-y-4">
        {#if adapterType === "claude_local"}
          <div class="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3">
            <div>
              <span class="text-sm font-medium text-[#CBD5E1]">Skip Permissions</span>
              <p class="text-xs text-[#64748B] mt-0.5">
                Dangerously skip all permission prompts. Use with extreme caution.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={config.dangerouslySkipPermissions ?? false}
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 {config.dangerouslySkipPermissions ? 'bg-amber-500' : 'bg-white/[0.12]'}"
              onclick={() => toggleField("dangerouslySkipPermissions")}
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 {config.dangerouslySkipPermissions ? 'translate-x-5' : 'translate-x-0'}"
              ></span>
            </button>
          </div>
        {/if}

        {#if adapterType === "codex_local"}
          <div class="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3">
            <div>
              <span class="text-sm font-medium text-[#CBD5E1]">Bypass Approvals & Sandbox</span>
              <p class="text-xs text-[#64748B] mt-0.5">
                Dangerously bypass all approval gates and sandbox restrictions.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={config.dangerouslyBypassApprovalsAndSandbox ?? false}
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 {config.dangerouslyBypassApprovalsAndSandbox ? 'bg-amber-500' : 'bg-white/[0.12]'}"
              onclick={() => toggleField("dangerouslyBypassApprovalsAndSandbox")}
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 {config.dangerouslyBypassApprovalsAndSandbox ? 'translate-x-5' : 'translate-x-0'}"
              ></span>
            </button>
          </div>
        {/if}

        <div class="flex items-start gap-2 rounded-lg border border-amber-500/10 bg-amber-500/[0.03] px-4 py-3">
          <Info class="size-4 shrink-0 text-amber-500/70 mt-0.5" />
          <p class="text-xs text-amber-500/60 leading-relaxed">
            These settings disable safety mechanisms. Only enable them in trusted, isolated environments
            where the agent has been thoroughly tested.
          </p>
        </div>
      </div>
    </section>
  {/if}
</div>
