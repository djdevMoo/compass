<script lang="ts">
  import PageHeader from '../lib/ui/PageHeader.svelte';
  import Stat from '../lib/ui/Stat.svelte';
  import Columns from '../lib/ui/Columns.svelte';
  import LineChart from '../lib/ui/LineChart.svelte';
  import Empty from '../lib/ui/Empty.svelte';
  import { clock, db, settings } from '../lib/store.svelte';
  import { toast, ui } from '../lib/ui.svelte';
  import { addDays, fmt, parseISO, weekStart } from '../lib/dates';
  import { sortedWeights, weekStreak, weightChange, workoutsInWeek } from '../lib/stats';
  import { WORKOUT_TYPES } from '../lib/constants';
  import { Dumbbell, Plus, Scale, Trash2, Flame } from '../lib/icons';
  import type { Workout, WorkoutType } from '../lib/types';

  const today = $derived(clock.today);
  const thisWeek = $derived(workoutsInWeek(db.workouts.items, today));
  const minutes = $derived(thisWeek.reduce((s, w) => s + w.minutes, 0));
  const streak = $derived(weekStreak(db.workouts.items, today, settings.v.workoutsPerWeek));
  const weights = $derived(sortedWeights(db.weights.items));
  const latest = $derived(weights[weights.length - 1]);
  const change = $derived(weightChange(db.weights.items, today));

  const TYPE_COLOR: Record<WorkoutType, string> = {
    strength: 'var(--c-fit)',
    cardio: 'var(--c-diet)',
    mobility: 'var(--c-goals)',
    sport: 'var(--c-money)',
    walk: 'var(--text-2)',
  };

  const weeks = $derived.by(() => {
    const start = weekStart(today);
    return Array.from({ length: 10 }, (_, i) => {
      const ws = addDays(start, -7 * (9 - i));
      const items = workoutsInWeek(db.workouts.items, ws);
      return {
        key: ws,
        label: fmt.day(ws),
        value: items.length,
        current: i === 9,
        tip: `Week of ${fmt.day(ws)} · ${items.reduce((s, w) => s + w.minutes, 0)} min`,
      };
    });
  });

  const grouped = $derived.by(() => {
    const sorted = [...db.workouts.items].sort((a, b) => (a.date < b.date ? 1 : -1));
    const groups: { week: string; items: Workout[] }[] = [];
    for (const w of sorted) {
      const ws = weekStart(w.date);
      let g = groups[groups.length - 1];
      if (!g || g.week !== ws) groups.push((g = { week: ws, items: [] }));
      g.items.push(w);
    }
    return groups.slice(0, 12);
  });

  const thisMonday = $derived(weekStart(today));
  const weekLabel = (ws: string) =>
    ws === thisMonday ? 'This week' : ws === addDays(thisMonday, -7) ? 'Last week' : `Week of ${fmt.day(ws)}`;

  function remove(w: Workout) {
    const r = db.workouts.remove(w.id);
    if (r) toast.undoable(`Removed ${w.title}`, () => db.workouts.restore(r));
  }

  function removeWeight(date: string) {
    const r = db.weights.remove(date);
    if (r) toast.undoable('Removed weight entry', () => db.weights.restore(r));
  }
</script>

<div class="page">
  <PageHeader title="Fitness" subtitle="Show up {settings.v.workoutsPerWeek}× a week. Track the trend, not the day." color="var(--c-fit)">
    {#snippet actions()}
      <button class="btn" onclick={() => ui.open('weight')}><Scale size={16} /> Log weight</button>
      <button class="btn primary" onclick={() => ui.open('workout')}><Plus size={16} /> Log workout</button>
    {/snippet}
  </PageHeader>

  <section class="card">
    <div class="stats">
      <Stat
        label="This week"
        value="{thisWeek.length} / {settings.v.workoutsPerWeek}"
        sub={thisWeek.length >= settings.v.workoutsPerWeek ? 'Target hit' : `${settings.v.workoutsPerWeek - thisWeek.length} to go`}
        tone={thisWeek.length >= settings.v.workoutsPerWeek ? 'ok' : ''}
      />
      <Stat label="Minutes this week" value={String(minutes)} />
      <Stat label="Week streak" value={String(streak)} sub={streak ? 'weeks on target in a row' : 'hit your target to start one'} />
      <Stat
        label="Weight"
        value={latest ? `${latest.kg} kg` : '—'}
        sub={change === null ? (latest ? fmt.relative(latest.date, today) : 'not logged yet') : `${change > 0 ? '+' : ''}${change} kg in 30 days`}
      />
    </div>
  </section>

  <div class="grid two">
    <section class="card">
      <div class="card-head"><Flame size={16} /><h2>Workouts per week</h2><span class="sub">Last 10 weeks</span></div>
      <Columns bars={weeks} color="var(--c-fit)" target={settings.v.workoutsPerWeek} label="Workouts per week" />
    </section>

    <section class="card">
      <div class="card-head">
        <Scale size={16} /><h2>Weight</h2>
        <div class="actions"><button class="btn ghost icon sm" aria-label="Log weight" onclick={() => ui.open('weight')}><Plus size={16} /></button></div>
      </div>
      {#if weights.length === 0}
        <Empty title="No weigh-ins yet" text="Log your weight now and then. The trend line appears after two entries." color="var(--c-fit)" />
      {:else}
        <LineChart
          series={[{ label: 'Weight', color: 'var(--c-fit)', points: weights.map((w) => ({ x: parseISO(w.date).getTime(), y: w.kg })) }]}
          zeroBased={false}
          height="10rem"
          yFormat={(v) => `${Math.round(v * 10) / 10} kg`}
          label="Weight over time"
        />
        <div class="row wrap recent-w">
          {#each weights.slice(-5).reverse() as w (w.id)}
            <span class="chip">
              {fmt.day(w.date)} · <b class="num">{w.kg}</b>
              <button class="x" aria-label="Remove {w.date} entry" onclick={() => removeWeight(w.id)}>×</button>
            </span>
          {/each}
        </div>
      {/if}
    </section>
  </div>

  <section class="card">
    <div class="card-head"><Dumbbell size={16} /><h2>Log</h2></div>
    {#if grouped.length === 0}
      <Empty icon={Dumbbell} title="No workouts yet" text="Log your first one. Even a 20-minute walk counts." color="var(--c-fit)">
        <button class="btn primary sm" onclick={() => ui.open('workout')}>Log workout</button>
      </Empty>
    {:else}
      <div class="weeks">
        {#each grouped as g (g.week)}
          <div>
            <div class="spread week-head">
              <span class="small muted">{weekLabel(g.week)}</span>
              <span class="xs faint num">{g.items.length} · {g.items.reduce((s, w) => s + w.minutes, 0)} min</span>
            </div>
            <div class="list">
              {#each g.items as w (w.id)}
                <div class="list-row">
                  <span class="type" style:--t={TYPE_COLOR[w.type]}>{WORKOUT_TYPES.find((t) => t.value === w.type)?.label}</span>
                  <div class="grow">
                    <div class="truncate">{w.title}</div>
                    {#if w.notes}<div class="xs faint truncate">{w.notes}</div>{/if}
                  </div>
                  <span class="effort" title="Effort {w.effort}/5">
                    {#each [1, 2, 3, 4, 5] as n (n)}<i class:on={n <= w.effort}></i>{/each}
                  </span>
                  <span class="num small mins">{w.minutes} min</span>
                  <span class="xs faint when">{fmt.short(w.date)}</span>
                  <button class="btn ghost icon sm row-actions" aria-label="Remove" onclick={() => remove(w)}><Trash2 size={14} /></button>
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
  .stats {
    display: grid;
    gap: 1rem 1.5rem;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
  }
  .two {
    --min: 22rem;
  }
  .recent-w {
    gap: 0.375rem;
  }
  .x {
    border: 0;
    background: none;
    color: var(--text-3);
    padding: 0 0 0 0.25rem;
    font-size: var(--fs-md);
    line-height: 1;
  }
  .x:hover {
    color: var(--danger);
  }
  .weeks {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .week-head {
    padding-bottom: 0.25rem;
    border-bottom: 1px solid var(--border);
  }
  .type {
    font-size: var(--fs-2xs);
    font-weight: 650;
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    color: color-mix(in srgb, var(--t) 80%, var(--text));
    background: color-mix(in srgb, var(--t) 15%, transparent);
    width: 4.75rem;
    text-align: center;
    flex: none;
  }
  .effort {
    display: flex;
    gap: 2px;
  }
  .effort i {
    width: 0.375rem;
    height: 0.75rem;
    border-radius: 2px;
    background: var(--surface-3);
  }
  .effort i.on {
    background: var(--c-fit);
  }
  .mins {
    min-width: 3.75rem;
    text-align: right;
  }
  .when {
    min-width: 5.5rem;
    text-align: right;
  }
  @container (max-width: 34rem) {
    .effort,
    .when {
      display: none;
    }
  }
</style>
