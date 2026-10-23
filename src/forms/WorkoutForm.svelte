<script lang="ts">
  import Segmented from '../lib/ui/Segmented.svelte';
  import { clock, db, uid } from '../lib/store.svelte';
  import { toast } from '../lib/ui.svelte';
  import { WORKOUT_TYPES } from '../lib/constants';
  import type { WorkoutType } from '../lib/types';

  let { done }: { done: () => void } = $props();

  const PLACEHOLDER: Record<WorkoutType, string> = {
    strength: 'Push day, legs, full body…',
    cardio: 'Run, cycle, rowing…',
    mobility: 'Stretching, yoga…',
    sport: 'Football, climbing, boxing…',
    walk: 'Evening walk, hike…',
  };
  const EFFORT = ['Easy', 'Light', 'Solid', 'Hard', 'All out'];

  let type = $state<WorkoutType>('strength');
  let title = $state('');
  let minutes = $state<number | null>(45);
  let effort = $state(3);
  let date = $state(clock.today);
  let notes = $state('');

  const valid = $derived(!!minutes && minutes > 0 && minutes <= 600);

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!valid) return;
    const label = WORKOUT_TYPES.find((t) => t.value === type)!.label;
    const w = db.workouts.add({
      id: uid(),
      date,
      type,
      title: title.trim() || label,
      minutes: Math.round(minutes!),
      effort,
      notes: notes.trim(),
    });
    toast.undoable(`Logged ${w.title}, ${w.minutes} min`, () => db.workouts.remove(w.id));
    done();
  }
</script>

<form class="stack" onsubmit={submit}>
  <div class="field">
    <span class="label">Type</span>
    <Segmented bind:value={type} options={WORKOUT_TYPES} label="Workout type" />
  </div>
  <label class="field">
    <span>Name <span class="faint">(optional)</span></span>
    <input class="input" bind:value={title} placeholder={PLACEHOLDER[type]} maxlength="80" />
  </label>
  <div class="fields">
    <label class="field">
      <span>Minutes</span>
      <input class="input num" type="number" min="1" max="600" step="1" bind:value={minutes} required />
    </label>
    <label class="field">
      <span>Date</span>
      <input class="input" type="date" bind:value={date} max={clock.today} required />
    </label>
  </div>
  <div class="field">
    <span class="label">Effort: {EFFORT[effort - 1]}</span>
    <div class="effort" role="radiogroup" aria-label="Effort">
      {#each [1, 2, 3, 4, 5] as n (n)}
        <button
          type="button"
          role="radio"
          aria-checked={effort === n}
          aria-label={EFFORT[n - 1]}
          class:on={n <= effort}
          onclick={() => (effort = n)}
        ></button>
      {/each}
    </div>
  </div>
  <label class="field">
    <span>Notes <span class="faint">(optional)</span></span>
    <textarea class="textarea" bind:value={notes} rows="2" placeholder="Sets, distance, how it felt…"></textarea>
  </label>
  <div class="form-actions">
    <button type="button" class="btn ghost" onclick={done}>Cancel</button>
    <button type="submit" class="btn primary" disabled={!valid}>Log workout</button>
  </div>
</form>

<style>
  .effort {
    display: flex;
    gap: 0.375rem;
  }
  .effort button {
    flex: 1;
    height: 0.625rem;
    border-radius: 999px;
    border: 0;
    background: var(--surface-3);
    transition: background var(--dur) var(--ease);
  }
  .effort button.on {
    background: var(--c-fit);
  }
  .effort button:hover {
    outline: 2px solid var(--border-strong);
    outline-offset: 2px;
  }
</style>
