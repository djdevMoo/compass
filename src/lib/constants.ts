import type { AccountKind, Area, BudgetKind, MealSlot, WorkoutType } from './types';

export const WISH_CATEGORIES = ['Game', 'Media', 'Tech', 'Clothes', 'Home', 'Experience', 'Other'];

export const AREAS: { value: Area; label: string; color: string }[] = [
  { value: 'finance', label: 'Money', color: 'var(--c-money)' },
  { value: 'fitness', label: 'Fitness', color: 'var(--c-fit)' },
  { value: 'diet', label: 'Diet', color: 'var(--c-diet)' },
  { value: 'career', label: 'Career', color: '#facc15' },
  { value: 'learning', label: 'Learning', color: '#38bdf8' },
  { value: 'personal', label: 'Personal', color: 'var(--c-goals)' },
  { value: 'travel', label: 'Travel', color: 'var(--c-wish)' },
];
export const areaOf = (a: Area) => AREAS.find((x) => x.value === a) ?? AREAS[5];

export const WORKOUT_TYPES: { value: WorkoutType; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'sport', label: 'Sport' },
  { value: 'walk', label: 'Walk' },
];

export const MEAL_SLOTS: { value: MealSlot; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

/** Best guess at which meal it is right now. */
export function slotForNow(d = new Date()): MealSlot {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 4 && h < 10.5) return 'breakfast';
  if (h >= 11.5 && h < 15) return 'lunch';
  if (h >= 17 && h < 21.5) return 'dinner';
  return 'snack';
}

export const ACCOUNT_KINDS: { value: AccountKind; label: string }[] = [
  { value: 'savings', label: 'Savings' },
  { value: 'cash', label: 'Cash' },
  { value: 'invest', label: 'Investments' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'other', label: 'Other' },
];

export const BUDGET_KINDS: { value: BudgetKind; label: string; hint: string }[] = [
  { value: 'save', label: 'Savings', hint: 'Moved to your goal on payday' },
  { value: 'fixed', label: 'Fixed', hint: 'Rent, bills, transport: the same every time' },
  { value: 'flex', label: 'Spending', hint: 'Money you spend through the fortnight' },
];
