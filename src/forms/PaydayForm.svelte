<script lang="ts">
  import MoneyInput from '../lib/ui/MoneyInput.svelte';
  import { finance, logPayday } from '../lib/finance.svelte';
  import { clock, db, settings } from '../lib/store.svelte';
  import { toast } from '../lib/ui.svelte';
  import { money } from '../lib/money';
  import { fmt } from '../lib/dates';

  let { done }: { done: () => void } = $props();

  const goalAccounts = [...db.accounts.items].filter((a) => a.inGoal).sort((a, b) => a.order - b.order);
  const defaultAcc = goalAccounts.find((a) => a.kind === 'savings') ?? goalAccounts[0];

  let amount = $state<number | null>(finance.savePerPay || null);
  let accountId = $state(defaultAcc?.id ?? '');
  let date = $state(clock.today);

  const newTotal = $derived(finance.goalTotal + (amount ?? 0));
  const newPct = $derived(finance.target > 0 ? Math.min(100, Math.floor((newTotal / finance.target) * 100)) : 0);
  const freqLabel = $derived(
    settings.v.payFrequency === 'weekly' ? 'every week' : settings.v.payFrequency === 'biweekly' ? 'every 2 weeks' : 'every month',
  );

  function submit(e: SubmitEvent) {
    e.preventDefault();
    const acc = db.accounts.get(accountId);
    if (!amount || amount <= 0 || !acc) return;
    const undo = logPayday(date, amount, accountId);
    toast.undoable(`Moved ${money(amount)} into ${acc.name}`, undo);
    done();
  }
</script>

{#if goalAccounts.length === 0}
  <p class="muted">Add an account that counts towards your goal first (Money › Overview).</p>
  <div class="form-actions"><button class="btn" onclick={done}>Close</button></div>
{:else}
  <form class="stack" onsubmit={submit}>
    <div class="fields">
      <label class="field">
        <span>Saved this payday</span>
        <MoneyInput bind:value={amount} autofocus />
      </label>
      <label class="field">
        <span>Payday</span>
        <input class="input" type="date" bind:value={date} max={clock.today} required />
      </label>
    </div>

    <label class="field">
      <span>Into</span>
      <select class="select" bind:value={accountId}>
        {#each goalAccounts as a (a.id)}
          <option value={a.id}>{a.name} ({money(a.balance)})</option>
        {/each}
      </select>
    </label>

    <div class="callout good">
      <span>
        {settings.v.goalName}: <b class="num">{money(finance.goalTotal)}</b> → <b class="num">{money(newTotal)}</b>
        ({newPct}% of {money(finance.target)})
      </span>
    </div>

    {#if !settings.v.payAnchor}
      <p class="faint xs">
        This also sets your pay schedule: {freqLabel} from {fmt.full(date)}. You can change it in Settings.
      </p>
    {/if}

    <div class="form-actions">
      <button type="button" class="btn ghost" onclick={done}>Cancel</button>
      <button type="submit" class="btn primary" disabled={!amount || amount <= 0}>Log payday</button>
    </div>
  </form>
{/if}
