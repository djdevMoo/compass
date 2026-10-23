<script lang="ts">
  import PageHeader from '../lib/ui/PageHeader.svelte';
  import Segmented from '../lib/ui/Segmented.svelte';
  import Meter from '../lib/ui/Meter.svelte';
  import Empty from '../lib/ui/Empty.svelte';
  import InlineText from '../lib/ui/InlineText.svelte';
  import { clock, db, settings, uid } from '../lib/store.svelte';
  import { finance } from '../lib/finance.svelte';
  import { toast, ui } from '../lib/ui.svelte';
  import { money } from '../lib/money';
  import { diffDays, fmt } from '../lib/dates';
  import { goalProgress } from '../lib/stats';
  import { AREAS, areaOf } from '../lib/constants';
  import { Mountain, Plus, Trash2, CirclePause, CirclePlay, CircleCheck, RotateCcw, X, Trophy } from '../lib/icons';
  import type { Area, Goal } from '../lib/types';

  type Status = Goal['status'];
  let status = $state<Status>('active');
  let area = $state<Area | 'all'>('all');

  const sorted = $derived([...db.goals.items].sort((a, b) => a.order - b.order));
  const count = (s: Status) => sorted.filter((g) => g.status === s).length;
  const areasUsed = $derived(AREAS.filter((a) => sorted.some((g) => g.area === a.value && g.status === status)));
  const shown = $derived(sorted.filter((g) => g.status === status && (area === 'all' || g.area === area)));

  $effect(() => {
    // Reset the area filter when it no longer matches anything.
    if (area !== 'all' && !areasUsed.some((a) => a.value === area)) area = 'all';
  });

  let drafts = $state<Record<string, string>>({});

  function addStep(g: Goal) {
    const text = (drafts[g.id] ?? '').trim();
    if (!text) return;
    db.goals.update(g.id, { milestones: [...g.milestones, { id: uid(), text, done: false }] });
    drafts[g.id] = '';
  }

  function setStep(g: Goal, id: string, patch: { done?: boolean; text?: string }) {
    db.goals.update(g.id, { milestones: g.milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  }

  function removeStep(g: Goal, id: string) {
    db.goals.update(g.id, { milestones: g.milestones.filter((m) => m.id !== id) });
  }

  function setStatus(g: Goal, s: Status) {
    const prev = g.status;
    db.goals.update(g.id, { status: s });
    const msg = s === 'done' ? `Done: ${g.title}. Well earned.` : s === 'paused' ? `Paused ${g.title}` : `${g.title} is active again`;
    toast.undoable(msg, () => db.goals.update(g.id, { status: prev }));
  }

  function remove(g: Goal) {
    const r = db.goals.remove(g.id);
    if (r) toast.undoable(`Deleted ${g.title}`, () => db.goals.restore(r));
  }

  function dueLabel(d: string): string {
    const n = diffDays(clock.today, d);
    if (n < 0) return `${-n} days overdue`;
    if (n === 0) return 'due today';
    if (n < 60) return `${n} days left`;
    return `about ${Math.round(n / 30)} months left`;
  }
</script>

<div class="page">
  <PageHeader title="Aspirations" subtitle="The bigger things you're working towards, broken into steps you can tick off." color="var(--c-goals)">
    {#snippet actions()}
      <button class="btn primary" onclick={() => ui.open('goal')}><Plus size={16} /> New aspiration</button>
    {/snippet}
  </PageHeader>

  <div class="row wrap filters">
    <Segmented
      bind:value={status}
      label="Status"
      options={[
        { value: 'active', label: 'Active', count: count('active') },
        { value: 'paused', label: 'Paused', count: count('paused') },
        { value: 'done', label: 'Done', count: count('done') },
      ]}
    />
    {#if areasUsed.length > 1}
      <div class="row wrap areas">
        <button class="chip filter" class:on={area === 'all'} onclick={() => (area = 'all')}>All</button>
        {#each areasUsed as a (a.value)}
          <button class="chip filter tint" class:on={area === a.value} style:--tint={a.color} onclick={() => (area = a.value)}>{a.label}</button>
        {/each}
      </div>
    {/if}
  </div>

  {#if shown.length === 0}
    <section class="card">
      {#if status === 'active'}
        <Empty icon={Mountain} title="No active aspirations" text="Add something you want to achieve: a fitness milestone, a skill, a trip." color="var(--c-goals)">
          <button class="btn primary sm" onclick={() => ui.open('goal')}>New aspiration</button>
        </Empty>
      {:else if status === 'done'}
        <Empty icon={Trophy} title="Nothing finished yet" text="Completed aspirations collect here." color="var(--c-goals)" />
      {:else}
        <Empty icon={CirclePause} title="Nothing paused" color="var(--c-goals)" />
      {/if}
    </section>
  {:else}
    <div class="grid" style="--min: 21rem">
      {#each shown as g (g.id)}
        {@const a = areaOf(g.area)}
        {@const prog = goalProgress(g, finance.progress)}
        {@const allDone = g.milestones.length > 0 && g.milestones.every((m) => m.done)}
        <article class="card goal" style:--tint={a.color}>
          <div class="spread">
            <select
              class="chip tint area-select"
              aria-label="Area"
              value={g.area}
              onchange={(e) => db.goals.update(g.id, { area: (e.currentTarget as HTMLSelectElement).value as Area })}
            >
              {#each AREAS as x (x.value)}<option value={x.value}>{x.label}</option>{/each}
            </select>
            <div class="row tools">
              {#if g.status === 'active'}
                <button class="btn ghost icon sm" title="Mark done" aria-label="Mark done" onclick={() => setStatus(g, 'done')}><CircleCheck size={16} /></button>
                <button class="btn ghost icon sm" title="Pause" aria-label="Pause" onclick={() => setStatus(g, 'paused')}><CirclePause size={16} /></button>
              {:else if g.status === 'paused'}
                <button class="btn ghost icon sm" title="Resume" aria-label="Resume" onclick={() => setStatus(g, 'active')}><CirclePlay size={16} /></button>
              {:else}
                <button class="btn ghost icon sm" title="Reopen" aria-label="Reopen" onclick={() => setStatus(g, 'active')}><RotateCcw size={16} /></button>
              {/if}
              <button class="btn ghost icon sm" title="Delete" aria-label="Delete" onclick={() => remove(g)}><Trash2 size={15} /></button>
            </div>
          </div>

          <div class="title">
            <InlineText value={g.title} label="Title" onchange={(v) => v && db.goals.update(g.id, { title: v })} />
          </div>
          <div class="why">
            <InlineText value={g.why} label="Why it matters" placeholder="Why it matters…" onchange={(v) => db.goals.update(g.id, { why: v })} />
          </div>

          <div class="stack prog">
            <div class="spread xs">
              <span class="muted">
                {#if g.linked === 'savings'}
                  {money(finance.goalTotal)} of {money(finance.target)} · from Money
                {:else if g.milestones.length}
                  {g.milestones.filter((m) => m.done).length} of {g.milestones.length} steps
                {:else}
                  No steps yet
                {/if}
              </span>
              <span class="num">{Math.round(prog * 100)}%</span>
            </div>
            <Meter value={prog} max={1} color={a.color} label="Progress" />
          </div>

          <div class="row date-row xs">
            <span class="faint">Target</span>
            <input
              class="date"
              type="date"
              aria-label="Target date"
              value={g.targetDate ?? ''}
              onchange={(e) => db.goals.update(g.id, { targetDate: (e.currentTarget as HTMLInputElement).value || null })}
            />
            {#if g.targetDate && g.status === 'active'}
              <span class:danger={g.targetDate < clock.today} class:faint={g.targetDate >= clock.today}>{dueLabel(g.targetDate)}</span>
            {/if}
          </div>

          <ul class="steps">
            {#each g.milestones as m (m.id)}
              <li class:done={m.done}>
                <input type="checkbox" checked={m.done} aria-label="Done" onchange={(e) => setStep(g, m.id, { done: (e.currentTarget as HTMLInputElement).checked })} />
                <div class="grow">
                  <InlineText value={m.text} label="Step" onchange={(v) => setStep(g, m.id, { text: v })} onempty={() => removeStep(g, m.id)} />
                </div>
                <button class="btn ghost icon sm del" aria-label="Remove step" onclick={() => removeStep(g, m.id)}><X size={14} /></button>
              </li>
            {/each}
          </ul>
          <form
            class="add-step"
            onsubmit={(e) => {
              e.preventDefault();
              addStep(g);
            }}
          >
            <Plus size={14} />
            <input class="inline-input" placeholder="Add a step" bind:value={drafts[g.id]} aria-label="New step" />
          </form>

          {#if allDone && g.status === 'active' && g.linked !== 'savings'}
            <div class="callout good">
              Every step is ticked. <button class="btn sm primary" onclick={() => setStatus(g, 'done')}>Mark as done</button>
            </div>
          {/if}
          {#if g.status === 'done'}<p class="xs ok">Completed</p>{/if}
          {#if g.linked === 'savings'}<p class="xs faint">Progress updates when you log paydays or change balances. Goal: {settings.v.goalName}.</p>{/if}
        </article>
      {/each}
    </div>
  {/if}
</div>

<style>
  .filters {
    gap: 0.75rem;
  }
  .areas {
    gap: 0.375rem;
  }
  .filter {
    border: 1px solid transparent;
    cursor: pointer;
    height: 1.75rem;
    padding: 0 0.75rem;
    font-size: var(--fs-xs);
  }
  .filter.on {
    border-color: var(--border-strong);
    color: var(--text);
  }
  .goal {
    gap: 0.625rem;
    border-top: 3px solid var(--tint);
  }
  .area-select {
    appearance: none;
    border: 0;
    cursor: pointer;
    font-family: inherit;
  }
  .area-select option {
    background: var(--surface);
    color: var(--text);
  }
  .tools {
    gap: 0;
    opacity: 0.6;
  }
  .goal:hover .tools,
  .goal:focus-within .tools {
    opacity: 1;
  }
  .title {
    font-size: var(--fs-lg);
    font-weight: 650;
  }
  .why {
    color: var(--text-2);
    font-size: var(--fs-sm);
    margin-top: -0.375rem;
  }
  .prog {
    gap: 0.35rem;
  }
  .date-row {
    gap: 0.5rem;
  }
  .date {
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-2);
    font: inherit;
    border-radius: var(--radius-xs);
    padding: 0.125rem 0.25rem;
  }
  .date:hover {
    border-color: var(--border);
  }
  .date::-webkit-calendar-picker-indicator {
    filter: invert(0.6);
  }
  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .steps li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .steps input[type='checkbox'] {
    width: 1rem;
    height: 1rem;
    accent-color: var(--tint);
    cursor: pointer;
    flex: none;
  }
  .steps li.done :global(.inline-input) {
    color: var(--text-3);
    text-decoration: line-through;
  }
  .del {
    opacity: 0;
  }
  .steps li:hover .del,
  .steps li:focus-within .del {
    opacity: 1;
  }
  .add-step {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--text-3);
    padding-left: 0.125rem;
  }
  .add-step .inline-input {
    font-size: var(--fs-sm);
  }
  .callout :global(.btn) {
    margin-left: auto;
  }
</style>
