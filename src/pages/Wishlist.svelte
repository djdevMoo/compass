<script lang="ts">
  import PageHeader from '../lib/ui/PageHeader.svelte';
  import Segmented from '../lib/ui/Segmented.svelte';
  import Meter from '../lib/ui/Meter.svelte';
  import Empty from '../lib/ui/Empty.svelte';
  import Stat from '../lib/ui/Stat.svelte';
  import Modal from '../lib/ui/Modal.svelte';
  import MoneyInput from '../lib/ui/MoneyInput.svelte';
  import EnvelopePicker from '../forms/EnvelopePicker.svelte';
  import { clock, db, settings } from '../lib/store.svelte';
  import { addSpend, finance } from '../lib/finance.svelte';
  import { toast, ui } from '../lib/ui.svelte';
  import { desktop } from '../lib/db';
  import { money } from '../lib/money';
  import { countdown, getDateLocale, toISO } from '../lib/dates';
  import { ExternalLink, Gift, Hourglass, Plus, ShoppingBag, Trash2, RotateCcw, PartyPopper } from '../lib/icons';
  import type { Wish } from '../lib/types';

  type Tab = 'waiting' | 'bought' | 'dropped';
  let tab = $state<Tab>('waiting');

  const cooldownMs = $derived(settings.v.wishCooldownHours * 3_600_000);
  const waiting = $derived(
    db.wishes.items
      .filter((w) => w.status === 'waiting')
      .map((w) => {
        const elapsed = clock.now - Date.parse(w.addedAt);
        return { w, elapsed, readyIn: cooldownMs - elapsed, ready: elapsed >= cooldownMs };
      })
      .sort((a, b) => Number(b.ready) - Number(a.ready) || a.readyIn - b.readyIn),
  );
  const bought = $derived(sortDecided(db.wishes.items.filter((w) => w.status === 'bought')));
  const dropped = $derived(sortDecided(db.wishes.items.filter((w) => w.status === 'dropped')));
  const sum = (ws: Wish[]) => ws.reduce((s, w) => s + w.price, 0);

  const fun = $derived(settings.has('money') ? (finance.envelopes.find((e) => /fun/i.test(e.line.name)) ?? null) : null);

  function sortDecided(ws: Wish[]) {
    return [...ws].sort((a, b) => ((a.decidedAt ?? '') < (b.decidedAt ?? '') ? 1 : -1));
  }

  // Buying
  let buying = $state<Wish | null>(null);
  let buyPrice = $state<number | null>(null);
  let buyEnvelope = $state('');
  let logSpend = $state(true);

  function startBuy(w: Wish) {
    buying = w;
    buyPrice = w.price;
    buyEnvelope = fun?.line.id ?? finance.envelopes.find((e) => e.line.kind === 'flex')?.line.id ?? '';
    logSpend = settings.has('money');
  }

  function confirmBuy(e: SubmitEvent) {
    e.preventDefault();
    const w = buying;
    if (!w) return;
    const price = buyPrice ?? w.price;
    db.wishes.update(w.id, { status: 'bought', decidedAt: new Date().toISOString(), price });
    const spend = logSpend && price > 0 ? addSpend(price, buyEnvelope || null, w.name, toISO(new Date())) : null;
    buying = null;
    toast.undoable(`Enjoy ${w.name}!`, () => {
      db.wishes.update(w.id, { status: 'waiting', decidedAt: null, price: w.price });
      if (spend) db.spends.remove(spend.id);
    });
  }

  function drop(w: Wish) {
    db.wishes.update(w.id, { status: 'dropped', decidedAt: new Date().toISOString() });
    toast.undoable(w.price > 0 ? `Dropped. That's ${money(w.price)} not spent.` : 'Dropped.', () =>
      db.wishes.update(w.id, { status: 'waiting', decidedAt: null }),
    );
  }

  function restore(w: Wish) {
    // Back on the list starts a fresh wait.
    db.wishes.update(w.id, { status: 'waiting', decidedAt: null, addedAt: new Date().toISOString() });
    toast.show(`${w.name} is back on the list`);
  }

  function remove(w: Wish) {
    const r = db.wishes.remove(w.id);
    if (r) toast.undoable(`Deleted ${w.name}`, () => db.wishes.restore(r));
  }

  function open(url: string) {
    if (desktop) void desktop.openExternal(url);
    else window.open(url, '_blank', 'noopener');
  }
</script>

<div class="page">
  <PageHeader
    title="Wishlist"
    subtitle="Anything you want goes here first. If you still want it after {settings.v.wishCooldownHours} hours{settings.has('money') ? ' and it fits your Fun money' : ''}, buy it."
    color="var(--c-wish)"
  >
    {#snippet actions()}
      <button class="btn primary" onclick={() => ui.open('wish')}><Plus size={16} /> Add to wishlist</button>
    {/snippet}
  </PageHeader>

  <section class="card">
    <div class="stats">
      <Stat label="Waiting" value={money(sum(waiting.map((x) => x.w)))} sub="{waiting.length} item{waiting.length === 1 ? '' : 's'}" />
      <Stat label="Ready to decide" value={String(waiting.filter((x) => x.ready).length)} />
      {#if fun}<Stat label="Fun money left" value={money(fun.left)} sub="this pay period" tone={fun.left < 0 ? 'danger' : ''} />{/if}
      <Stat label="Not spent thanks to waiting" value={money(sum(dropped))} sub="{dropped.length} dropped" />
    </div>
  </section>

  <Segmented
    bind:value={tab}
    label="Wishlist"
    options={[
      { value: 'waiting', label: 'Waiting', count: waiting.length },
      { value: 'bought', label: 'Bought', count: bought.length },
      { value: 'dropped', label: 'Dropped', count: dropped.length },
    ]}
  />

  {#if tab === 'waiting'}
    {#if waiting.length === 0}
      <section class="card">
        <Empty icon={Gift} title="Nothing on the list" text="Next time you want a game, gadget or anything else, add it here instead of buying it on the spot." color="var(--c-wish)">
          <button class="btn primary sm" onclick={() => ui.open('wish')}>Add something</button>
        </Empty>
      </section>
    {:else}
      <div class="grid" style="--min: 17rem">
        {#each waiting as { w, elapsed, readyIn, ready } (w.id)}
          <article class="card wish" class:ready>
            <div class="spread">
              <span class="chip">{w.category}</span>
              {#if ready}
                <span class="chip tint" style:--tint="var(--c-wish)">Ready to decide</span>
              {:else}
                <span class="chip"><Hourglass size={11} /> {countdown(readyIn)}</span>
              {/if}
            </div>
            <div class="title-row">
              <h3>{w.name}</h3>
              {#if w.url}
                <button class="btn ghost icon sm" aria-label="Open link" title={w.url} onclick={() => open(w.url)}><ExternalLink size={15} /></button>
              {/if}
            </div>
            <span class="price num">{money(w.price)}</span>
            {#if w.note}<p class="small muted">{w.note}</p>{/if}
            {#if !ready}
              <Meter value={elapsed} max={cooldownMs} color="var(--c-wish)" label="Waiting time" />
            {/if}
            {#if fun && w.price > 0}
              <p class="xs" class:ok={w.price <= fun.left} class:warn={w.price > fun.left}>
                {w.price <= fun.left ? `Fits your Fun money (${money(fun.left)} left)` : `${money(w.price - Math.max(0, fun.left))} more than your Fun money left`}
              </p>
            {/if}
            <div class="row actions">
              <button class="btn sm primary" disabled={!ready} title={ready ? '' : 'Still waiting'} onclick={() => startBuy(w)}>
                <ShoppingBag size={14} /> Buy it
              </button>
              <button class="btn sm" onclick={() => drop(w)}>Don't need it</button>
              <button class="btn ghost icon sm" aria-label="Delete" onclick={() => remove(w)}><Trash2 size={14} /></button>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  {:else}
    {@const list = tab === 'bought' ? bought : dropped}
    <section class="card">
      {#if list.length === 0}
        <Empty
          icon={tab === 'bought' ? ShoppingBag : PartyPopper}
          title={tab === 'bought' ? 'Nothing bought yet' : 'Nothing dropped yet'}
          text={tab === 'bought' ? 'Things you decide to buy after the wait show up here.' : 'Every want you let go of shows up here, with the money it saved.'}
          color="var(--c-wish)"
        />
      {:else}
        <div class="list">
          {#each list as w (w.id)}
            <div class="list-row">
              <span class="chip">{w.category}</span>
              <span class="grow truncate">{w.name}</span>
              <span class="xs faint">{w.decidedAt ? new Date(w.decidedAt).toLocaleDateString(getDateLocale(), { day: 'numeric', month: 'short' }) : ''}</span>
              <span class="num amt" class:ok={tab === 'dropped'}>{money(w.price)}</span>
              <div class="row row-actions">
                <button class="btn ghost icon sm" aria-label="Put back on the list" title="Put back on the list" onclick={() => restore(w)}><RotateCcw size={14} /></button>
                <button class="btn ghost icon sm" aria-label="Delete" onclick={() => remove(w)}><Trash2 size={14} /></button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</div>

<Modal bind:open={() => buying !== null, (v) => !v && (buying = null)} title="Buy {buying?.name ?? ''}" subtitle="You waited. Nice. Log it so your Fun money stays honest.">
  <form class="stack" onsubmit={confirmBuy}>
    <label class="field">
      <span>Price paid</span>
      <MoneyInput bind:value={buyPrice} />
    </label>
    {#if settings.has('money')}<label class="check"><input type="checkbox" bind:checked={logSpend} /> Log it as a spend</label>{/if}
    {#if logSpend && settings.has('money')}
      <div class="field">
        <span class="label">Comes out of</span>
        <EnvelopePicker bind:value={buyEnvelope} />
      </div>
    {/if}
    <div class="form-actions">
      <button type="button" class="btn ghost" onclick={() => (buying = null)}>Cancel</button>
      <button type="submit" class="btn primary">Bought it</button>
    </div>
  </form>
</Modal>

<style>
  .stats {
    display: grid;
    gap: 1rem 1.5rem;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
  }
  .wish {
    gap: 0.625rem;
  }
  .wish.ready {
    border-color: color-mix(in srgb, var(--c-wish) 45%, var(--border));
  }
  .title-row {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }
  .title-row h3 {
    flex: 1;
    font-size: var(--fs-lg);
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .price {
    font-size: var(--fs-xl);
    font-weight: 680;
  }
  .actions {
    margin-top: auto;
    padding-top: 0.25rem;
  }
  .amt {
    font-weight: 600;
    min-width: 4.5rem;
    text-align: right;
  }
</style>
