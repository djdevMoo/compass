<script lang="ts">
  import Stat from '../../lib/ui/Stat.svelte';
  import InlineMoney from '../../lib/ui/InlineMoney.svelte';
  import InlineText from '../../lib/ui/InlineText.svelte';
  import { db, uid } from '../../lib/store.svelte';
  import { finance } from '../../lib/finance.svelte';
  import { toast } from '../../lib/ui.svelte';
  import { money } from '../../lib/money';
  import { Plus, Trash2, Sparkles } from '../../lib/icons';
  import type { Bill } from '../../lib/types';

  const bills = $derived([...db.bills.items].sort((a, b) => a.order - b.order));
  const active = $derived(bills.filter((b) => b.active));
  const biggest = $derived([...active].sort((a, b) => b.monthly - a.monthly)[0]);

  // YouTube Premium already includes YouTube Music, so paying for Spotify too is paying twice.
  const music = $derived.by(() => {
    const yt = active.find((b) => /youtube/i.test(b.name) && /premium/i.test(b.name));
    const other = active.find((b) => /spotify|apple music|tidal|deezer/i.test(b.name));
    return yt && other ? { yt, other } : null;
  });

  function add() {
    db.bills.add({
      id: uid(),
      name: 'New bill',
      monthly: 0,
      note: '',
      active: true,
      order: bills.reduce((m, b) => Math.max(m, b.order), -1) + 1,
    });
  }

  function remove(b: Bill) {
    const r = db.bills.remove(b.id);
    if (r) toast.undoable(`Removed ${b.name}`, () => db.bills.restore(r));
  }
</script>

<section class="card">
  <div class="stats">
    <Stat label="Monthly" value={money(finance.billsMonthly)} sub="{active.length} active" />
    <Stat label="Per paycheck" value={money(finance.billsPerPay)} />
    <Stat label="Per year" value={money(finance.billsMonthly * 12)} />
  </div>
</section>

{#if music || biggest}
  <section class="card tips">
    <div class="card-head"><Sparkles size={16} /><h2>Quick wins</h2></div>
    {#if music}
      <p class="small">
        {music.yt.name} already includes YouTube Music, so you are paying twice for music. Dropping {music.other.name}
        saves <b class="num">{money(music.other.monthly)}</b> a month
        (<span class="num">{money(music.other.monthly * 12)}</span> a year).
      </p>
    {/if}
    {#if biggest && biggest.monthly >= 3000}
      <p class="small">
        {biggest.name} ({money(biggest.monthly)}) is your biggest bill. It is worth a look for a cheaper plan.
      </p>
    {/if}
  </section>
{/if}

<section class="card">
  <div class="card-head">
    <h2>Bills and subscriptions</h2>
    <span class="sub">Your share, per month. Untick to pause one without deleting it.</span>
    <div class="actions"><button class="btn sm" onclick={add}><Plus size={15} /> Add bill</button></div>
  </div>
  <div class="list">
    {#each bills as b (b.id)}
      <div class="list-row" class:off={!b.active}>
        <input
          type="checkbox"
          class="tick"
          checked={b.active}
          aria-label="{b.name} active"
          onchange={(e) => db.bills.update(b.id, { active: (e.currentTarget as HTMLInputElement).checked })}
        />
        <div class="name-col">
          <InlineText value={b.name} label="Bill name" onchange={(v) => v && db.bills.update(b.id, { name: v })} />
          <InlineText value={b.note} label="Note" placeholder="Add a note" onchange={(v) => db.bills.update(b.id, { note: v })} />
        </div>
        <InlineMoney value={b.monthly} label="{b.name} per month" strong onchange={(c) => db.bills.update(b.id, { monthly: c })} />
        <button class="btn ghost icon sm row-actions" aria-label="Remove {b.name}" onclick={() => remove(b)}><Trash2 size={15} /></button>
      </div>
    {/each}
  </div>
</section>

<style>
  .stats {
    display: grid;
    gap: 1rem 1.5rem;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr));
  }
  .tips {
    border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
  }
  .tips :global(svg) {
    color: var(--accent);
  }
  .tick {
    width: 1.05rem;
    height: 1.05rem;
    accent-color: var(--accent);
    cursor: pointer;
    flex: none;
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
  .off {
    opacity: 0.5;
  }
</style>
