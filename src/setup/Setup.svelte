<!-- First-run setup: a few questions, then Compass builds itself around the answers. -->
<script lang="ts">
  import { fly } from 'svelte/transition';
  import MoneyInput from '../lib/ui/MoneyInput.svelte';
  import Segmented from '../lib/ui/Segmented.svelte';
  import { settings, uid } from '../lib/store.svelte';
  import { CURRENCIES, money } from '../lib/money';
  import { fmt, nthPayday, todayISO } from '../lib/dates';
  import { perPayFromMonthly, perPayFromWeekly } from '../lib/plan';
  import { applySetup, billsTotal, defaultAnswers, firstPaydayFor, planFor, type Answers } from './setup';
  import { Apple, ArrowRight, Check, ChevronLeft, Dumbbell, Gift, Monitor, Moon, Mountain, Plus, Sun, Wallet, X } from '../lib/icons';
  import type { ModuleId, PayFrequency, Theme } from '../lib/types';

  let { ondone }: { ondone: () => void } = $props();

  const a = $state<Answers>(defaultAnswers());
  // Show amounts in the guessed currency from the very first screen.
  settings.set({ currency: defaultAnswers().currency });
  let index = $state(0);
  let dir = $state(1);
  let busy = $state(false);
  let error = $state('');

  const has = (m: ModuleId) => a.modules.includes(m);

  interface Step {
    id: string;
    title: string;
    sub: string;
    optional?: boolean;
    valid?: () => boolean;
  }

  const steps = $derived<Step[]>(
    [
      { id: 'welcome', title: 'Welcome to Compass', sub: 'A few quick questions and Compass sets itself up around you. It takes about two minutes, and you can change everything later.' },
      { id: 'modules', title: 'What do you want help with?', sub: 'Each one becomes a tab. Switch them on or off any time in Settings.', valid: () => a.modules.length > 0 },
      has('money') && { id: 'pay', title: 'How do you get paid?', sub: 'Your take-home pay, after tax. Everything in Money lines up with your paydays.', valid: () => (a.pay ?? 0) > 0 },
      has('money') && { id: 'goal', title: 'What are you saving for?', sub: 'One main savings goal. Compass tracks it on Home and works out when you will get there.', valid: () => (a.goalTarget ?? 0) > 0 },
      has('money') && { id: 'costs', title: 'What do you spend regularly?', sub: 'Rough numbers are fine. Leave out anything that doesn’t apply.', optional: true },
      has('money') && { id: 'plan', title: 'Your paycheck plan', sub: 'Here’s a starting split of each paycheck. Adjust how much you save; the rest balances itself.' },
      has('wishlist') && { id: 'wishlist', title: 'How long should wants wait?', sub: 'Anything you want goes on the wishlist first. If you still want it after the wait, buy it.' },
      has('fitness') && { id: 'fitness', title: 'Fitness', sub: 'How often do you want to work out?', optional: true },
      has('diet') && { id: 'diet', title: 'Food and water', sub: 'Daily targets. Not sure? Keep these and change them later.', optional: true },
      has('goals') && { id: 'goals', title: 'What are you working towards?', sub: 'Bigger goals: a skill, a trip, a milestone. You can break them into steps later.', optional: true },
      { id: 'look', title: 'How should it look?', sub: 'Dark is easiest on the eyes at night. You can switch any time.' },
      { id: 'done', title: a.name.trim() ? `You’re all set, ${a.name.trim()}` : 'You’re all set', sub: 'Here’s what Compass set up for you.' },
    ].filter(Boolean) as Step[],
  );

  const step = $derived(steps[Math.min(index, steps.length - 1)]);
  const progress = $derived(index / Math.max(1, steps.length - 1));
  const canNext = $derived(step.valid ? step.valid() : true);

  const plan = $derived(has('money') ? planFor(a) : null);
  const remaining = $derived(Math.max(0, (a.goalTarget ?? 0) - (a.saved ?? 0)));
  const first = $derived(firstPaydayFor(a));
  const eta = $derived.by(() => {
    if (!plan || plan.save <= 0 || remaining <= 0) return null;
    const n = Math.ceil(remaining / plan.save);
    return { n, date: nthPayday(first, n, a.freq) };
  });

  const MODULES: { id: ModuleId; label: string; blurb: string; icon: typeof Wallet; color: string }[] = [
    { id: 'money', label: 'Money', blurb: 'A savings goal, a plan for every paycheck, spending and bills', icon: Wallet, color: 'var(--c-money)' },
    { id: 'wishlist', label: 'Wishlist', blurb: 'Wants wait a while before you buy, so impulse buys fade', icon: Gift, color: 'var(--c-wish)' },
    { id: 'goals', label: 'Aspirations', blurb: 'Bigger goals broken into steps you can tick off', icon: Mountain, color: 'var(--c-goals)' },
    { id: 'fitness', label: 'Fitness', blurb: 'Workouts, a weekly target and your weight trend', icon: Dumbbell, color: 'var(--c-fit)' },
    { id: 'diet', label: 'Diet', blurb: 'Meals, protein, water and a takeout limit', icon: Apple, color: 'var(--c-diet)' },
  ];

  const FREQS: { value: PayFrequency; label: string }[] = [
    { value: 'weekly', label: 'Every week' },
    { value: 'biweekly', label: 'Every 2 weeks' },
    { value: 'monthly', label: 'Every month' },
  ];

  const THEMES: { value: Theme; label: string; icon: typeof Moon }[] = [
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'system', label: 'Match Windows', icon: Monitor },
  ];

  function toggleModule(m: ModuleId) {
    a.modules = has(m) ? a.modules.filter((x) => x !== m) : [...a.modules, m];
  }

  function setCurrency(code: string) {
    a.currency = code;
    settings.set({ currency: code }); // so every amount on screen uses it straight away
  }

  function setTheme(t: Theme) {
    a.theme = t;
    settings.set({ theme: t }); // live preview
  }

  // Changing the money answers should re-suggest the savings amount.
  function resetSave() {
    a.saveOverride = null;
  }

  async function next(e?: SubmitEvent) {
    e?.preventDefault();
    if (!canNext || busy) return;
    if (step.id === 'done') {
      busy = true;
      error = '';
      try {
        await applySetup($state.snapshot(a) as Answers);
        ondone();
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        busy = false;
      }
      return;
    }
    dir = 1;
    index = Math.min(index + 1, steps.length - 1);
  }

  function back() {
    dir = -1;
    index = Math.max(0, index - 1);
  }

  // Focus the first field on each step, so typing just works.
  function focusFirst(node: HTMLElement) {
    requestAnimationFrame(() => {
      const field = node.querySelector<HTMLElement>('input:not([type=checkbox]), select');
      // Steps without fields focus Continue, so Enter always moves on.
      (field ?? node.closest('form')?.querySelector<HTMLElement>('button[type=submit]'))?.focus();
    });
  }

  const freqWord = $derived(a.freq === 'weekly' ? 'week' : a.freq === 'biweekly' ? 'two weeks' : 'month');
</script>

<div class="setup">
  <header>
    <span class="xs faint">Setup</span>
    <div class="bar" aria-hidden="true"><div style:width="{progress * 100}%"></div></div>
    <span class="count xs faint num">{index + 1} / {steps.length}</span>
  </header>

  <form class="panel" onsubmit={next}>
    {#key step.id}
      <div class="step" in:fly={{ x: 24 * dir, duration: 220 }} use:focusFirst>
        <h1>{step.title}</h1>
        <p class="sub muted">{step.sub}</p>

        <div class="body">
          {#if step.id === 'welcome'}
            <label class="field">
              <span>What should Compass call you?</span>
              <input class="input big" bind:value={a.name} placeholder="Your first name" maxlength="40" autocomplete="given-name" />
            </label>

          {:else if step.id === 'modules'}
            <div class="cards">
              {#each MODULES as m (m.id)}
                <button type="button" class="opt" class:on={has(m.id)} style:--c={m.color} aria-pressed={has(m.id)} onclick={() => toggleModule(m.id)}>
                  <span class="opt-ico"><m.icon size={18} /></span>
                  <span class="opt-text"><b>{m.label}</b><span>{m.blurb}</span></span>
                  <span class="tick">{#if has(m.id)}<Check size={14} strokeWidth={3} />{/if}</span>
                </button>
              {/each}
            </div>

          {:else if step.id === 'pay'}
            <div class="fields">
              <label class="field">
                <span>Currency</span>
                <select class="select" value={a.currency} onchange={(e) => setCurrency((e.currentTarget as HTMLSelectElement).value)}>
                  {#each CURRENCIES as c (c.code)}<option value={c.code}>{c.label}</option>{/each}
                </select>
              </label>
              {#key a.currency}
                <label class="field">
                  <span>Take-home pay per paycheck</span>
                  <MoneyInput bind:value={() => a.pay, (v) => { a.pay = v; resetSave(); }} />
                </label>
              {/key}
            </div>
            <div class="field">
              <span class="label">You get paid</span>
              <Segmented bind:value={() => a.freq, (v) => { a.freq = v; resetSave(); }} options={FREQS} label="Pay frequency" />
            </div>
            <label class="field">
              <span>Your last or next payday <span class="faint">(optional)</span></span>
              <input class="input" type="date" bind:value={a.payday} />
              <span class="hint">Lets Compass count down to payday and track spending per pay period.</span>
            </label>

          {:else if step.id === 'goal'}
            <label class="field">
              <span>Call it</span>
              <input class="input" bind:value={a.goalName} maxlength="40" placeholder="Emergency fund, house deposit, a car…" />
            </label>
            <div class="fields">
              <label class="field">
                <span>Target</span>
                <MoneyInput bind:value={() => a.goalTarget, (v) => { a.goalTarget = v; resetSave(); }} />
              </label>
              <label class="field">
                <span>Already saved</span>
                <MoneyInput bind:value={() => a.saved, (v) => { a.saved = v; resetSave(); }} />
              </label>
            </div>
            <div class="row wrap">
              {#each [100_000, 500_000, 1_000_000, 2_000_000] as t (t)}
                <button type="button" class="chip choice" class:on={a.goalTarget === t} onclick={() => { a.goalTarget = t; resetSave(); }}>{money(t)}</button>
              {/each}
            </div>
            <label class="field">
              <span>By when? <span class="faint">(optional)</span></span>
              <input class="input" type="date" min={todayISO()} bind:value={() => a.goalDate, (v) => { a.goalDate = v; resetSave(); }} />
            </label>

          {:else if step.id === 'costs'}
            <div class="fields">
              <label class="field">
                <span>Rent or housing <span class="faint">/ month</span></span>
                <MoneyInput bind:value={() => a.rent, (v) => { a.rent = v; resetSave(); }} />
              </label>
              <label class="field">
                <span>Transport <span class="faint">/ month</span></span>
                <MoneyInput bind:value={() => a.transport, (v) => { a.transport = v; resetSave(); }} />
              </label>
              <label class="field">
                <span>Groceries <span class="faint">/ week</span></span>
                <MoneyInput bind:value={() => a.groceries, (v) => { a.groceries = v; resetSave(); }} />
              </label>
            </div>
            <div class="field">
              <span class="label">Bills and subscriptions <span class="faint">/ month, your share</span></span>
              <div class="bills">
                {#each a.bills as b (b.id)}
                  <div class="bill">
                    <input class="input" bind:value={b.name} placeholder="Name" maxlength="40" aria-label="Bill name" />
                    <MoneyInput bind:value={() => b.monthly, (v) => { b.monthly = v; resetSave(); }} />
                    <button type="button" class="btn ghost icon" aria-label="Remove {b.name || 'bill'}" onclick={() => { a.bills = a.bills.filter((x) => x.id !== b.id); resetSave(); }}><X size={15} /></button>
                  </div>
                {/each}
              </div>
              <div class="spread">
                <button type="button" class="btn sm ghost" onclick={() => a.bills.push({ id: uid(), name: '', monthly: null })}><Plus size={14} /> Add a bill</button>
                {#if billsTotal(a) > 0}
                  <span class="small muted num">{money(billsTotal(a))} a month ≈ {money(perPayFromMonthly(billsTotal(a), a.freq))} per paycheck</span>
                {/if}
              </div>
            </div>
            {#if (a.groceries ?? 0) > 0}
              <p class="hint xs faint">Groceries come to about {money(perPayFromWeekly(a.groceries ?? 0, a.freq))} per paycheck.</p>
            {/if}

          {:else if step.id === 'plan' && plan}
            {#if plan.shortfall > 0}
              <div class="callout danger">
                Your regular costs are {money(plan.shortfall)} more than each paycheck. Go back and check the numbers, or start with what you have and adjust in Money later.
              </div>
            {:else}
              <div class="splitbar" aria-hidden="true">
                {#each plan.lines.filter((l) => l.amount > 0) as l (l.name)}
                  <div class="seg {l.kind}" style:flex-grow={l.amount} title="{l.name}: {money(l.amount)}"></div>
                {/each}
              </div>
              <div class="plan-lines">
                {#each plan.lines as l (l.name)}
                  <div class="pl">
                    <i class="dot {l.kind}"></i>
                    <span class="grow">{l.name}</span>
                    <span class="num" class:strong={l.kind === 'save'}>{money(l.amount)}</span>
                  </div>
                {/each}
                <div class="pl total"><span class="grow">Every {freqWord}</span><span class="num">{money(a.pay ?? 0)}</span></div>
              </div>
              <div class="fields">
                <label class="field">
                  <span>Save each payday</span>
                  <MoneyInput bind:value={() => plan.save, (v) => (a.saveOverride = v)} />
                  <span class="hint">Up to {money(plan.free)} is free after costs.</span>
                </label>
                <div class="eta">
                  {#if eta}
                    <span class="faint xs">You’d reach {money(a.goalTarget ?? 0)}</span>
                    <b>{fmt.roughly(eta.date)}</b>
                    <span class="faint xs">{eta.n} paydays</span>
                  {:else if remaining <= 0}
                    <b class="ok">Goal already reached</b>
                  {:else}
                    <span class="faint small">Save something each payday to see when you’ll get there.</span>
                  {/if}
                </div>
              </div>
              {#if plan.neededForDate !== null && a.goalDate}
                <p class="hint small" class:warn={plan.save < plan.neededForDate}>
                  To hit {fmt.full(a.goalDate)} you’d need about {money(plan.neededForDate)} per payday{plan.save < plan.neededForDate ? '. That’s more than fits right now, so the date may slip.' : '.'}
                </p>
              {/if}
            {/if}

          {:else if step.id === 'wishlist'}
            <div class="cards three">
              {#each [{ h: 24, l: '1 day' }, { h: 48, l: '2 days' }, { h: 72, l: '3 days', r: true }, { h: 168, l: '1 week' }] as o (o.h)}
                <button type="button" class="opt slim" class:on={a.cooldownHours === o.h} style:--c="var(--c-wish)" onclick={() => (a.cooldownHours = o.h)}>
                  <span class="opt-text"><b>{o.l}</b>{#if o.r}<span>Recommended</span>{/if}</span>
                  <span class="tick">{#if a.cooldownHours === o.h}<Check size={14} strokeWidth={3} />{/if}</span>
                </button>
              {/each}
            </div>

          {:else if step.id === 'fitness'}
            <div class="field">
              <span class="label">Workouts a week</span>
              <div class="row wrap">
                {#each [1, 2, 3, 4, 5, 6, 7] as n (n)}
                  <button type="button" class="num-btn" class:on={a.workoutsPerWeek === n} onclick={() => (a.workoutsPerWeek = n)}>{n}</button>
                {/each}
              </div>
            </div>
            <label class="field">
              <span>Your weight today <span class="faint">(kg, optional)</span></span>
              <input class="input num" type="number" min="20" max="400" step="0.1" bind:value={a.weightKg} placeholder="Starts your trend line" />
            </label>

          {:else if step.id === 'diet'}
            <div class="fields">
              <label class="field"><span>Calories a day</span><input class="input num" type="number" min="800" max="8000" step="50" bind:value={a.kcal} /></label>
              <label class="field"><span>Protein a day (g)</span><input class="input num" type="number" min="0" max="500" step="5" bind:value={a.protein} /></label>
              <label class="field"><span>Glasses of water</span><input class="input num" type="number" min="1" max="20" bind:value={a.water} /></label>
              {#if has('money')}
                <label class="field"><span>Takeouts per paycheck</span><input class="input num" type="number" min="0" max="20" bind:value={a.takeoutCap} /></label>
              {/if}
            </div>

          {:else if step.id === 'goals'}
            {#each a.aspirations as _, i (i)}
              <input class="input" bind:value={a.aspirations[i]} maxlength="120" placeholder={['Run a 10k', 'Learn to cook 10 meals', 'Visit Japan'][i]} aria-label="Aspiration {i + 1}" />
            {/each}

          {:else if step.id === 'look'}
            <div class="cards three">
              {#each THEMES as t (t.value)}
                <button type="button" class="opt slim" class:on={a.theme === t.value} style:--c="var(--accent)" onclick={() => setTheme(t.value)}>
                  <span class="opt-ico"><t.icon size={18} /></span>
                  <span class="opt-text"><b>{t.label}</b></span>
                  <span class="tick">{#if a.theme === t.value}<Check size={14} strokeWidth={3} />{/if}</span>
                </button>
              {/each}
            </div>

          {:else if step.id === 'done'}
            <ul class="summary">
              {#if has('money') && plan}
                <li><Wallet size={16} /> <span><b>{a.goalName || 'Savings goal'}</b>: {money(a.saved ?? 0)} of {money(a.goalTarget ?? 0)}, saving {money(plan.save)} each payday{eta ? `, there around ${fmt.roughly(eta.date)}` : ''}.</span></li>
                <li><Check size={16} /> <span>A paycheck plan with {plan.lines.length} lines, and spending envelopes for each pay period.</span></li>
              {/if}
              {#if has('wishlist')}<li><Gift size={16} /> <span>A wishlist with a {a.cooldownHours}-hour wait.</span></li>{/if}
              {#if has('goals')}<li><Mountain size={16} /> <span>{a.aspirations.filter((x) => x.trim()).length || 'No'} aspiration{a.aspirations.filter((x) => x.trim()).length === 1 ? '' : 's'} to start with.</span></li>{/if}
              {#if has('fitness')}<li><Dumbbell size={16} /> <span>A target of {a.workoutsPerWeek} workout{a.workoutsPerWeek === 1 ? '' : 's'} a week.</span></li>{/if}
              {#if has('diet')}<li><Apple size={16} /> <span>{a.kcal} kcal, {a.protein} g protein and {a.water} glasses of water a day.</span></li>{/if}
            </ul>
            <p class="hint small">Tip: press <span class="kbd">Ctrl K</span> anywhere to jump to a page or log something.</p>
            {#if error}<div class="callout danger">Setup couldn’t finish: {error}</div>{/if}
          {/if}
        </div>
      </div>
    {/key}

    <footer>
      {#if index > 0}
        <button type="button" class="btn ghost" onclick={back} disabled={busy}><ChevronLeft size={16} /> Back</button>
      {/if}
      <span class="grow"></span>
      {#if step.optional}
        <button type="button" class="btn ghost" onclick={() => { dir = 1; index++; }}>Skip</button>
      {/if}
      <button type="submit" class="btn primary go" disabled={!canNext || busy}>
        {step.id === 'done' ? (busy ? 'Setting up…' : 'Open Compass') : step.id === 'welcome' ? 'Get started' : 'Continue'}
        <ArrowRight size={16} />
      </button>
    </footer>
  </form>
  <p class="foot xs faint">Everything stays on this PC.</p>
</div>

<style>
  .setup {
    grid-column: 1 / -1;
    grid-row: 2;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: clamp(1rem, 4vh, 3rem) 1rem 2rem;
    gap: 1.25rem;
    background:
      radial-gradient(60rem 30rem at 50% -10%, color-mix(in srgb, var(--accent) 9%, transparent), transparent 70%),
      var(--bg);
  }
  header {
    width: min(40rem, 100%);
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .bar {
    flex: 1;
    height: 0.3rem;
    border-radius: 999px;
    background: var(--track);
    overflow: hidden;
  }
  .bar div {
    height: 100%;
    background: var(--accent);
    border-radius: 999px;
    transition: width 300ms var(--ease);
  }
  .panel {
    width: min(40rem, 100%);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 1.25rem;
    padding: clamp(1.25rem, 3vw, 2.25rem);
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    box-shadow: 0 24px 64px rgb(0 0 0 / 0.25);
  }
  .step {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  h1 {
    font-size: clamp(1.5rem, 1.2rem + 1.2vw, 2rem);
  }
  .sub {
    max-width: 34rem;
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1rem;
  }
  .input.big {
    height: 3rem;
    font-size: var(--fs-lg);
  }
  footer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--border);
  }
  .go {
    min-width: 9rem;
  }
  .cards {
    display: grid;
    gap: 0.5rem;
  }
  .cards.three {
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  }
  .opt {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.75rem 0.875rem;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--surface-2);
    text-align: left;
    transition: border-color var(--dur) var(--ease), background var(--dur) var(--ease);
  }
  .opt:hover {
    border-color: var(--border-strong);
  }
  .opt.on {
    border-color: color-mix(in srgb, var(--c) 70%, transparent);
    background: color-mix(in srgb, var(--c) 9%, var(--surface-2));
  }
  .opt-ico {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 0.625rem;
    display: grid;
    place-items: center;
    flex: none;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 14%, transparent);
  }
  .opt-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }
  .opt-text span {
    font-size: var(--fs-sm);
    color: var(--text-2);
  }
  .tick {
    width: 1.375rem;
    height: 1.375rem;
    border-radius: 50%;
    border: 1.5px solid var(--border-strong);
    display: grid;
    place-items: center;
    flex: none;
  }
  .on .tick {
    background: var(--c);
    border-color: var(--c);
    color: var(--bg);
  }
  .choice {
    border: 1px solid var(--border);
    cursor: pointer;
    height: 1.75rem;
    padding: 0 0.75rem;
    font-size: var(--fs-sm);
  }
  .choice.on {
    border-color: var(--accent);
    color: var(--text);
  }
  .bills {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  .bill {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 9rem auto;
    gap: 0.375rem;
  }
  .splitbar {
    display: flex;
    gap: 2px;
    height: 0.875rem;
    border-radius: var(--radius-xs);
    overflow: hidden;
  }
  .seg {
    flex-basis: 0;
    min-width: 3px;
  }
  .save {
    background: var(--c-money);
  }
  .fixed {
    background: var(--series-1);
  }
  .flex {
    background: var(--c-diet);
  }
  .plan-lines {
    display: flex;
    flex-direction: column;
  }
  .pl {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.4rem 0;
    border-top: 1px solid var(--border);
    font-size: var(--fs-md);
  }
  .pl:first-child {
    border-top: 0;
  }
  .pl .dot {
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 3px;
  }
  .pl.total {
    font-weight: 650;
    border-top-color: var(--border-strong);
  }
  .strong {
    font-weight: 700;
    color: var(--c-money);
  }
  .eta {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.1rem;
    padding: 0.5rem 0.875rem;
    border-radius: var(--radius);
    background: var(--accent-soft);
  }
  .eta b {
    font-size: var(--fs-lg);
  }
  .num-btn {
    width: 2.75rem;
    height: 2.75rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-2);
    font-weight: 650;
    font-size: var(--fs-lg);
  }
  .num-btn.on {
    border-color: var(--c-fit);
    background: color-mix(in srgb, var(--c-fit) 15%, var(--surface-2));
  }
  .summary {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .summary li {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
  }
  .summary :global(svg) {
    color: var(--accent);
    flex: none;
    margin-top: 0.15rem;
  }
  .hint.warn {
    color: var(--warn);
  }
  .foot {
    margin-top: auto;
  }
</style>
