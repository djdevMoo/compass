<script lang="ts">
  import { db, uid } from '../lib/store.svelte';
  import { toast } from '../lib/ui.svelte';
  import { AREAS } from '../lib/constants';
  import type { Area } from '../lib/types';

  let { done }: { done: () => void } = $props();

  let title = $state('');
  let area = $state<Area>('personal');
  let why = $state('');
  let targetDate = $state('');
  let steps = $state('');

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const g = db.goals.add({
      id: uid(),
      title: title.trim(),
      area,
      why: why.trim(),
      targetDate: targetDate || null,
      status: 'active',
      linked: null,
      createdAt: new Date().toISOString(),
      order: db.goals.items.reduce((m, x) => Math.max(m, x.order), 0) + 1,
      milestones: steps
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((text) => ({ id: uid(), text, done: false })),
    });
    toast.undoable(`Added “${g.title}”`, () => db.goals.remove(g.id));
    done();
  }
</script>

<form class="stack" onsubmit={submit}>
  <label class="field">
    <span>What do you want to achieve?</span>
    <!-- svelte-ignore a11y_autofocus -->
    <input class="input" bind:value={title} placeholder="Run a 10k, learn to cook 10 meals, visit Japan…" maxlength="120" required autofocus />
  </label>
  <div class="fields">
    <label class="field">
      <span>Area</span>
      <select class="select" bind:value={area}>
        {#each AREAS as a (a.value)}<option value={a.value}>{a.label}</option>{/each}
      </select>
    </label>
    <label class="field">
      <span>Target date <span class="faint">(optional)</span></span>
      <input class="input" type="date" bind:value={targetDate} />
    </label>
  </div>
  <label class="field">
    <span>Why it matters <span class="faint">(optional)</span></span>
    <input class="input" bind:value={why} maxlength="200" placeholder="The reason you'll read on a hard day" />
  </label>
  <label class="field">
    <span>First steps <span class="faint">(one per line)</span></span>
    <textarea class="textarea" bind:value={steps} rows="4"></textarea>
  </label>
  <div class="form-actions">
    <button type="button" class="btn ghost" onclick={done}>Cancel</button>
    <button type="submit" class="btn primary" disabled={!title.trim()}>Add aspiration</button>
  </div>
</form>
