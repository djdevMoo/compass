<script lang="ts">
  import MoneyInput from '../lib/ui/MoneyInput.svelte';
  import { db, settings, uid } from '../lib/store.svelte';
  import { toast } from '../lib/ui.svelte';
  import { WISH_CATEGORIES } from '../lib/constants';
  import { getDateLocale } from '../lib/dates';

  let { done }: { done: () => void } = $props();

  let name = $state('');
  let price = $state<number | null>(null);
  let category = $state('Game');
  let url = $state('');
  let note = $state('');

  const urlOk = $derived(url.trim() === '' || /^https?:\/\/\S+$/i.test(url.trim()));

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!name.trim() || !urlOk) return;
    db.wishes.add({
      id: uid(),
      name: name.trim(),
      price: price ?? 0,
      category,
      url: url.trim(),
      note: note.trim(),
      addedAt: new Date().toISOString(),
      status: 'waiting',
      decidedAt: null,
    });
    const ready = new Date(Date.now() + settings.v.wishCooldownHours * 3_600_000);
    const when = ready.toLocaleString(getDateLocale(), { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    toast.show(`On the list. You can decide after ${when}.`);
    done();
  }
</script>

<form class="stack" onsubmit={submit}>
  <label class="field">
    <span>What do you want?</span>
    <!-- svelte-ignore a11y_autofocus -->
    <input class="input" bind:value={name} placeholder="e.g. Elden Ring DLC" maxlength="120" required autofocus />
  </label>
  <div class="fields">
    <label class="field">
      <span>Price</span>
      <MoneyInput bind:value={price} />
    </label>
    <label class="field">
      <span>Type</span>
      <select class="select" bind:value={category}>
        {#each WISH_CATEGORIES as c (c)}<option>{c}</option>{/each}
      </select>
    </label>
  </div>
  <label class="field">
    <span>Link <span class="faint">(optional)</span></span>
    <input class="input" class:invalid={!urlOk} bind:value={url} placeholder="https://…" inputmode="url" />
  </label>
  <label class="field">
    <span>Why do you want it? <span class="faint">(optional)</span></span>
    <input class="input" bind:value={note} maxlength="200" />
  </label>
  <p class="faint xs">
    It waits {settings.v.wishCooldownHours} hours before you can buy it. If you still want it then, and it fits your Fun money, go for it.
  </p>
  <div class="form-actions">
    <button type="button" class="btn ghost" onclick={done}>Cancel</button>
    <button type="submit" class="btn primary" disabled={!name.trim() || !urlOk}>Add to wishlist</button>
  </div>
</form>
