// Small pure helpers shared by pages. Call them inside $derived so they stay reactive.

import { addDays, weekStart } from './dates';
import type { DayLog, Goal, ISODate, Meal, WeightEntry, Workout } from './types';

export function goalProgress(g: Goal, savingsProgress: number): number {
  if (g.status === 'done') return 1;
  if (g.linked === 'savings') return savingsProgress;
  if (!g.milestones.length) return 0;
  return g.milestones.filter((m) => m.done).length / g.milestones.length;
}

export function dayTotals(meals: Meal[], date: ISODate) {
  let kcal = 0;
  let protein = 0;
  let count = 0;
  for (const m of meals) {
    if (m.date !== date) continue;
    kcal += m.kcal;
    protein += m.protein;
    count++;
  }
  return { kcal, protein, count };
}

export function waterOn(days: DayLog[], date: ISODate): number {
  return days.find((d) => d.id === date)?.water ?? 0;
}

/** The 7 dates of the week (Mon–Sun) containing `date`. */
export function weekDates(date: ISODate): ISODate[] {
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function workoutsInWeek(workouts: Workout[], date: ISODate): Workout[] {
  const start = weekStart(date);
  const end = addDays(start, 7);
  return workouts.filter((w) => w.date >= start && w.date < end);
}

/** Consecutive weeks (ending with last week, plus this week if already hit) that met the target. */
export function weekStreak(workouts: Workout[], today: ISODate, perWeek: number): number {
  if (perWeek <= 0) return 0;
  const counts = new Map<ISODate, number>();
  for (const w of workouts) {
    const k = weekStart(w.date);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const thisWeek = weekStart(today);
  let streak = (counts.get(thisWeek) ?? 0) >= perWeek ? 1 : 0;
  let k = addDays(thisWeek, -7);
  while ((counts.get(k) ?? 0) >= perWeek) {
    streak++;
    k = addDays(k, -7);
  }
  return streak;
}

export function sortedWeights(weights: WeightEntry[]): WeightEntry[] {
  return [...weights].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Weight change over roughly the last `days` days (latest minus the entry nearest the start). */
export function weightChange(weights: WeightEntry[], today: ISODate, days = 30): number | null {
  const sorted = sortedWeights(weights);
  if (sorted.length < 2) return null;
  const latest = sorted[sorted.length - 1];
  const from = addDays(today, -days);
  const base = sorted.find((w) => w.date >= from) ?? sorted[0];
  if (base.date === latest.date) return null;
  return Math.round((latest.kg - base.kg) * 10) / 10;
}
