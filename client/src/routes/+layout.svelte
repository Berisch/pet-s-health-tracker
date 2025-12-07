<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';

  let { children } = $props();
</script>

<div class="min-h-screen flex flex-col pb-16">
  <!-- Main content -->
  <main class="flex-1 overflow-y-auto">
    {@render children()}
  </main>

  <!-- Bottom navigation -->
  <nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 bottom-nav">
    <div class="flex justify-around items-center h-14 max-w-md mx-auto">
      <a
        href="/today"
        class="flex flex-col items-center justify-center flex-1 py-2 {$page.url.pathname.startsWith('/today') ? 'text-blue-600' : 'text-gray-500'}"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span class="text-xs mt-1">Today</span>
      </a>
      <a
        href="/trends"
        class="flex flex-col items-center justify-center flex-1 py-2 {$page.url.pathname.startsWith('/trends') ? 'text-blue-600' : 'text-gray-500'}"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span class="text-xs mt-1">Trends</span>
      </a>
    </div>
  </nav>
</div>
