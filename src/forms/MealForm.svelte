<script lang="ts">
  import { untrack } from 'svelte';
  import Segmented from '../lib/ui/Segmented.svelte';
  import { clock, db, settings, uid } from '../lib/store.svelte';
  import { finance } from '../lib/finance.svelte';
  import { toast, ui } from '../lib/ui.svelte';
  import { MEAL_SLOTS, slotForNow } from '../lib/constants';
  import type { Meal, MealSlot } from '../lib/types';

  let { done }: { done: () => void } = $props();

  const preset = untrack(() => ui.preset) as { date?: string; slot?: MealSlot };

  let slot = $state<MealSlot>(preset.slot ?? slotForNow());
  let name = $state('');
  let kcal = $state<number | null>(null);
  let protein = $state<number | null>(null);
  let takeout = $state(false);
  let date = $state(preset.date ?? clock.today);

  /** Meals you log often, newest first, so repeats are one click. */
  const recent = (() => {
    const seen = new Map<string, Meal>();
    for (const m of [...db.meals.items].sort((a, b) => (a.date < b.date ? 1 : -1))) {
      const k = m.name.toLowerCase();
      if (!seen.has(k)) seen.set(k, m);
      if (seen.size >= 8) break;
    }
    return [...seen.values()];
  })();

  function fill(m: Meal) {
    name = m.name;
    kcal = m.kcal || null;
    protein = m.protein || null;
    takeout = m.takeout;
  }

  const valid = $derived(name.trim().length > 0 && (kcal ?? 0) >= 0 && (protein ?? 0) >= 0);
  const takeoutsLeft = $derived(settings.v.takeoutCap - finance.takeoutsThisPeriod);

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!valid) return;
    const m = db.meals.add({
      id: uid(),
      date,
      slot,
      name: name.trim(),
      kcal: Math.round(kcal ?? 0),
      protein: Math.round(protein ?? 0),
      takeout,
    });
    toast.undoable(`Logged ${m.name}`, () => db.meals.remove(m.id));
    done();
  }
</script>

<form class="stack" onsubmit={submit}>
  <Segmented bind:value={slot} options={MEAL_SLOTS} label="Meal" />

  {#if recent.length}
    <div class="row wrap recent">
      {#each recent as m (m.id)}
        <button type="button" class="chip pickable" onclick={() => fill(m)}>{m.name}</button>
      {/each}
    </div>
  {/if}

  <label class="field">
    <span>What did you eat?</span>
    <!-- svelte-ignore a11y_autofocus -->
    <input class="input" bind:value={name} placeholder="Chicken wrap, porridge…" maxlength="100" required autofocus />
  </label>
  <div class="fields">
    <label class="field">
      <span>Calories <span class="faint">(kcal)</span></span>
      <input class="input num" type="number" min="0" max="10000" step="1" bind:value={kcal} placeholder="0" />
    </label>
    <label class="field">
      <span>Protein <span class="faint">(g)</span></span>
      <input class="input num" type="number" min="0" max="1000" step="1" bind:value={protein} placeholder="0" />
    </label>
    <label class="field">
      <span>Date</span>
      <input class="input" type="date" bind:value={date} max={clock.today} required />
    </label>
  </div>
  <label class="check">
    <input type="checkbox" bind:checked={takeout} />
    Takeout or delivery
    <span class="faint small">
      ({takeoutsLeft > 0 ? `${takeoutsLeft} of ${settings.v.takeoutCap} left ${finance.takeoutWindow.label}` : `cap reached ${finance.takeoutWindow.label}`})
    </span>
  </label>
  <div class="form-actions">
    <button type="button" class="btn ghost" onclick={done}>Cancel</button>
    <button type="submit" class="btn primary" disabled={!valid}>Log meal</button>
  </div>
</form>

<style>
  .recent {
    gap: 0.375rem;
  }
  .pickable {
    border: 1px solid var(--border);
    cursor: pointer;
    height: 1.625rem;
    font-size: var(--fs-xs);
    font-weight: 540;
    max-width: 12rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pickable:hover {
    border-color: var(--border-strong);
    color: var(--text);
  }
</style>
