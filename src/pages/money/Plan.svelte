<script lang="ts">
  import InlineMoney from '../../lib/ui/InlineMoney.svelte';
  import InlineText from '../../lib/ui/InlineText.svelte';
  import { db, settings, uid } from '../../lib/store.svelte';
  import { finance } from '../../lib/finance.svelte';
  import { toast, ui } from '../../lib/ui.svelte';
  import { money } from '../../lib/money';
  import { BUDGET_KINDS } from '../../lib/constants';
  import { Plus, Trash2, ChevronDown } from '../../lib/icons';
  import type { BudgetKind, BudgetLine } from '../../lib/types';

  const lines = $derived(finance.budgetSorted);
  const pay = $derived(settings.v.payAmount);
  const KIND_COLOR: Record<BudgetKind, string> = {
    save: 'var(--c-money)',
    fixed: 'var(--series-1)',
    flex: 'var(--c-diet)',
  };
  const kindTotals = $derived(
    BUDGET_KINDS.map((k) => ({ ...k, total: lines.filter((l) => l.kind === k.value).reduce((s, l) => s + l.amount, 0) })),
  );
  const freq = $derived(
    settings.v.payFrequency === 'weekly' ? 'weekly' : settings.v.payFrequency === 'biweekly' ? 'every 2 weeks' : 'monthly',
  );
  const billsLine = $derived(lines.find((l) => /bill/i.test(l.name)));

  function add() {
    db.budget.add({
      id: uid(),
      name: 'New line',
      amount: 0,
      kind: 'flex',
      note: '',
      order: lines.reduce((m, l) => Math.max(m, l.order), -1) + 1,
    });
  }

  function move(l: BudgetLine, dir: -1 | 1) {
    const i = lines.findIndex((x) => x.id === l.id);
    const other = lines[i + dir];
    if (!other) return;
    db.budget.update(l.id, { order: other.order });
    db.budget.update(other.id, { order: l.order });
  }

  function remove(l: BudgetLine) {
    const r = db.budget.remove(l.id);
    if (r) toast.undoable(`Removed ${l.name}`, () => db.budget.restore(r));
  }
</script>

<section class="card">
  <div class="card-head">
    <h2>Every payday: split <InlineMoney value={pay} label="Paycheck amount" strong onchange={(c) => settings.set({ payAmount: c })} /></h2>
    <span class="sub">Paid {freq} · <button class="link" onclick={() => ui.go('settings')}>change</button></span>
  </div>

  <div class="bar" role="img" aria-label="How the paycheck is split">
    {#each lines.filter((l) => l.amount > 0) as l (l.id)}
      <div
        class="seg"
        style:flex-grow={l.amount}
        style:background={KIND_COLOR[l.kind]}
        title="{l.name}: {money(l.amount)}"
      ></div>
    {/each}
    {#if finance.unassigned > 0}<div class="seg rest" style:flex-grow={finance.unassigned} title="Unassigned: {money(finance.unassigned)}"></div>{/if}
  </div>
  <div class="legend">
    {#each kindTotals as k (k.value)}
      <span class="key"><i style:background={KIND_COLOR[k.value]}></i>{k.label} <b class="num">{money(k.total)}</b></span>
    {/each}
    {#if finance.unassigned > 0}<span class="key"><i class="rest"></i>Unassigned <b class="num">{money(finance.unassigned)}</b></span>{/if}
  </div>

  <p class="muted small">Move savings out the moment pay lands, then live on what is left.</p>
</section>

<section class="card">
  <div class="card-head">
    <h2>Lines</h2>
    <span class="sub">Spending lines become envelopes you can track each pay period</span>
    <div class="actions"><button class="btn sm" onclick={add}><Plus size={15} /> Add line</button></div>
  </div>
  <div class="list">
    {#each lines as l, i (l.id)}
      <div class="list-row line">
        <div class="order">
          <button class="btn ghost icon sm" aria-label="Move up" disabled={i === 0} onclick={() => move(l, -1)}>
            <ChevronDown size={14} style="transform: rotate(180deg)" />
          </button>
          <button class="btn ghost icon sm" aria-label="Move down" disabled={i === lines.length - 1} onclick={() => move(l, 1)}>
            <ChevronDown size={14} />
          </button>
        </div>
        <i class="swatch" style:background={KIND_COLOR[l.kind]}></i>
        <div class="name-col">
          <InlineText value={l.name} label="Line name" onchange={(v) => v && db.budget.update(l.id, { name: v })} />
          <InlineText value={l.note} label="Note" placeholder="Add a note" onchange={(v) => db.budget.update(l.id, { note: v })} />
        </div>
        <select
          class="select mini"
          aria-label="Kind"
          value={l.kind}
          onchange={(e) => db.budget.update(l.id, { kind: (e.currentTarget as HTMLSelectElement).value as BudgetKind })}
        >
          {#each BUDGET_KINDS as k (k.value)}<option value={k.value} title={k.hint}>{k.label}</option>{/each}
        </select>
        <InlineMoney value={l.amount} label="{l.name} amount" strong onchange={(c) => db.budget.update(l.id, { amount: c })} />
        <button class="btn ghost icon sm row-actions" aria-label="Remove {l.name}" onclick={() => remove(l)}><Trash2 size={15} /></button>
      </div>
    {/each}
    <div class="list-row total">
      <span class="grow">Total</span>
      <span class="num strong">{money(finance.splitTotal)}</span>
      <span class="spacer"></span>
    </div>
  </div>

  {#if finance.unassigned > 0}
    <div class="callout warn">{money(finance.unassigned)} of each paycheck isn't assigned yet. Give it a job, ideally Savings.</div>
  {:else if finance.unassigned < 0}
    <div class="callout danger">The plan is {money(-finance.unassigned)} more than your paycheck. Trim a line so it adds up.</div>
  {:else}
    <div class="callout good">Every euro of the paycheck has a job.</div>
  {/if}
  {#if billsLine && Math.abs(billsLine.amount - finance.billsPerPay) >= 500}
    <div class="callout">
      Your active bills come to about {money(finance.billsPerPay)} per paycheck, but the {billsLine.name} line is {money(billsLine.amount)}.
    </div>
  {/if}
</section>

<style>
  .card-head h2 {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: var(--fs-lg);
  }
  .link {
    border: 0;
    background: none;
    padding: 0;
    color: var(--accent);
    font-size: inherit;
  }
  .link:hover {
    text-decoration: underline;
  }
  .bar {
    display: flex;
    gap: 2px;
    height: 1.25rem;
    border-radius: var(--radius-xs);
    overflow: hidden;
  }
  .seg {
    flex-basis: 0;
    min-width: 3px;
  }
  .seg.rest,
  i.rest {
    background: repeating-linear-gradient(45deg, var(--surface-3) 0 4px, transparent 4px 8px);
  }
  .legend {
    display: flex;
    gap: 0.5rem 1.25rem;
    flex-wrap: wrap;
    font-size: var(--fs-sm);
    color: var(--text-2);
  }
  .key {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .key b {
    color: var(--text);
    font-weight: 620;
  }
  .key i,
  .swatch {
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 3px;
    flex: none;
  }
  .line {
    gap: 0.5rem;
  }
  .order {
    display: flex;
    flex-direction: column;
    opacity: 0.4;
  }
  .order .btn {
    height: 1rem;
  }
  .line:hover .order {
    opacity: 1;
  }
  .name-col {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding-left: 0.5rem;
  }
  .name-col :global(.inline-input:last-child) {
    font-size: var(--fs-xs);
    color: var(--text-3);
    height: 1.5rem;
  }
  .select.mini {
    width: auto;
    height: 1.875rem;
    font-size: var(--fs-sm);
    padding-left: 0.5rem;
  }
  .total {
    font-weight: 600;
  }
  .strong {
    font-weight: 700;
    padding-right: 0.5rem;
  }
  .spacer {
    width: 1.875rem;
  }
  @container (max-width: 30rem) {
    .select.mini,
    .order {
      display: none;
    }
  }
</style>
