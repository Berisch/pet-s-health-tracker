<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    goto('/today', { replaceState: true });
  });
</script>

<div class="flex items-center justify-center h-screen">
  <p class="text-gray-500">Loading...</p>
</div>
