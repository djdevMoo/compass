<script lang="ts">
  import PageHeader from '../lib/ui/PageHeader.svelte';
  import Meter from '../lib/ui/Meter.svelte';
  import Water from '../lib/ui/Water.svelte';
  import Columns from '../lib/ui/Columns.svelte';
  import { clock, db, settings } from '../lib/store.svelte';
  import { finance } from '../lib/finance.svelte';
  import { toast, ui } from '../lib/ui.svelte';
  import { addDays, fmt } from '../lib/dates';
  import { money } from '../lib/money';
  import { dayTotals } from '../lib/stats';
  import { MEAL_SLOTS } from '../lib/constants';
  import { ChevronLeft, ChevronRight, Plus, Trash2, Pizza, Utensils, Coffee, Salad } from '../lib/icons';
  import type { Meal, MealSlot } from '../lib/types';

  let date = $state(clock.today);
  const isToday = $derived(date === clock.today);

  const totals = $derived(dayTotals(db.meals.items, date));
  const meals = $derived(db.meals.items.filter((m) => m.date === date));
  const bySlot = (s: MealSlot) => meals.filter((m) => m.slot === s);

  const SLOT_ICON = { breakfast: Coffee, lunch: Salad, dinner: Utensils, snack: Pizza } as const;

  const week = $derived(
    Array.from({ length: 7 }, (_, i) => {
      const d = addDays(date, i - 6);
      const t = dayTotals(db.meals.items, d);
      return {
        key: d,
        label: fmt.weekday(d),
        value: t.kcal,
        current: d === date,
        tip: `${fmt.short(d)} · ${t.protein} g protein`,
      };
    }),
  );
  const weekAvg = $derived.by(() => {
    const logged = week.filter((d) => d.value > 0);
    return logged.length ? Math.round(logged.reduce((s, d) => s + d.value, 0) / logged.length) : 0;
  });

  const takeoutLeft = $derived(settings.v.takeoutCap - finance.takeoutsThisPeriod);

  function remove(m: Meal) {
    const r = db.meals.remove(m.id);
    if (r) toast.undoable(`Removed ${m.name}`, () => db.meals.restore(r));
  }

  function toggleTakeout(m: Meal) {
    db.meals.update(m.id, { takeout: !m.takeout });
  }
</script>

<div class="page">
  <PageHeader title="Diet" subtitle="Hit your protein, drink your water, keep takeout to {settings.v.takeoutCap} {settings.has('money') ? 'per paycheck' : 'a week'}." color="var(--c-diet)">
    {#snippet actions()}
      <button class="btn primary" onclick={() => ui.open('meal', { date })}><Plus size={16} /> Log meal</button>
    {/snippet}
  </PageHeader>

  <div class="row datebar">
    <button class="btn icon" aria-label="Previous day" onclick={() => (date = addDays(date, -1))}><ChevronLeft size={18} /></button>
    <div class="date-label">
      <b>{isToday ? 'Today' : date === addDays(clock.today, -1) ? 'Yesterday' : fmt.short(date)}</b>
      <span class="faint small">{fmt.long(date)}</span>
    </div>
    <button class="btn icon" aria-label="Next day" disabled={isToday} onclick={() => (date = addDays(date, 1))}><ChevronRight size={18} /></button>
    {#if !isToday}<button class="btn ghost sm" onclick={() => (date = clock.today)}>Back to today</button>{/if}
  </div>

  <div class="layout">
    <div class="stack main-col">
      {#each MEAL_SLOTS as s (s.value)}
        {@const list = bySlot(s.value)}
        {@const Icon = SLOT_ICON[s.value]}
        <section class="card slot">
          <div class="card-head">
            <Icon size={16} />
            <h2>{s.label}</h2>
            {#if list.length}
              <span class="sub num">{list.reduce((a, m) => a + m.kcal, 0)} kcal · {list.reduce((a, m) => a + m.protein, 0)} g</span>
            {/if}
            <div class="actions">
              <button class="btn ghost sm" onclick={() => ui.open('meal', { date, slot: s.value })}><Plus size={15} /> Add</button>
            </div>
          </div>
          {#if list.length}
            <div class="list">
              {#each list as m (m.id)}
                <div class="list-row">
                  <span class="grow truncate">{m.name}</span>
                  <button
                    class="chip takeout"
                    class:tint={m.takeout}
                    style:--tint="var(--c-diet)"
                    title={m.takeout ? 'Takeout (click to unmark)' : 'Mark as takeout'}
                    onclick={() => toggleTakeout(m)}><Pizza size={11} />{m.takeout ? 'Takeout' : ''}</button
                  >
                  <span class="num small kc">{m.kcal} kcal</span>
                  <span class="num small pr">{m.protein} g</span>
                  <button class="btn ghost icon sm row-actions" aria-label="Remove" onclick={() => remove(m)}><Trash2 size={14} /></button>
                </div>
              {/each}
            </div>
          {/if}
        </section>
      {/each}
    </div>

    <div class="stack side">
      <section class="card">
        <div class="card-head"><h2>{isToday ? 'Today' : fmt.short(date)}</h2></div>
        <div class="stack">
          <div class="spread small"><span>Calories</span><span class="num muted">{totals.kcal} / {settings.v.kcalTarget}</span></div>
          <Meter value={totals.kcal} max={settings.v.kcalTarget} color="var(--c-diet)" auto warnAt={1} overColor="var(--warn)" height={0.5} label="Calories" />
        </div>
        <div class="stack">
          <div class="spread small"><span>Protein</span><span class="num muted">{totals.protein} / {settings.v.proteinTarget} g</span></div>
          <Meter value={totals.protein} max={settings.v.proteinTarget} color="var(--c-fit)" height={0.5} label="Protein" />
        </div>
        <Water {date} />
      </section>

      <section class="card">
        <div class="card-head"><Pizza size={16} /><h2>Takeout {finance.takeoutWindow.label}</h2></div>
        <div class="spread">
          <span class="lead num">{finance.takeoutsThisPeriod} / {settings.v.takeoutCap}</span>
          <span class="small" class:ok={takeoutLeft > 0} class:danger={takeoutLeft < 0} class:muted={takeoutLeft === 0}>
            {takeoutLeft > 0 ? `${takeoutLeft} left` : takeoutLeft === 0 ? 'cap reached' : `${-takeoutLeft} over`}
          </span>
        </div>
        <Meter value={finance.takeoutsThisPeriod} max={Math.max(1, settings.v.takeoutCap)} color="var(--c-diet)" auto warnAt={1} label="Takeouts used" />
        {#if settings.has('money')}<p class="xs faint">Paid from Fun. Each takeout you skip is about {money(1500)} you can move to savings.</p>{/if}
      </section>

      <section class="card">
        <div class="card-head"><h2>Last 7 days</h2><span class="sub num">avg {weekAvg} kcal</span></div>
        <Columns bars={week} color="var(--c-diet)" target={settings.v.kcalTarget} format={(v) => `${v}`} label="Calories per day" />
      </section>
    </div>
  </div>
</div>

<style>
  .datebar {
    gap: 0.75rem;
  }
  .date-label {
    display: flex;
    flex-direction: column;
    min-width: 9rem;
    text-align: center;
    line-height: 1.25;
  }
  .layout {
    display: grid;
    gap: 1rem;
    grid-template-columns: minmax(0, 1fr) minmax(17rem, 24rem);
    align-items: start;
  }
  @media (max-width: 1000px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
    .side {
      order: -1;
    }
  }
  .main-col,
  .side {
    gap: 1rem;
  }
  .slot {
    gap: 0.5rem;
  }
  .lead {
    font-size: var(--fs-xl);
    font-weight: 680;
  }
  .takeout {
    border: 0;
    cursor: pointer;
    opacity: 0.35;
  }
  .takeout.tint {
    opacity: 1;
  }
  .list-row:hover .takeout {
    opacity: 1;
  }
  .kc {
    min-width: 4.75rem;
    text-align: right;
  }
  .pr {
    min-width: 3rem;
    text-align: right;
    color: var(--text-2);
  }
</style>
