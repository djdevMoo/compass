<script lang="ts">
  import Segmented from '../../lib/ui/Segmented.svelte';
  import Meter from '../../lib/ui/Meter.svelte';
  import Empty from '../../lib/ui/Empty.svelte';
  import { db } from '../../lib/store.svelte';
  import { finance } from '../../lib/finance.svelte';
  import { toast, ui } from '../../lib/ui.svelte';
  import { money } from '../../lib/money';
  import { addDays, diffDays, fmt } from '../../lib/dates';
  import { Plus, Receipt, Trash2 } from '../../lib/icons';
  import type { Spend } from '../../lib/types';

  type Range = 'current' | 'previous' | 'all';
  let range = $state<Range>('current');
  let envFilter = $state<string | null>(null);

  const p = $derived(finance.period);
  const bounds = $derived.by(() => {
    if (range === 'current') return { start: p.start, end: p.next };
    if (range === 'previous') {
      // The pay period before this one has the same length as this one.
      const len = diffDays(p.start, p.next);
      return { start: addDays(p.start, -len), end: p.start };
    }
    return { start: '0000-01-01', end: '9999-12-31' };
  });

  const inRange = $derived(db.spends.items.filter((s) => s.date >= bounds.start && s.date < bounds.end));
  const shown = $derived(
    inRange
      .filter((s) => !envFilter || s.budgetId === envFilter)
      .sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1)),
  );
  const total = $derived(shown.reduce((s, x) => s + x.amount, 0));

  const byDay = $derived.by(() => {
    const groups: { date: string; items: Spend[]; total: number }[] = [];
    for (const s of shown) {
      let g = groups[groups.length - 1];
      if (!g || g.date !== s.date) groups.push((g = { date: s.date, items: [], total: 0 }));
      g.items.push(s);
      g.total += s.amount;
    }
    return groups;
  });

  const byEnvelope = $derived.by(() => {
    const m = new Map<string, number>();
    for (const s of inRange) m.set(s.budgetId ?? '', (m.get(s.budgetId ?? '') ?? 0) + s.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  });

  const lineName = (id: string | null) => (id ? (db.budget.get(id)?.name ?? 'Removed') : 'Unsorted');

  function remove(s: Spend) {
    const r = db.spends.remove(s.id);
    if (r) toast.undoable(`Removed ${money(s.amount)}`, () => db.spends.restore(r));
  }
</script>

<div class="row wrap toolbar">
  <Segmented
    bind:value={range}
    size="sm"
    label="Period"
    options={[
      { value: 'current', label: 'This pay period' },
      { value: 'previous', label: 'Last pay period' },
      { value: 'all', label: 'All time' },
    ]}
  />
  <span class="grow"></span>
  <span class="muted small">
    {#if range !== 'all'}{fmt.day(bounds.start)} – {fmt.day(addDays(bounds.end, -1))} ·{/if}
    <b class="num">{money(total)}</b> spent
  </span>
  <button class="btn sm primary" onclick={() => ui.open('spend', envFilter ? { budgetId: envFilter } : {})}><Plus size={15} /> Log spend</button>
</div>

<div class="layout">
  <section class="card envs">
    <div class="card-head">
      <h2>{range === 'current' ? 'Envelopes' : 'By envelope'}</h2>
      {#if envFilter}<button class="btn ghost sm" onclick={() => (envFilter = null)}>Show all</button>{/if}
    </div>
    {#if range === 'current'}
      {#each finance.envelopes as e (e.line.id)}
        <button class="env" class:on={envFilter === e.line.id} onclick={() => (envFilter = envFilter === e.line.id ? null : e.line.id)}>
          <div class="spread small">
            <span>{e.line.name}</span>
            <span class="num muted">{money(e.spent)} / {money(e.line.amount)}</span>
          </div>
          <Meter value={e.spent} max={e.line.amount} auto label="{e.line.name} used" />
          <span class="xs num" class:danger={e.left < 0} class:faint={e.left >= 0}>
            {e.left < 0 ? `${money(-e.left)} over` : `${money(e.left)} left`}
          </span>
        </button>
      {/each}
    {:else if byEnvelope.length === 0}
      <p class="small muted">No spending in this range.</p>
    {:else}
      {#each byEnvelope as [id, amt] (id)}
        <button class="env" class:on={envFilter === (id || null)} onclick={() => (envFilter = envFilter === id ? null : id || null)}>
          <div class="spread small"><span>{lineName(id || null)}</span><span class="num">{money(amt)}</span></div>
          <Meter value={amt} max={byEnvelope[0][1]} color="var(--c-money)" label={lineName(id || null)} />
        </button>
      {/each}
    {/if}
  </section>

  <section class="card">
    <div class="card-head">
      <h2>{envFilter ? lineName(envFilter) : 'Every spend'}</h2>
      <span class="sub">{shown.length} item{shown.length === 1 ? '' : 's'}</span>
    </div>
    {#if byDay.length === 0}
      <Empty icon={Receipt} title="Nothing logged here yet" text="Log spends as they happen (Ctrl+E) to see where each envelope is going." color="var(--c-money)">
        <button class="btn primary sm" onclick={() => ui.open('spend')}>Log a spend</button>
      </Empty>
    {:else}
      <div class="days">
        {#each byDay as g (g.date)}
          <div class="day">
            <div class="spread day-head">
              <span class="small muted">{fmt.short(g.date)}</span>
              <span class="small num faint">{money(g.total)}</span>
            </div>
            <div class="list">
              {#each g.items as s (s.id)}
                <div class="list-row">
                  <span class="grow truncate">{s.note || lineName(s.budgetId)}</span>
                  {#if s.note}<span class="chip">{lineName(s.budgetId)}</span>{/if}
                  <span class="num amt">{money(s.amount)}</span>
                  <button class="btn ghost icon sm row-actions" aria-label="Remove" onclick={() => remove(s)}><Trash2 size={15} /></button>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .toolbar {
    gap: 0.75rem;
  }
  .layout {
    display: grid;
    gap: 1rem;
    grid-template-columns: minmax(16rem, 22rem) minmax(0, 1fr);
    align-items: start;
  }
  @media (max-width: 1100px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .envs {
    gap: 0.25rem;
  }
  .env {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.625rem;
    margin: 0 -0.625rem;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    text-align: left;
  }
  .env:hover {
    background: var(--hover);
  }
  .env.on {
    background: var(--active);
  }
  .days {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .day-head {
    padding-bottom: 0.25rem;
    border-bottom: 1px solid var(--border);
  }
  .amt {
    font-weight: 600;
    min-width: 4.5rem;
    text-align: right;
  }
</style>
