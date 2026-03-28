<!--
  HelloWorldDashboardWidget — minimal plugin UI contribution.
  Svelte 5 port of the React version.
-->
<script lang="ts">
  import type { PluginWidgetProps } from "@clawdev/plugin-sdk/ui-svelte";

  let { context }: PluginWidgetProps = $props();
</script>

<section aria-label="Hello world plugin widget">
  <strong>Hello world</strong>
  <div>This widget was added by @clawdev/plugin-hello-world-example.</div>
  <div>Company context: {context.companyId}</div>
</section>
