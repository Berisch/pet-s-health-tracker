<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getTrends, getProblemDays, type TrendsSummary, type ProblemDay } from '$lib/api';

  let period = $state<'7' | '30' | 'all'>('7');
  let trends = $state<TrendsSummary | null>(null);
  let problemDays = $state<ProblemDay[]>([]);
  let loading = $state(true);

  async function loadData() {
    loading = true;
    try {
      const [trendsData, problemsData] = await Promise.all([
        getTrends(period),
        getProblemDays(period)
      ]);
      trends = trendsData;
      problemDays = problemsData;
    } catch (e) {
      console.error('Failed to load trends:', e);
    } finally {
      loading = false;
    }
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  }

  function goToDay(date: string) {
    goto(`/today?date=${date}`);
  }

  onMount(() => loadData());

  $effect(() => {
    loadData();
  });
</script>

<div class="flex flex-col h-full">
  <!-- Header -->
  <header class="sticky top-0 bg-white shadow-sm z-10">
    <div class="px-4 py-3 max-w-md mx-auto">
      <h1 class="font-semibold text-lg text-center mb-3">Trends</h1>
      <!-- Period selector -->
      <div class="flex gap-2">
        {#each [{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: 'all', label: 'All' }] as opt}
          <button
            onclick={() => period = opt.value as '7' | '30' | 'all'}
            class="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors {period === opt.value ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
          >
            {opt.label}
          </button>
        {/each}
      </div>
    </div>
  </header>

  <!-- Content -->
  {#if loading}
    <div class="flex-1 flex items-center justify-center">
      <p class="text-gray-500">Loading...</p>
    </div>
  {:else if trends}
    <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-md mx-auto w-full">
      <!-- Summary Tiles -->
      <div class="grid grid-cols-2 gap-3">
        <!-- Meals tile -->
        <div class="card">
          <h3 class="text-sm text-gray-500 mb-1">Meals not eaten</h3>
          <p class="text-2xl font-bold">{trends.meals.missed}<span class="text-sm font-normal text-gray-500">/{trends.meals.total}</span></p>
          <!-- Mini bar chart -->
          <div class="flex items-end gap-0.5 h-8 mt-2">
            {#each trends.charts.dailyMeals.slice(-7) as day}
              <div
                class="flex-1 rounded-t {day.missed > 0 ? 'bg-red-400' : 'bg-green-400'}"
                style="height: {Math.max(10, (day.missed / 4) * 100)}%"
              ></div>
            {/each}
          </div>
        </div>

        <!-- Vomiting tile -->
        <div class="card">
          <h3 class="text-sm text-gray-500 mb-1">Vomiting days</h3>
          <p class="text-2xl font-bold">{trends.vomiting.daysWithVomit}<span class="text-sm font-normal text-gray-500">/{trends.totalDays}</span></p>
          <!-- Colored dots -->
          <div class="flex flex-wrap gap-1 mt-2">
            {#each trends.charts.dailyVomit.slice(-14) as day}
              <div class="w-3 h-3 rounded-full {day.vomited > 0 ? 'bg-red-500' : 'bg-green-500'}"></div>
            {/each}
          </div>
        </div>

        <!-- Pee & Poop tile -->
        <div class="card col-span-2">
          <h3 class="text-sm text-gray-500 mb-2">Pee & Poop</h3>
          <div class="flex gap-6">
            <div>
              <span class="text-lg font-bold">{trends.peePoop.peeDays}</span>
              <span class="text-sm text-gray-500">/{trends.totalDays} pee days</span>
            </div>
            <div>
              <span class="text-lg font-bold">{trends.peePoop.poopDays}</span>
              <span class="text-sm text-gray-500">/{trends.totalDays} poop days</span>
            </div>
          </div>
          {#if trends.peePoop.noPoopDates.length > 0}
            <p class="text-sm text-gray-500 mt-2">
              No poop: {trends.peePoop.noPoopDates.slice(0, 3).map(formatDate).join(', ')}{trends.peePoop.noPoopDates.length > 3 ? '...' : ''}
            </p>
          {/if}
          {#if trends.peePoop.noPeeDates.length > 0}
            <p class="text-sm text-gray-500">
              No pee: {trends.peePoop.noPeeDates.slice(0, 3).map(formatDate).join(', ')}{trends.peePoop.noPeeDates.length > 3 ? '...' : ''}
            </p>
          {/if}
        </div>
      </div>

      <!-- Day Status Summary -->
      <div class="card">
        <h3 class="text-sm text-gray-500 mb-2">Day Status Overview</h3>
        <div class="flex gap-4">
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 rounded-full bg-green-500"></div>
            <span>{trends.statusCounts.GREEN} good</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 rounded-full bg-orange-500"></div>
            <span>{trends.statusCounts.ORANGE} moderate</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 rounded-full bg-red-500"></div>
            <span>{trends.statusCounts.RED} serious</span>
          </div>
        </div>
      </div>

      <!-- Problem Days List -->
      <section>
        <h2 class="font-semibold text-gray-700 mb-3">Days to Pay Attention To</h2>
        {#if problemDays.length === 0}
          <div class="card text-center text-gray-500 py-8">
            <svg class="w-12 h-12 mx-auto mb-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>All days are good!</p>
          </div>
        {:else}
          <div class="space-y-2">
            {#each problemDays as day}
              <button
                onclick={() => goToDay(day.date)}
                class="w-full card text-left hover:shadow-md transition-shadow {day.status === 'RED' ? 'border-l-4 border-red-500' : 'border-l-4 border-orange-500'}"
              >
                <div class="flex items-start gap-3">
                  <div class="w-3 h-3 rounded-full mt-1.5 {day.status === 'RED' ? 'bg-red-500' : 'bg-orange-500'}"></div>
                  <div class="flex-1">
                    <p class="font-medium">{formatDate(day.date)}</p>
                    <p class="text-sm text-gray-600">{day.issues.join(', ')}</p>
                  </div>
                  <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </section>
    </div>
  {/if}
</div>
