<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  interface Props {
    gridCols?: number;
    gridRows?: number;
    maxElevation?: number;
    motionSensitivity?: number;
    elevationSmoothing?: number;
    colorMode?: "webcam" | "monochrome";
    monochromeColor?: string;
    backgroundColor?: string;
    mirror?: boolean;
    gapRatio?: number;
    invertColors?: boolean;
    darken?: number;
    borderColor?: string;
    borderOpacity?: number;
    className?: string;
    onWebcamError?: (error: Error) => void;
    onWebcamReady?: () => void;
  }

  let {
    gridCols = 64,
    gridRows = 48,
    maxElevation = 15,
    motionSensitivity = 0.4,
    elevationSmoothing = 0.1,
    colorMode = "webcam" as "webcam" | "monochrome",
    monochromeColor = "#00ff88",
    backgroundColor = "#0a0a0a",
    mirror = true,
    gapRatio = 0.1,
    invertColors = false,
    darken = 0,
    borderColor = "#ffffff",
    borderOpacity = 0.08,
    className = "",
    onWebcamError = undefined as ((error: Error) => void) | undefined,
    onWebcamReady = undefined as (() => void) | undefined,
  }: Props = $props();

  type PixelData = {
    r: number;
    g: number;
    b: number;
    motion: number;
    targetElevation: number;
    currentElevation: number;
  };

  let videoEl: HTMLVideoElement;
  let processingCanvas: HTMLCanvasElement;
  let displayCanvas: HTMLCanvasElement;
  let previousFrame: Uint8ClampedArray | null = null;
  let pixels: PixelData[][] = [];
  let animationId = 0;
  let stream: MediaStream | null = null;
  let isReady = $state(false);
  let error = $state<string | null>(null);
  let showErrorPopup = $state(true);

  function parseHexColor(hex: string) {
    const h = hex.replace("#", "");
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  $effect(() => {
    pixels = Array.from({ length: gridRows }, () =>
      Array.from({ length: gridCols }, () => ({
        r: 30, g: 30, b: 30,
        motion: 0,
        targetElevation: 0,
        currentElevation: 0,
      }))
    );
  });

  async function requestCameraAccess() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
      if (videoEl) {
        videoEl.srcObject = stream;
        await videoEl.play();
        isReady = true;
        error = null;
        showErrorPopup = false;
        onWebcamReady?.();
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Webcam access denied");
      error = e.message;
      onWebcamError?.(e);
    }
  }

  function render() {
    if (!videoEl || !processingCanvas || !displayCanvas || videoEl.readyState < 2) {
      animationId = requestAnimationFrame(render);
      return;
    }

    const procCtx = processingCanvas.getContext("2d", { willReadFrequently: true });
    const dispCtx = displayCanvas.getContext("2d");
    if (!procCtx || !dispCtx) {
      animationId = requestAnimationFrame(render);
      return;
    }

    processingCanvas.width = gridCols;
    processingCanvas.height = gridRows;

    procCtx.save();
    if (mirror) {
      procCtx.scale(-1, 1);
      procCtx.drawImage(videoEl, -gridCols, 0, gridCols, gridRows);
    } else {
      procCtx.drawImage(videoEl, 0, 0, gridCols, gridRows);
    }
    procCtx.restore();

    const imageData = procCtx.getImageData(0, 0, gridCols, gridRows);
    const currentData = imageData.data;
    const previousData = previousFrame;

    const monoRGB = parseHexColor(monochromeColor);

    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const idx = (row * gridCols + col) * 4;
        const r = currentData[idx];
        const g = currentData[idx + 1];
        const b = currentData[idx + 2];

        const pixel = pixels[row]?.[col];
        if (!pixel) continue;

        let motion = 0;
        if (previousData) {
          const diff =
            Math.abs(r - previousData[idx]) +
            Math.abs(g - previousData[idx + 1]) +
            Math.abs(b - previousData[idx + 2]);
          motion = Math.min(1, diff / 255 / motionSensitivity);
        }

        pixel.motion = pixel.motion * 0.7 + motion * 0.3;

        let finalR = r, finalG = g, finalB = b;

        if (colorMode === "monochrome") {
          const brightness = (r + g + b) / 3 / 255;
          finalR = Math.round(monoRGB.r * brightness);
          finalG = Math.round(monoRGB.g * brightness);
          finalB = Math.round(monoRGB.b * brightness);
        }

        if (invertColors) {
          finalR = 255 - finalR;
          finalG = 255 - finalG;
          finalB = 255 - finalB;
        }

        if (darken > 0) {
          const f = 1 - darken;
          finalR = Math.round(finalR * f);
          finalG = Math.round(finalG * f);
          finalB = Math.round(finalB * f);
        }

        pixel.r = finalR;
        pixel.g = finalG;
        pixel.b = finalB;
        pixel.targetElevation = pixel.motion * maxElevation;
        pixel.currentElevation += (pixel.targetElevation - pixel.currentElevation) * elevationSmoothing;
      }
    }

    previousFrame = new Uint8ClampedArray(currentData);

    // Render display
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = displayCanvas.clientWidth;
    const displayHeight = displayCanvas.clientHeight;

    displayCanvas.width = displayWidth * dpr;
    displayCanvas.height = displayHeight * dpr;
    dispCtx.scale(dpr, dpr);

    dispCtx.fillStyle = backgroundColor;
    dispCtx.fillRect(0, 0, displayWidth, displayHeight);

    // Square cells, object-fit cover
    const cellSize = Math.max(displayWidth / gridCols, displayHeight / gridRows);
    const gap = cellSize * gapRatio;
    const gridWidth = cellSize * gridCols;
    const gridHeight = cellSize * gridRows;
    const offsetXGrid = (displayWidth - gridWidth) / 2;
    const offsetYGrid = (displayHeight - gridHeight) / 2;

    const borderRGB = parseHexColor(borderColor);

    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const pixel = pixels[row]?.[col];
        if (!pixel) continue;

        const x = offsetXGrid + col * cellSize;
        const y = offsetYGrid + row * cellSize;
        const elevation = pixel.currentElevation;

        // 3D offset (isometric projection)
        const offsetX = -elevation * 1.2;
        const offsetY = -elevation * 1.8;

        // Shadow
        if (elevation > 0.5) {
          dispCtx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.6, elevation * 0.04)})`;
          dispCtx.fillRect(
            x + gap / 2 + elevation * 1.5,
            y + gap / 2 + elevation * 2.0,
            cellSize - gap,
            cellSize - gap,
          );
        }

        // Side faces for 3D effect
        if (elevation > 0.5) {
          // Right side
          dispCtx.fillStyle = `rgb(${Math.max(0, pixel.r - 80)}, ${Math.max(0, pixel.g - 80)}, ${Math.max(0, pixel.b - 80)})`;
          dispCtx.beginPath();
          dispCtx.moveTo(x + cellSize - gap / 2 + offsetX, y + gap / 2 + offsetY);
          dispCtx.lineTo(x + cellSize - gap / 2, y + gap / 2);
          dispCtx.lineTo(x + cellSize - gap / 2, y + cellSize - gap / 2);
          dispCtx.lineTo(x + cellSize - gap / 2 + offsetX, y + cellSize - gap / 2 + offsetY);
          dispCtx.closePath();
          dispCtx.fill();

          // Bottom side
          dispCtx.fillStyle = `rgb(${Math.max(0, pixel.r - 50)}, ${Math.max(0, pixel.g - 50)}, ${Math.max(0, pixel.b - 50)})`;
          dispCtx.beginPath();
          dispCtx.moveTo(x + gap / 2 + offsetX, y + cellSize - gap / 2 + offsetY);
          dispCtx.lineTo(x + gap / 2, y + cellSize - gap / 2);
          dispCtx.lineTo(x + cellSize - gap / 2, y + cellSize - gap / 2);
          dispCtx.lineTo(x + cellSize - gap / 2 + offsetX, y + cellSize - gap / 2 + offsetY);
          dispCtx.closePath();
          dispCtx.fill();
        }

        // Top face (main cell) - brighter when elevated
        const brightness = 1 + elevation * 0.05;
        dispCtx.fillStyle = `rgb(${Math.min(255, Math.round(pixel.r * brightness))}, ${Math.min(255, Math.round(pixel.g * brightness))}, ${Math.min(255, Math.round(pixel.b * brightness))})`;
        dispCtx.fillRect(
          x + gap / 2 + offsetX,
          y + gap / 2 + offsetY,
          cellSize - gap,
          cellSize - gap,
        );

        // Border
        dispCtx.strokeStyle = `rgba(${borderRGB.r}, ${borderRGB.g}, ${borderRGB.b}, ${borderOpacity + elevation * 0.008})`;
        dispCtx.lineWidth = 0.5;
        dispCtx.strokeRect(
          x + gap / 2 + offsetX,
          y + gap / 2 + offsetY,
          cellSize - gap,
          cellSize - gap,
        );
      }
    }

    animationId = requestAnimationFrame(render);
  }

  onMount(() => {
    requestCameraAccess();
  });

  onDestroy(() => {
    if (animationId) cancelAnimationFrame(animationId);
    if (stream) stream.getTracks().forEach((t) => t.stop());
  });

  // Start render loop when ready
  $effect(() => {
    if (isReady) {
      animationId = requestAnimationFrame(render);
      return () => cancelAnimationFrame(animationId);
    }
  });
</script>

<div class="relative h-full w-full {className}">
  <video bind:this={videoEl} class="pointer-events-none absolute h-0 w-0 opacity-0" playsinline muted></video>
  <canvas bind:this={processingCanvas} class="pointer-events-none absolute h-0 w-0 opacity-0"></canvas>
  <canvas
    bind:this={displayCanvas}
    class="h-full w-full transition-opacity duration-1000 {isReady ? 'opacity-100' : 'opacity-0'}"
    style:background-color={backgroundColor}
  ></canvas>

  {#if error && showErrorPopup}
    <div class="fixed top-4 right-4 z-50 animate-in fade-in">
      <div class="relative flex max-w-sm items-start gap-3 rounded-lg border border-white/10 bg-black/80 p-4 shadow-2xl backdrop-blur-xl">
        <button
          onclick={() => (showErrorPopup = false)}
          class="absolute top-2 right-2 rounded-md p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
          aria-label="Close error popup"
          title="Close error popup"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10">
          <svg class="h-5 w-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <div class="flex-1 pr-4">
          <p class="text-sm font-medium text-white/90">Camera access needed</p>
          <p class="mt-1 text-xs text-white/50">Enable camera for the interactive background effect</p>
          <button
            onclick={requestCameraAccess}
            class="mt-3 inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20"
          >
            Enable Camera
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if error && !showErrorPopup}
    <button
      onclick={() => (showErrorPopup = true)}
      class="fixed top-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white/50 shadow-lg backdrop-blur-xl transition-all hover:scale-105 hover:bg-black/80 hover:text-white/80"
      title="Camera access required"
    >
      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18" />
      </svg>
    </button>
  {/if}
</div>
