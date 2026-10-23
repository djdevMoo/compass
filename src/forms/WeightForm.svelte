<script lang="ts">
  import { clock, db } from '../lib/store.svelte';
  import { toast } from '../lib/ui.svelte';

  let { done }: { done: () => void } = $props();

  const last = [...db.weights.items].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  let kg = $state<number | null>(last?.kg ?? null);
  let date = $state(clock.today);

  const valid = $derived(!!kg && kg >= 20 && kg <= 400);

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!valid) return;
    const found = db.weights.get(date);
    const prev = found ? { ...found } : null;
    const value = Math.round(kg! * 10) / 10;
    db.weights.put({ id: date, date, kg: value });
    toast.undoable(`Logged ${value} kg`, () => (prev ? db.weights.put(prev) : db.weights.remove(date)));
    done();
  }
</script>

<form class="stack" onsubmit={submit}>
  <div class="fields">
    <label class="field">
      <span>Weight <span class="faint">(kg)</span></span>
      <!-- svelte-ignore a11y_autofocus -->
      <input class="input num" type="number" min="20" max="400" step="0.1" bind:value={kg} required autofocus />
    </label>
    <label class="field">
      <span>Date</span>
      <input class="input" type="date" bind:value={date} max={clock.today} required />
    </label>
  </div>
  <p class="faint xs">One entry per day. Logging again on the same day replaces it.</p>
  <div class="form-actions">
    <button type="button" class="btn ghost" onclick={done}>Cancel</button>
    <button type="submit" class="btn primary" disabled={!valid}>Log weight</button>
  </div>
</form>
