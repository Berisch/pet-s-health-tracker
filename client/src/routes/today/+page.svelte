<script lang="ts">
  import { onMount } from 'svelte';
  import { getDayData, updateDayData, addMedication, deleteMedication, type DayData } from '$lib/api';

  // Date state - check URL param first, then use today
  function getTodayString(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function getInitialDate(): string {
    if (typeof window !== 'undefined') {
      const urlDate = new URLSearchParams(window.location.search).get('date');
      if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) {
        return urlDate;
      }
    }
    return getTodayString();
  }

  let currentDate = $state(getInitialDate());
  let dayData = $state<DayData | null>(null);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);

  // Modal state
  let showAddMed = $state(false);
  let newMedName = $state('');
  let newMedTime = $state('morning');

  // Comment states (which comments are expanded)
  let expandedComments = $state<Set<string>>(new Set());

  // Format date for display
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Format Date object to YYYY-MM-DD string (local timezone)
  function toLocalDateString(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // Navigate date
  function prevDay() {
    const d = new Date(currentDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    currentDate = toLocalDateString(d);
  }

  function nextDay() {
    const d = new Date(currentDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    currentDate = toLocalDateString(d);
  }

  function goToday() {
    currentDate = getTodayString();
  }

  // Load data when date changes
  async function loadData() {
    loading = true;
    error = null;
    try {
      dayData = await getDayData(currentDate);
    } catch (e) {
      console.error('Failed to load data:', e);
      error = e instanceof Error ? e.message : 'Failed to load data';
    } finally {
      loading = false;
    }
  }

  // Auto-save helper
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  async function autoSave(data: Parameters<typeof updateDayData>[1]) {
    if (saveTimeout) clearTimeout(saveTimeout);
    saving = true;
    saveTimeout = setTimeout(async () => {
      try {
        dayData = await updateDayData(currentDate, data);
      } catch (e) {
        console.error('Failed to save:', e);
      } finally {
        saving = false;
      }
    }, 300);
  }

  // Update handlers
  function updateTeeth(value: boolean) {
    autoSave({ teeth_brushed: value ? 1 : 0 });
  }

  function updateCount(field: string, value: number) {
    autoSave({ [field]: Math.max(0, value) });
  }

  function updateComment(field: string, value: string) {
    autoSave({ [field]: value || null });
  }

  function updateMedication(medId: number, taken: boolean, comment?: string) {
    autoSave({ medications: [{ id: medId, taken, comment }] });
  }

  function updateMealStatus(slot: number, status: string) {
    const meal = dayData?.meals.find(m => m.meal_slot === slot);
    if (!meal) return;
    autoSave({ meals: [{ slot, status, actual_amount: meal.actual_amount ?? undefined }] });
  }

  function updateMealDefault(slot: number, amount: number) {
    const meal = dayData?.meals.find(m => m.meal_slot === slot);
    if (!meal) return;
    autoSave({ meals: [{ slot, status: meal.status, actual_amount: meal.actual_amount ?? undefined, set_default_amount: amount }] });
  }

  function updateMealActual(slot: number, amount: number | undefined) {
    const meal = dayData?.meals.find(m => m.meal_slot === slot);
    if (!meal) return;
    autoSave({ meals: [{ slot, status: meal.status, actual_amount: amount }] });
  }

  function updateMealComment(slot: number, comment: string) {
    const meal = dayData?.meals.find(m => m.meal_slot === slot);
    if (!meal) return;
    autoSave({ meals: [{ slot, status: meal.status, actual_amount: meal.actual_amount ?? undefined, comment: comment || undefined }] });
  }

  function updateNotes(value: string) {
    autoSave({ daily_notes: value || null });
  }

  // Toggle comment expansion
  function toggleComment(key: string) {
    if (expandedComments.has(key)) {
      expandedComments.delete(key);
    } else {
      expandedComments.add(key);
    }
    expandedComments = new Set(expandedComments);
  }

  // Add medication
  async function handleAddMed() {
    if (!newMedName.trim()) return;
    try {
      await addMedication(newMedName.trim(), newMedTime);
      await loadData();
      showAddMed = false;
      newMedName = '';
      newMedTime = 'morning';
    } catch (e) {
      console.error('Failed to add medication:', e);
    }
  }

  // Delete medication
  async function handleDeleteMed(id: number) {
    if (!confirm('Remove this medication?')) return;
    try {
      await deleteMedication(id);
      await loadData();
    } catch (e) {
      console.error('Failed to delete medication:', e);
    }
  }

  // Check if row should be highlighted
  function shouldHighlight(field: string, value: number | string): boolean {
    if (field === 'vomited') return (value as number) > 0;
    if (field === 'peed' || field === 'pooped') return (value as number) === 0;
    if (field === 'meal') return value !== 'ate_fully';
    return false;
  }

  // Load data on mount and when date changes
  onMount(() => loadData());
  $effect(() => {
    loadData();
  });
</script>

<div class="flex flex-col h-full">
  <!-- Header with date picker -->
  <header class="sticky top-0 bg-white shadow-sm z-10">
    <div class="flex items-center justify-between px-4 py-3 max-w-md mx-auto">
      <button onclick={prevDay} class="p-2 hover:bg-gray-100 rounded-full">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button onclick={goToday} class="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-lg">
        <span class="font-medium">{formatDate(currentDate)}</span>
        {#if saving}
          <span class="text-xs text-blue-500">saving...</span>
        {/if}
      </button>

      <button onclick={nextDay} class="p-2 hover:bg-gray-100 rounded-full">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  </header>

  <!-- Content -->
  {#if loading}
    <div class="flex-1 flex items-center justify-center">
      <p class="text-gray-500">Loading...</p>
    </div>
  {:else if error}
    <div class="flex-1 flex items-center justify-center p-4">
      <div class="text-center">
        <p class="text-red-500 font-medium">Error loading data</p>
        <p class="text-gray-500 text-sm mt-1">{error}</p>
        <button onclick={loadData} class="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
          Retry
        </button>
      </div>
    </div>
  {:else if dayData}
    <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-md mx-auto w-full">
      <!-- Hygiene -->
      <section class="card">
        <h2 class="font-semibold text-gray-700 mb-3">Hygiene</h2>
        <div class="flex items-center justify-between">
          <span>Teeth brushed</span>
          <div class="flex items-center gap-2">
            <button
              onclick={() => updateTeeth(!dayData?.teeth_brushed)}
              class="w-14 h-8 rounded-full transition-colors {dayData.teeth_brushed ? 'bg-green-500' : 'bg-gray-300'}"
            >
              <div class="w-6 h-6 bg-white rounded-full shadow transition-transform {dayData.teeth_brushed ? 'translate-x-7' : 'translate-x-1'}"></div>
            </button>
            <button onclick={() => toggleComment('teeth')} class="p-1 {dayData.teeth_comment ? 'text-blue-500' : 'text-gray-400'}">
              <svg class="w-5 h-5" fill={dayData.teeth_comment ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
          </div>
        </div>
        {#if expandedComments.has('teeth')}
          <input
            type="text"
            placeholder="Add comment..."
            value={dayData.teeth_comment || ''}
            onchange={(e) => updateComment('teeth_comment', e.currentTarget.value)}
            class="mt-2 w-full px-3 py-2 border rounded-lg text-sm"
          />
        {/if}
      </section>

      <!-- Behavior & Symptoms -->
      <section class="card">
        <h2 class="font-semibold text-gray-700 mb-3">Behavior & Symptoms</h2>
        <div class="space-y-3">
          {#each [
            { field: 'vomited', label: 'Vomited' },
            { field: 'peed', label: 'Peed' },
            { field: 'pooped', label: 'Pooped' },
            { field: 'drank', label: 'Drank' }
          ] as item}
            {@const value = dayData[item.field as keyof DayData] as number}
            {@const comment = dayData[`${item.field}_comment` as keyof DayData] as string | null}
            {@const highlight = shouldHighlight(item.field, value)}
            <div class="py-2 px-2 rounded {highlight ? 'row-highlight-red' : ''}">
              <div class="flex items-center justify-between">
                <span class={highlight ? 'font-medium' : ''}>{item.label}</span>
                <div class="flex items-center gap-2">
                  <button
                    onclick={() => updateCount(item.field, value - 1)}
                    class="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full text-lg font-medium"
                  >-</button>
                  <span class="w-8 text-center font-medium">{value}</span>
                  <button
                    onclick={() => updateCount(item.field, value + 1)}
                    class="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full text-lg font-medium"
                  >+</button>
                  <button onclick={() => toggleComment(item.field)} class="p-1 {comment ? 'text-blue-500' : 'text-gray-400'}">
                    <svg class="w-5 h-5" fill={comment ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </button>
                </div>
              </div>
              {#if expandedComments.has(item.field)}
                <input
                  type="text"
                  placeholder="Add comment..."
                  value={comment || ''}
                  onchange={(e) => updateComment(`${item.field}_comment`, e.currentTarget.value)}
                  class="mt-2 w-full px-3 py-2 border rounded-lg text-sm"
                />
              {/if}
            </div>
          {/each}
        </div>
      </section>

      <!-- Medications -->
      <section class="card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-semibold text-gray-700">Medications</h2>
          <button onclick={() => showAddMed = true} class="p-1 text-blue-500 hover:bg-blue-50 rounded">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <div class="space-y-3">
          {#each dayData.medications.filter(m => m.is_active) as med}
            <div class="flex items-center justify-between py-2">
              <div class="flex-1">
                <span>{med.name}</span>
                <span class="text-sm text-gray-500 ml-1">({med.time_label})</span>
              </div>
              <div class="flex items-center gap-2">
                <button
                  onclick={() => updateMedication(med.id, !med.taken)}
                  class="w-14 h-8 rounded-full transition-colors {med.taken ? 'bg-green-500' : 'bg-gray-300'}"
                >
                  <div class="w-6 h-6 bg-white rounded-full shadow transition-transform {med.taken ? 'translate-x-7' : 'translate-x-1'}"></div>
                </button>
                <button onclick={() => toggleComment(`med-${med.id}`)} class="p-1 {med.comment ? 'text-blue-500' : 'text-gray-400'}">
                  <svg class="w-5 h-5" fill={med.comment ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </button>
                <button onclick={() => handleDeleteMed(med.id)} class="p-1 text-gray-400 hover:text-red-500">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
            {#if expandedComments.has(`med-${med.id}`)}
              <input
                type="text"
                placeholder="Add comment..."
                value={med.comment || ''}
                onchange={(e) => updateMedication(med.id, !!med.taken, e.currentTarget.value)}
                class="w-full px-3 py-2 border rounded-lg text-sm mb-2"
              />
            {/if}
          {/each}
        </div>
      </section>

      <!-- Meals -->
      <section class="card">
        <h2 class="font-semibold text-gray-700 mb-3">Meals</h2>
        <div class="space-y-4">
          {#each dayData.meals as meal}
            {@const highlight = shouldHighlight('meal', meal.status)}
            <div class="py-2 px-2 rounded {highlight ? 'row-highlight-red' : ''}">
              <div class="flex items-center justify-between mb-2">
                <span class={highlight ? 'font-medium' : ''}>Meal {meal.meal_slot} ({meal.label})</span>
                <button onclick={() => toggleComment(`meal-${meal.meal_slot}`)} class="p-1 {meal.comment ? 'text-blue-500' : 'text-gray-400'}">
                  <svg class="w-5 h-5" fill={meal.comment ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </button>
              </div>
              <div class="flex items-center gap-2 mb-2">
                <select
                  value={meal.status}
                  onchange={(e) => updateMealStatus(meal.meal_slot, e.currentTarget.value)}
                  class="flex-1 px-3 py-2 border rounded-lg bg-white"
                >
                  <option value="ate_fully">Ate fully</option>
                  <option value="not_fully">Didn't eat fully</option>
                  <option value="skipped">Skipped</option>
                </select>
              </div>
              <!-- Amount inputs: Default (feeder) and Actual (what cat ate) -->
              <div class="flex items-center gap-3 text-sm">
                <div class="flex items-center gap-1">
                  <span class="text-gray-500">Default:</span>
                  <input
                    type="number"
                    placeholder="g"
                    value={meal.default_amount || ''}
                    onchange={(e) => updateMealDefault(meal.meal_slot, parseInt(e.currentTarget.value) || 0)}
                    class="w-16 px-2 py-1 border rounded text-center"
                  />
                  <span class="text-gray-400">g</span>
                </div>
                <div class="flex items-center gap-1">
                  <span class="text-gray-500">Ate:</span>
                  <input
                    type="number"
                    placeholder={String(meal.default_amount) || 'g'}
                    value={meal.actual_amount ?? ''}
                    onchange={(e) => updateMealActual(meal.meal_slot, parseInt(e.currentTarget.value) || undefined)}
                    class="w-16 px-2 py-1 border rounded text-center"
                  />
                  <span class="text-gray-400">g</span>
                </div>
              </div>
              {#if expandedComments.has(`meal-${meal.meal_slot}`)}
                <input
                  type="text"
                  placeholder="Add comment..."
                  value={meal.comment || ''}
                  onchange={(e) => updateMealComment(meal.meal_slot, e.currentTarget.value)}
                  class="mt-2 w-full px-3 py-2 border rounded-lg text-sm"
                />
              {/if}
            </div>
          {/each}
        </div>
      </section>

      <!-- Notes -->
      <section class="card">
        <h2 class="font-semibold text-gray-700 mb-3">Notes</h2>
        <textarea
          placeholder="Notes for the day..."
          value={dayData.daily_notes || ''}
          onchange={(e) => updateNotes(e.currentTarget.value)}
          class="w-full px-3 py-2 border rounded-lg min-h-[100px] resize-none"
        ></textarea>
      </section>
    </div>
  {/if}
</div>

<!-- Add Medication Modal -->
{#if showAddMed}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-sm p-4">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-lg">Add Medication</h3>
        <button onclick={() => showAddMed = false} class="p-1 hover:bg-gray-100 rounded">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            bind:value={newMedName}
            placeholder="Medication name"
            class="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Time</label>
          <select bind:value={newMedTime} class="w-full px-3 py-2 border rounded-lg bg-white">
            <option value="morning">morning</option>
            <option value="evening">evening</option>
            <option value="morning with food">morning with food</option>
            <option value="evening with food">evening with food</option>
          </select>
        </div>
        <div class="flex gap-2">
          <button onclick={() => showAddMed = false} class="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button onclick={handleAddMed} class="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            Add
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
