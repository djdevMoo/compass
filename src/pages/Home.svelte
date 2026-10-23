<script lang="ts">
  import PageHeader from '../lib/ui/PageHeader.svelte';
  import Ring from '../lib/ui/Ring.svelte';
  import Meter from '../lib/ui/Meter.svelte';
  import Water from '../lib/ui/Water.svelte';
  import { clock, db, settings } from '../lib/store.svelte';
  import { finance } from '../lib/finance.svelte';
  import { ui } from '../lib/ui.svelte';
  import { money } from '../lib/money';
  import { countdown, fmt, greeting, parseISO } from '../lib/dates';
  import { dayTotals, goalProgress, weekDates, workoutsInWeek } from '../lib/stats';
  import { areaOf } from '../lib/constants';
  import {
    ArrowRight, CalendarClock, Dumbbell, Gift, Mountain, PiggyBank, Plus, Receipt, Utensils, Pizza, Hourglass, Check,
  } from '../lib/icons';

  const today = $derived(clock.today);
  const hello = $derived(greeting(new Date(clock.now)) + (settings.v.name ? `, ${settings.v.name}` : ''));

  // Money
  const p = $derived(finance.period);
  const flex = $derived(finance.envelopes.filter((e) => e.line.kind === 'flex'));

  // Diet
  const totals = $derived(dayTotals(db.meals.items, today));

  // Fitness
  const week = $derived(weekDates(today));
  const thisWeek = $derived(workoutsInWeek(db.workouts.items, today));
  const workoutDays = $derived(new Set(thisWeek.map((w) => w.date)));
  const weekMinutes = $derived(thisWeek.reduce((s, w) => s + w.minutes, 0));
  const lastWorkout = $derived([...db.workouts.items].sort((a, b) => (a.date < b.date ? 1 : -1))[0]);

  // Wishlist
  const cooldownMs = $derived(settings.v.wishCooldownHours * 3_600_000);
  const waiting = $derived(
    db.wishes.items
      .filter((w) => w.status === 'waiting')
      .map((w) => ({ w, readyIn: Date.parse(w.addedAt) + cooldownMs - clock.now }))
      .sort((a, b) => a.readyIn - b.readyIn),
  );
  const notSpent = $derived(db.wishes.items.filter((w) => w.status === 'dropped').reduce((s, w) => s + w.price, 0));

  // Goals
  const activeGoals = $derived(
    db.goals.items.filter((g) => g.status === 'active').sort((a, b) => a.order - b.order).slice(0, 4),
  );

  const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
</script>

<div class="page">
  <PageHeader title={hello} subtitle={fmt.long(today)}>
    {#snippet actions()}
      {#if settings.has('money')}<button class="btn" onclick={() => ui.open('spend')}><Receipt size={16} /> Log spend</button>{/if}
      {#if settings.has('diet')}<button class="btn" onclick={() => ui.open('meal')}><Utensils size={16} /> Log meal</button>{/if}
      {#if settings.has('fitness')}<button class="btn" onclick={() => ui.open('workout')}><Dumbbell size={16} /> Log workout</button>{/if}
    {/snippet}
  </PageHeader>

  <div class="dash grid">
    {#if settings.has('money')}
    <!-- Savings goal -->
    <section class="card hero" style:--tint="var(--c-money)">
      <div class="hero-body">
        <Ring value={finance.progress} size="clamp(7rem, 5rem + 6vw, 9.5rem)" color="var(--c-money)">
          <div class="ring-label">
            <span class="pct num">{Math.floor(finance.progress * 100)}%</span>
            <span class="faint xs">of goal</span>
          </div>
        </Ring>
        <div class="hero-text">
          <span class="eyebrow">{settings.v.goalName}</span>
          <span class="big num">{money(finance.goalTotal)}</span>
          <span class="muted">
            of {money(finance.target)} ·
            {#if finance.remaining > 0}<b class="num">{money(finance.remaining)}</b> to go{:else}<b class="ok">goal reached</b>{/if}
          </span>
          {#if finance.remaining > 0}
            {#if finance.eta}
              <p class="eta">
                At <b class="num">{money(finance.savePerPay)}</b> per payday you get there around
                <b>{fmt.roughly(finance.eta)}</b>
                <span class="faint">({finance.paychecksNeeded} paydays)</span>.
              </p>
            {:else}
              <p class="eta warn">Add a Savings line to your paycheck plan to see when you'll get there.</p>
            {/if}
          {/if}
        </div>
      </div>
      <div class="journey" aria-label="Checkpoints on the way to {money(finance.target)}">
        <div class="track">
          <div class="fill" style:width="{finance.progress * 100}%"></div>
          {#each finance.checkpoints as c (c.amount)}
            <span class="tick" class:reached={c.reached} style:left="{(c.amount / finance.target) * 100}%"></span>
          {/each}
        </div>
        <div class="marks">
          {#each finance.checkpoints as c (c.amount)}
            <span class="mark" style:left="{(c.amount / finance.target) * 100}%">
              <b class="num">{#if c.reached}<Check size={11} />{/if}{money(c.amount)}</b>
              <span>{c.reached ? 'reached' : c.date ? fmt.roughly(c.date) : ''}</span>
            </span>
          {/each}
          <span class="mark end">
            <b class="num">{money(finance.target)}</b>
            <span>{finance.eta && finance.remaining > 0 ? fmt.roughly(finance.eta) : ''}</span>
          </span>
        </div>
      </div>
      <div class="row wrap">
        <button class="btn primary" onclick={() => ui.open('payday')}><PiggyBank size={16} /> Log payday</button>
        <button class="btn ghost" onclick={() => ui.go('money')}>Open Money <ArrowRight size={15} /></button>
      </div>
    </section>
    {/if}

    {#if settings.has('money')}
    <!-- Pay period -->
    <section class="card">
      <div class="card-head">
        <CalendarClock size={17} />
        <h2>Until payday</h2>
        <span class="sub">{fmt.day(p.start)} – {fmt.day(p.next)}</span>
      </div>
      {#if !p.known}
        <div class="callout warn">
          <span>Set your payday so spending lines up with your paychecks.</span>
        </div>
        <button class="btn sm" onclick={() => ui.go('settings')}>Set payday</button>
      {:else}
        <div class="spread">
          <span class="lead num">
            {#if p.daysLeft === 0}Payday is today{:else if p.daysLeft === 1}Payday tomorrow{:else}{p.daysLeft} days to payday{/if}
          </span>
          <span class="muted small num">{money(finance.flexLeft)} left to spend</span>
        </div>
      {/if}
      <div class="stack envs">
        {#each flex as e (e.line.id)}
          <div class="env">
            <div class="spread small">
              <span>{e.line.name}</span>
              <span class="num" class:danger={e.left < 0}>
                {e.left < 0 ? `${money(-e.left)} over` : `${money(e.left)} left`}
              </span>
            </div>
            <Meter value={e.spent} max={e.line.amount} auto label="{e.line.name} used" />
          </div>
        {/each}
      </div>
      <button class="btn sm" onclick={() => ui.open('spend')}><Plus size={15} /> Log spend</button>
    </section>
    {/if}

    {#if settings.has('diet')}
    <!-- Today: food -->
    <section class="card">
      <div class="card-head">
        <Utensils size={17} />
        <h2>Today’s food</h2>
        <span class="sub">{totals.count} meal{totals.count === 1 ? '' : 's'}</span>
        <div class="actions"><button class="btn ghost icon sm" aria-label="Log meal" onclick={() => ui.open('meal')}><Plus size={16} /></button></div>
      </div>
      <div class="stack">
        <div class="spread small"><span>Calories</span><span class="num muted">{totals.kcal} / {settings.v.kcalTarget} kcal</span></div>
        <Meter value={totals.kcal} max={settings.v.kcalTarget} color="var(--c-diet)" auto warnAt={1.0} overColor="var(--warn)" label="Calories" />
      </div>
      <div class="stack">
        <div class="spread small"><span>Protein</span><span class="num muted">{totals.protein} / {settings.v.proteinTarget} g</span></div>
        <Meter value={totals.protein} max={settings.v.proteinTarget} color="var(--c-fit)" label="Protein" />
      </div>
      <Water date={today} />
      <div class="row small muted">
        <Pizza size={15} />
        <span class="num">
          Takeout: {finance.takeoutsThisPeriod} of {settings.v.takeoutCap} {finance.takeoutWindow.label}
        </span>
      </div>
    </section>
    {/if}

    {#if settings.has('fitness')}
    <!-- This week: fitness -->
    <section class="card">
      <div class="card-head">
        <Dumbbell size={17} />
        <h2>This week</h2>
        <span class="sub num">{weekMinutes} min</span>
        <div class="actions"><button class="btn ghost icon sm" aria-label="Log workout" onclick={() => ui.open('workout')}><Plus size={16} /></button></div>
      </div>
      <div class="spread">
        <span class="lead num">{thisWeek.length} / {settings.v.workoutsPerWeek} workouts</span>
        {#if thisWeek.length >= settings.v.workoutsPerWeek}<span class="chip tint" style:--tint="var(--c-fit)"><Check size={12} /> Target hit</span>{/if}
      </div>
      <div class="days">
        {#each week as d, i (d)}
          <div class="day" class:done={workoutDays.has(d)} class:today={d === today} class:future={d > today}>
            <span class="dot"></span>
            <span class="xs">{DOW[i]}</span>
          </div>
        {/each}
      </div>
      <p class="small muted">
        {#if lastWorkout}Last: {lastWorkout.title}, {fmt.relative(lastWorkout.date, today)}{:else}No workouts logged yet.{/if}
      </p>
    </section>
    {/if}

    {#if settings.has('wishlist')}
    <!-- Wishlist -->
    <section class="card">
      <div class="card-head">
        <Gift size={17} />
        <h2>Wishlist</h2>
        <span class="sub">{waiting.length} waiting</span>
        <div class="actions"><button class="btn ghost icon sm" aria-label="Add to wishlist" onclick={() => ui.open('wish')}><Plus size={16} /></button></div>
      </div>
      {#if waiting.length === 0}
        <p class="small muted">Want something? Put it here first and let it wait {settings.v.wishCooldownHours} hours.</p>
      {:else}
        <div class="list">
          {#each waiting.slice(0, 4) as { w, readyIn } (w.id)}
            <button class="list-row linkish" onclick={() => ui.go('wishlist')}>
              <span class="grow truncate">{w.name}</span>
              <span class="num small muted">{money(w.price)}</span>
              {#if readyIn <= 0}
                <span class="chip tint" style:--tint="var(--c-wish)">Decide</span>
              {:else}
                <span class="chip"><Hourglass size={11} /> {countdown(readyIn)}</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
      {#if notSpent > 0}<p class="xs faint">Not spent thanks to waiting: <b class="num">{money(notSpent)}</b></p>{/if}
    </section>
    {/if}

    {#if settings.has('goals')}
    <!-- Aspirations -->
    <section class="card">
      <div class="card-head">
        <Mountain size={17} />
        <h2>Aspirations</h2>
        <div class="actions"><button class="btn ghost icon sm" aria-label="New aspiration" onclick={() => ui.open('goal')}><Plus size={16} /></button></div>
      </div>
      {#if activeGoals.length === 0}
        <p class="small muted">Add the bigger things you're working towards.</p>
      {:else}
        <div class="stack goals">
          {#each activeGoals as g (g.id)}
            {@const prog = goalProgress(g, finance.progress)}
            <button class="goal linkish" onclick={() => ui.go('goals')}>
              <div class="spread small">
                <span class="truncate">{g.title}</span>
                <span class="num faint">{Math.round(prog * 100)}%</span>
              </div>
              <Meter value={prog} max={1} color={areaOf(g.area).color} label={g.title} />
              {#if g.targetDate}<span class="xs faint">by {fmt.full(g.targetDate)}{parseISO(g.targetDate) < new Date(clock.now) ? ' · overdue' : ''}</span>{/if}
            </button>
          {/each}
        </div>
      {/if}
    </section>
    {/if}
  </div>
</div>

<style>
  .dash {
    --min: 19rem;
    container-type: inline-size;
  }
  @container (min-width: 40rem) {
    .hero {
      grid-column: span 2;
    }
  }
  .hero {
    align-self: stretch;
    justify-content: space-between;
    background:
      radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--tint) 10%, transparent), transparent 55%),
      var(--surface);
    gap: 1.125rem;
  }
  .hero-body {
    display: flex;
    gap: clamp(1rem, 3vw, 2rem);
    align-items: center;
    flex-wrap: wrap;
  }
  .hero-text {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1 1 16rem;
    min-width: 0;
  }
  .eyebrow {
    font-size: var(--fs-xs);
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--c-money);
  }
  .big {
    font-size: var(--fs-hero);
    font-weight: 700;
    letter-spacing: -0.035em;
    line-height: 1.05;
  }
  .eta {
    margin-top: 0.5rem;
    color: var(--text-2);
    max-width: 34rem;
  }
  .eta b {
    color: var(--text);
  }
  .journey {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-top: 0.25rem;
  }
  .track {
    position: relative;
    height: 0.5rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--c-money) 7%, var(--track));
  }
  .fill {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: 999px;
    background: var(--c-money);
    transition: width 600ms var(--ease);
  }
  .tick {
    position: absolute;
    top: -0.1875rem;
    width: 2px;
    height: 0.875rem;
    margin-left: -1px;
    border-radius: 2px;
    background: var(--text-3);
  }
  .tick.reached {
    background: var(--surface);
  }
  .marks {
    position: relative;
    height: 2.25rem;
    font-size: var(--fs-xs);
  }
  .mark {
    position: absolute;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    white-space: nowrap;
    color: var(--text-3);
  }
  .mark b {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    color: var(--text-2);
    font-weight: 620;
  }
  .mark.end {
    right: 0;
    transform: none;
    align-items: flex-end;
  }
  @container (max-width: 30rem) {
    .mark span {
      display: none;
    }
    .marks {
      height: 1.25rem;
    }
  }
  .ring-label {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .pct {
    font-size: var(--fs-xl);
    font-weight: 700;
  }
  .lead {
    font-size: var(--fs-lg);
    font-weight: 640;
  }
  .envs {
    gap: 0.75rem;
  }
  .env {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .days {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.25rem;
  }
  .day {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    color: var(--text-3);
  }
  .day .dot {
    width: 100%;
    max-width: 2.25rem;
    aspect-ratio: 1;
    border-radius: 0.625rem;
    background: var(--surface-2);
    border: 1px solid var(--border);
  }
  .day.done .dot {
    background: var(--c-fit);
    border-color: transparent;
  }
  .day.today {
    color: var(--text);
    font-weight: 650;
  }
  .day.today .dot {
    border: 2px solid var(--c-fit);
  }
  .day.future .dot {
    opacity: 0.5;
  }
  .linkish {
    border: 0;
    background: transparent;
    text-align: left;
    width: 100%;
    color: inherit;
    border-radius: var(--radius-sm);
  }
  .list-row.linkish {
    padding: 0.4rem 0.5rem;
    margin: 0 -0.5rem;
    width: calc(100% + 1rem);
  }
  .linkish:hover {
    background: var(--hover);
  }
  .goals {
    gap: 0.25rem;
  }
  .goal {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.5rem;
    margin: 0 -0.5rem;
    width: calc(100% + 1rem);
  }
</style>
