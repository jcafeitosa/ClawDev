<script lang="ts">
  /**
   * Plugin Renderer — renders a plugin's adapter-configured UI.
   *
   * Each plugin can define Svelte components for:
   * - Settings page
   * - Dashboard widget
   * - Sidebar section
   * - Toolbar action
   *
   * Placeholder for Tarefa 9 full implementation.
   */

  type Props = {
    pluginId: string;
    view: "settings" | "dashboard" | "sidebar" | "toolbar";
  };

  let { pluginId, view }: Props = $props();
</script>

<div data-slot="plugin-renderer" data-plugin={pluginId} data-view={view} class="contents">
  <!-- Plugin {pluginId} / {view} — will render dynamically -->
</div>
