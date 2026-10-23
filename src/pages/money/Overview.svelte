<script lang="ts">
  import Stat from '../../lib/ui/Stat.svelte';
  import LineChart from '../../lib/ui/LineChart.svelte';
  import InlineMoney from '../../lib/ui/InlineMoney.svelte';
  import InlineText from '../../lib/ui/InlineText.svelte';
  import { db, settings, uid } from '../../lib/store.svelte';
  import { finance, recordBalance } from '../../lib/finance.svelte';
  import { toast } from '../../lib/ui.svelte';
  import { money } from '../../lib/money';
  import { fmt, getDateLocale, parseISO, paychecksPerYear } from '../../lib/dates';
  import { ACCOUNT_KINDS } from '../../lib/constants';
  import { Plus, Trash2, Landmark, Coins, Bitcoin, Banknote, ChartLine, Wallet } from '../../lib/icons';
  import type { AccountKind } from '../../lib/types';

  const accounts = $derived([...db.accounts.items].sort((a, b) => a.order - b.order));
  const KIND_ICON = { savings: Landmark, cash: Banknote, invest: ChartLine, crypto: Bitcoin, other: Coins } as const;

  /** Rough monthly figure, rounded to the euro. */
  const perMonth = (perPay: number) => Math.round((perPay * paychecksPerYear(settings.v.payFrequency)) / 12 / 100) * 100;

  const scenarios = $derived.by(() => {
    const base = finance.savePerPay;
    const rows = [
      { label: 'Easy', perPay: Math.max(0, base - 10_000) },
      { label: 'Your plan', perPay: base, main: true },
      { label: 'Stretch', perPay: base + 10_000 },
    ];
    return rows.map((r) => ({ ...r, n: finance.paychecksFor(r.perPay), eta: finance.etaFor(r.perPay) }));
  });

  const series = $derived([
    {
      label: 'Saved',
      color: 'var(--c-money)',
      area: true,
      points: finance.history.map((b) => ({ x: parseISO(b.date).getTime(), y: b.total / 100 })),
    },
    {
      label: 'Plan',
      color: 'var(--series-1)',
      dashed: true,
      points: finance.projection.map((b) => ({ x: parseISO(b.date).getTime(), y: b.total / 100 })),
    },
  ]);

  const contributions = $derived([...db.contributions.items].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8));

  function addAccount() {
    db.accounts.add({
      id: uid(),
      name: 'New account',
      balance: 0,
      kind: 'savings',
      inGoal: true,
      order: accounts.reduce((m, a) => Math.max(m, a.order), -1) + 1,
    });
  }

  function removeAccount(id: string, name: string) {
    const r = db.accounts.remove(id);
    recordBalance();
    if (r)
      toast.undoable(`Removed ${name}`, () => {
        db.accounts.restore(r);
        recordBalance();
      });
  }

  function removeContribution(id: string) {
    const r = db.contributions.remove(id);
    if (!r) return;
    const acc = db.accounts.get(r.item.accountId);
    if (acc) db.accounts.update(acc.id, { balance: acc.balance - r.item.amount });
    recordBalance();
    toast.undoable(`Removed payday of ${money(r.item.amount)}`, () => {
      db.contributions.restore(r);
      const a = db.accounts.get(r.item.accountId);
      if (a) db.accounts.update(a.id, { balance: a.balance + r.item.amount });
      recordBalance();
    });
  }
</script>

<section class="card">
  <div class="stats">
    <Stat label="Saved towards goal" value={money(finance.goalTotal)} sub="{Math.floor(finance.progress * 100)}% of {money(finance.target)}" />
    <Stat label="Still to go" value={money(finance.remaining)} />
    <Stat label="Saving per payday" value={money(finance.savePerPay)} sub="≈ {money(perMonth(finance.savePerPay))} a month" />
    <Stat
      label="You get there"
      value={finance.eta ? fmt.roughly(finance.eta) : '—'}
      sub={finance.eta && finance.remaining > 0 ? `${finance.paychecksNeeded} paydays from now` : ''}
    />
  </div>
</section>

<div class="grid two">
  <section class="card">
    <div class="card-head">
      <h2>Progress to {money(finance.target)}</h2>
      <span class="sub">Saved so far, and the path at {money(finance.savePerPay)} per payday</span>
    </div>
    <LineChart
      {series}
      height="16rem"
      target={{ y: finance.target / 100, label: money(finance.target) }}
      yFormat={(v) => money(Math.round(v * 100), { compact: true })}
      xFormat={(x) => new Date(x).toLocaleDateString(getDateLocale(), { month: 'short', year: 'numeric' })}
      label="Savings progress and plan"
    />
  </section>

  <section class="card">
    <div class="card-head">
      <h2>Scenarios</h2>
      <span class="sub">Change your Savings line in the paycheck plan to switch</span>
    </div>
    <table class="tbl">
      <thead>
        <tr><th>Per payday</th><th>Per month</th><th>Paydays</th><th>Reach goal</th></tr>
      </thead>
      <tbody>
        {#each scenarios as s (s.label)}
          <tr class:main={s.main}>
            <td><span class="num">{money(s.perPay)}</span> <span class="faint xs">{s.label}</span></td>
            <td class="num">{money(perMonth(s.perPay))}</td>
            <td class="num">{Number.isFinite(s.n) ? s.n : '—'}</td>
            <td>{s.eta ? fmt.roughly(s.eta) : '—'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <div class="stack checkpoints">
      {#each finance.checkpoints as c (c.amount)}
        <div class="spread small">
          <span>Checkpoint {money(c.amount)}</span>
          <span class={c.reached ? 'ok' : 'muted'}>{c.reached ? 'Reached' : c.date ? `around ${fmt.roughly(c.date)}` : '—'}</span>
        </div>
      {/each}
    </div>
    <p class="xs faint">Any raise, bonus or tax refund that goes straight to savings pulls these dates forward.</p>
  </section>
</div>

<section class="card">
  <div class="card-head">
    <Wallet size={17} />
    <h2>Accounts</h2>
    <span class="sub">Click a name or balance to edit it</span>
    <div class="actions"><button class="btn sm" onclick={addAccount}><Plus size={15} /> Add account</button></div>
  </div>
  <div class="list">
    {#each accounts as a (a.id)}
      {@const Icon = KIND_ICON[a.kind]}
      <div class="list-row acc">
        <span class="kind-ico"><Icon size={16} /></span>
        <div class="grow"><InlineText value={a.name} label="Account name" onchange={(v) => v && db.accounts.update(a.id, { name: v })} /></div>
        <select
          class="select mini"
          aria-label="Account type"
          value={a.kind}
          onchange={(e) => db.accounts.update(a.id, { kind: (e.currentTarget as HTMLSelectElement).value as AccountKind })}
        >
          {#each ACCOUNT_KINDS as k (k.value)}<option value={k.value}>{k.label}</option>{/each}
        </select>
        <label class="check small in-goal" title="Counts towards {settings.v.goalName}">
          <input
            type="checkbox"
            checked={a.inGoal}
            onchange={(e) => {
              db.accounts.update(a.id, { inGoal: (e.currentTarget as HTMLInputElement).checked });
              recordBalance();
            }}
          />
          In goal
        </label>
        <InlineMoney
          value={a.balance}
          label="{a.name} balance"
          strong
          onchange={(c) => {
            db.accounts.update(a.id, { balance: c });
            recordBalance();
          }}
        />
        <button class="btn ghost icon sm row-actions" aria-label="Remove {a.name}" onclick={() => removeAccount(a.id, a.name)}>
          <Trash2 size={15} />
        </button>
      </div>
    {/each}
    <div class="list-row total">
      <span class="grow">Total towards goal</span>
      <span class="num strong">{money(finance.goalTotal)}</span>
      <span class="spacer"></span>
    </div>
    {#if finance.allTotal !== finance.goalTotal}
      <div class="list-row total muted small">
        <span class="grow">All accounts</span>
        <span class="num">{money(finance.allTotal)}</span>
        <span class="spacer"></span>
      </div>
    {/if}
  </div>
  {#if finance.goalTotal < settings.v.emergencyBuffer}
    <div class="callout">Keep about {money(settings.v.emergencyBuffer)} easy to reach as an emergency buffer.</div>
  {/if}
</section>

{#if contributions.length}
  <section class="card">
    <div class="card-head"><h2>Recent paydays</h2></div>
    <div class="list">
      {#each contributions as c (c.id)}
        <div class="list-row">
          <span class="grow">{fmt.short(c.date)}</span>
          <span class="muted small">{db.accounts.get(c.accountId)?.name ?? 'Deleted account'}</span>
          <span class="num ok">{money(c.amount, { sign: true })}</span>
          <button class="btn ghost icon sm row-actions" aria-label="Remove this payday" onclick={() => removeContribution(c.id)}>
            <Trash2 size={15} />
          </button>
        </div>
      {/each}
    </div>
  </section>
{/if}

<style>
  .stats {
    display: grid;
    gap: 1rem 1.5rem;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
  }
  .two {
    --min: 24rem;
  }
  .tbl {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--fs-sm);
  }
  .tbl th {
    text-align: left;
    font-weight: 560;
    color: var(--text-3);
    font-size: var(--fs-xs);
    padding: 0 0.5rem 0.5rem 0;
  }
  .tbl td {
    padding: 0.55rem 0.5rem 0.55rem 0;
    border-top: 1px solid var(--border);
    white-space: nowrap;
  }
  .tbl tr.main td {
    font-weight: 650;
    color: var(--text);
  }
  .tbl tr.main td:first-child {
    box-shadow: inset 3px 0 0 var(--c-money);
    padding-left: 0.625rem;
  }
  .checkpoints {
    gap: 0.35rem;
  }
  .acc {
    gap: 0.625rem;
  }
  .kind-ico {
    width: 2rem;
    height: 2rem;
    border-radius: var(--radius-sm);
    display: grid;
    place-items: center;
    background: var(--surface-2);
    color: var(--text-2);
    flex: none;
  }
  .select.mini {
    width: auto;
    height: 1.875rem;
    font-size: var(--fs-sm);
    padding-left: 0.5rem;
  }
  .in-goal {
    white-space: nowrap;
    color: var(--text-2);
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
  @container (max-width: 34rem) {
    .select.mini,
    .in-goal {
      display: none;
    }
  }
</style>
