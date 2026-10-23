<script lang="ts">
  import PageHeader from '../../lib/ui/PageHeader.svelte';
  import Segmented from '../../lib/ui/Segmented.svelte';
  import Overview from './Overview.svelte';
  import Spending from './Spending.svelte';
  import Plan from './Plan.svelte';
  import Bills from './Bills.svelte';
  import Playbook from './Playbook.svelte';
  import { ui } from '../../lib/ui.svelte';
  import { PiggyBank, Receipt } from '../../lib/icons';

  type Tab = 'overview' | 'spending' | 'plan' | 'bills' | 'playbook';
  const TABS: { value: Tab; label: string }[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'spending', label: 'Spending' },
    { value: 'plan', label: 'Paycheck plan' },
    { value: 'bills', label: 'Bills' },
    { value: 'playbook', label: 'Playbook' },
  ];

  let tab = $derived<Tab>((ui.tabs.money as Tab) ?? 'overview');
</script>

<div class="page">
  <PageHeader title="Money" subtitle="Your savings goal, how each paycheck is split, and where it goes." color="var(--c-money)">
    {#snippet actions()}
      <button class="btn" onclick={() => ui.open('spend')}><Receipt size={16} /> Log spend</button>
      <button class="btn primary" onclick={() => ui.open('payday')}><PiggyBank size={16} /> Log payday</button>
    {/snippet}
  </PageHeader>

  <Segmented bind:value={() => tab, (v) => (ui.tabs.money = v)} options={TABS} label="Money sections" />

  {#key tab}
    <div class="tab">
      {#if tab === 'overview'}<Overview />
      {:else if tab === 'spending'}<Spending />
      {:else if tab === 'plan'}<Plan />
      {:else if tab === 'bills'}<Bills />
      {:else}<Playbook />
      {/if}
    </div>
  {/key}
</div>

<style>
  .tab {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    animation: enter 180ms var(--ease);
  }
  @keyframes enter {
    from {
      opacity: 0;
    }
  }
</style>
