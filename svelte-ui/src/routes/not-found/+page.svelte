<script lang="ts">
  import { goto } from "$app/navigation";
  import { ArrowLeft, Home } from "lucide-svelte";
</script>

<div class="not-found-page">
  <div class="not-found-bg"></div>

  <div class="not-found-content">
    <span class="not-found-code">404</span>

    <h1 class="not-found-heading">Page Not Found</h1>

    <p class="not-found-description">
      The page you're looking for doesn't exist or has been moved.
    </p>

    <div class="not-found-actions">
      <button class="not-found-btn primary" onclick={() => goto('/')}>
        <Home size={16} />
        Go to Dashboard
      </button>
      <button class="not-found-btn secondary" onclick={() => history.back()}>
        <ArrowLeft size={16} />
        Go Back
      </button>
    </div>
  </div>
</div>

<style>
  .not-found-page {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    width: 100%;
    background: #050508;
    position: relative;
    overflow: hidden;
  }

  .not-found-bg {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 50% 40% at 50% 50%, rgba(37, 99, 235, 0.06) 0%, transparent 70%),
      radial-gradient(ellipse 30% 30% at 60% 60%, rgba(239, 68, 68, 0.03) 0%, transparent 60%);
    pointer-events: none;
  }

  .not-found-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 2rem;
    max-width: 480px;
  }

  .not-found-code {
    font-size: 8rem;
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.04em;
    background: linear-gradient(135deg, #2563eb 0%, #60a5fa 50%, #1e40af 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 1rem;
    user-select: none;
  }

  .not-found-heading {
    font-size: 1.75rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0 0 0.75rem;
    letter-spacing: -0.01em;
  }

  .not-found-description {
    font-size: 1rem;
    line-height: 1.6;
    color: #64748b;
    margin: 0 0 2.5rem;
  }

  .not-found-actions {
    display: flex;
    gap: 0.75rem;
  }

  .not-found-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border-radius: 10px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s, transform 0.1s;
    border: none;
  }

  .not-found-btn:active {
    transform: scale(0.98);
  }

  .not-found-btn.primary {
    background: #ffffff;
    color: #0a0a0f;
  }

  .not-found-btn.primary:hover {
    background: #f1f5f9;
  }

  .not-found-btn.secondary {
    background: rgba(255, 255, 255, 0.06);
    color: #cbd5e1;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .not-found-btn.secondary:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.14);
    color: #f8fafc;
  }

  @media (max-width: 480px) {
    .not-found-code {
      font-size: 5rem;
    }

    .not-found-heading {
      font-size: 1.375rem;
    }

    .not-found-actions {
      flex-direction: column;
      width: 100%;
    }

    .not-found-btn {
      justify-content: center;
      width: 100%;
    }
  }
</style>
