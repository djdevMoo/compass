<!-- One modal that hosts every quick-add form (opened from anywhere via ui.open). -->
<script lang="ts">
  import Modal from '../lib/ui/Modal.svelte';
  import { ui, type QuickKind } from '../lib/ui.svelte';
  import SpendForm from '../forms/SpendForm.svelte';
  import PaydayForm from '../forms/PaydayForm.svelte';
  import WishForm from '../forms/WishForm.svelte';
  import WorkoutForm from '../forms/WorkoutForm.svelte';
  import MealForm from '../forms/MealForm.svelte';
  import WeightForm from '../forms/WeightForm.svelte';
  import GoalForm from '../forms/GoalForm.svelte';

  const META: Record<QuickKind, { title: string; subtitle: string; width?: string }> = {
    spend: { title: 'Log a spend', subtitle: 'It comes out of this pay period’s envelope.', width: '34rem' },
    payday: { title: 'Log payday', subtitle: 'Move this paycheck’s saving into your goal.' },
    wish: { title: 'Add to wishlist', subtitle: 'Want it now? Let it wait first.' },
    workout: { title: 'Log a workout', subtitle: '' },
    meal: { title: 'Log a meal', subtitle: '', width: '34rem' },
    weight: { title: 'Log weight', subtitle: '', width: '26rem' },
    goal: { title: 'New aspiration', subtitle: 'Something bigger, broken into steps.' },
  };

  const meta = $derived(ui.quick ? META[ui.quick] : null);
  const close = () => (ui.quick = null);
</script>

<Modal
  bind:open={() => ui.quick !== null, (v) => !v && close()}
  title={meta?.title ?? ''}
  subtitle={meta?.subtitle ?? ''}
  width={meta?.width ?? '30rem'}
>
  {#key ui.quick}
    {#if ui.quick === 'spend'}<SpendForm done={close} />
    {:else if ui.quick === 'payday'}<PaydayForm done={close} />
    {:else if ui.quick === 'wish'}<WishForm done={close} />
    {:else if ui.quick === 'workout'}<WorkoutForm done={close} />
    {:else if ui.quick === 'meal'}<MealForm done={close} />
    {:else if ui.quick === 'weight'}<WeightForm done={close} />
    {:else if ui.quick === 'goal'}<GoalForm done={close} />
    {/if}
  {/key}
</Modal>
