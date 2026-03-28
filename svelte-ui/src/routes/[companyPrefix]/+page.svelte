<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { onMount } from "svelte";

  onMount(() => {
    const prefix = $page.params.companyPrefix;
    goto(`/${prefix}/dashboard`, { replaceState: true });
  });
</script>
