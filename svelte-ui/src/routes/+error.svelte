<script lang="ts">
  import { page } from "$app/stores";
  import ErrorShell from "$lib/components/error-shell.svelte";

  let status = $derived($page.status);
  let message = $derived($page.error?.message ?? "Something went wrong");

  let isNotFound = $derived(status === 404);
</script>

<ErrorShell
  status={String(status)}
  title={isNotFound ? "Page Not Found" : "Something Went Wrong"}
  message={isNotFound ? "The page you're looking for doesn't exist or has been moved." : message}
/>
