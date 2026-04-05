<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { ArrowLeft, Home } from "lucide-svelte";

  let status = $derived($page.status);
  let message = $derived($page.error?.message ?? "Something went wrong");

  let isNotFound = $derived(status === 404);
</script>

<div class="flex min-h-screen w-full items-center justify-center bg-[#050508] relative overflow-hidden">
  <!-- Ambient glow -->
  <div
    class="pointer-events-none absolute inset-0"
    style="background: radial-gradient(ellipse 50% 40% at 50% 50%, rgba(37,99,235,0.06) 0%, transparent 70%), radial-gradient(ellipse 30% 30% at 60% 60%, rgba(239,68,68,0.03) 0%, transparent 60%);"
  ></div>

  <div class="relative z-10 flex max-w-[480px] flex-col items-center px-8 text-center">
    <span
      class="mb-4 text-[8rem] font-extrabold leading-none tracking-tighter select-none
        bg-gradient-to-br from-[#2563eb] via-[#60a5fa] to-[#1e40af] bg-clip-text text-transparent
        max-sm:text-[5rem]"
    >
      {status}
    </span>

    <h1 class="mb-3 text-[1.75rem] font-bold tracking-tight text-[#f8fafc] max-sm:text-[1.375rem]">
      {isNotFound ? "Page Not Found" : "Something Went Wrong"}
    </h1>

    <p class="mb-10 text-base leading-relaxed text-[#64748b]">
      {isNotFound
        ? "The page you're looking for doesn't exist or has been moved."
        : message}
    </p>

    <div class="flex gap-3 max-sm:w-full max-sm:flex-col">
      <button
        class="inline-flex items-center justify-center gap-2 rounded-[10px] bg-white px-5 py-2.5 text-sm font-semibold text-[#0a0a0f] transition-colors hover:bg-[#f1f5f9] active:scale-[0.98] cursor-pointer"
        onclick={() => goto("/")}
      >
        <Home size={16} />
        Go to Dashboard
      </button>
      <button
        class="inline-flex items-center justify-center gap-2 rounded-[10px] border border-white/8 bg-white/6 px-5 py-2.5 text-sm font-semibold text-[#cbd5e1] transition-colors hover:border-white/14 hover:bg-white/10 hover:text-[#f8fafc] active:scale-[0.98] cursor-pointer"
        onclick={() => history.back()}
      >
        <ArrowLeft size={16} />
        Go Back
      </button>
    </div>
  </div>
</div>
