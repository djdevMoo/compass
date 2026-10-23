<script lang="ts">
  import { untrack } from 'svelte';
  import MoneyInput from '../lib/ui/MoneyInput.svelte';
  import EnvelopePicker from './EnvelopePicker.svelte';
  import { addSpend, finance } from '../lib/finance.svelte';
  import { clock, db } from '../lib/store.svelte';
  import { toast, ui } from '../lib/ui.svelte';
  import { money } from '../lib/money';

  let { done }: { done: () => void } = $props();

  const preset = untrack(() => ui.preset) as { budgetId?: string; amount?: number; note?: string };
  const lines = finance.envelopes.map((e) => e.line);
  const fallback = lines.find((l) => /daily/i.test(l.name)) ?? lines.find((l) => l.kind === 'flex') ?? lines[0];

  let amount = $state<number | null>(preset.amount ?? null);
  let budgetId = $state(preset.budgetId ?? fallback?.id ?? '');
  let note = $state(preset.note ?? '');
  let date = $state(clock.today);

  const env = $derived(finance.envelopes.find((e) => e.line.id === budgetId));
  const after = $derived(env ? env.left - (amount ?? 0) : null);
  const inPeriod = $derived(date >= finance.period.start && date < finance.period.next);

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!amount || amount <= 0) return;
    const s = addSpend(amount, budgetId || null, note.trim(), date);
    toast.undoable(`Logged ${money(amount)}${env ? ` from ${env.line.name}` : ''}`, () => db.spends.remove(s.id));
    done();
  }
</script>

<form class="stack" onsubmit={submit}>
  <div class="fields">
    <label class="field">
      <span>Amount</span>
      <MoneyInput bind:value={amount} autofocus />
    </label>
    <label class="field">
      <span>Date</span>
      <input class="input" type="date" bind:value={date} max={clock.today} required />
    </label>
  </div>

  <div class="field">
    <span class="label">Comes out of</span>
    <EnvelopePicker bind:value={budgetId} />
  </div>

  <label class="field">
    <span>What was it? <span class="faint">(optional)</span></span>
    <input class="input" bind:value={note} placeholder="Coffee, groceries, a game…" maxlength="120" />
  </label>

  {#if env && after !== null && inPeriod}
    <div class="callout" class:warn={after < 0}>
      {#if after < 0}
        This puts {env.line.name} {money(-after)} over for this pay period.
      {:else}
        {money(after)} left in {env.line.name} until payday.
      {/if}
    </div>
  {/if}

  <div class="form-actions">
    <button type="button" class="btn ghost" onclick={done}>Cancel</button>
    <button type="submit" class="btn primary" disabled={!amount || amount <= 0}>Log spend</button>
  </div>
</form>
