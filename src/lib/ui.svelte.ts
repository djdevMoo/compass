// Navigation and transient UI state (not saved, except the last open page).

import type { Component } from 'svelte';
import type { ModuleId } from './types';
import { settings } from './store.svelte';
import { Apple, Dumbbell, Gift, House, Mountain, Settings as Cog, Wallet } from './icons';

export type PageId = 'home' | 'money' | 'wishlist' | 'goals' | 'fitness' | 'diet' | 'settings';

export interface PageDef {
  id: PageId;
  label: string;
  icon: Component<{ size?: number | string; strokeWidth?: number | string }>;
  color: string;
  blurb: string;
}

export const PAGES: PageDef[] = [
  { id: 'home', label: 'Home', icon: House, color: 'var(--c-home)', blurb: 'Today at a glance' },
  { id: 'money', label: 'Money', icon: Wallet, color: 'var(--c-money)', blurb: 'Savings goal, paycheck plan, spending and bills' },
  { id: 'wishlist', label: 'Wishlist', icon: Gift, color: 'var(--c-wish)', blurb: 'Wants wait a while before you buy them' },
  { id: 'goals', label: 'Aspirations', icon: Mountain, color: 'var(--c-goals)', blurb: 'Bigger goals and the steps to get there' },
  { id: 'fitness', label: 'Fitness', icon: Dumbbell, color: 'var(--c-fit)', blurb: 'Workouts, weekly target and weight' },
  { id: 'diet', label: 'Diet', icon: Apple, color: 'var(--c-diet)', blurb: 'Meals, protein, water and takeout' },
  { id: 'settings', label: 'Settings', icon: Cog, color: 'var(--text-2)', blurb: 'Pay schedule, targets, theme and data' },
];

/** Pages that are switched on (Home and Settings always are). */
export function visiblePages(): PageDef[] {
  return PAGES.filter((p) => p.id === 'home' || p.id === 'settings' || settings.has(p.id as ModuleId));
}

export type QuickKind = 'spend' | 'payday' | 'wish' | 'workout' | 'meal' | 'goal' | 'weight';

class UI {
  page = $state<PageId>('home');
  palette = $state(false);
  quick = $state<QuickKind | null>(null);
  /** Optional prefilled values for the open quick-add form. */
  preset = $state<Record<string, unknown>>({});
  /** Remembered sub-tab per page. */
  tabs = $state<Record<string, string>>({});

  go(id: PageId): void {
    if (!visiblePages().some((p) => p.id === id)) id = 'home';
    this.page = id;
    this.palette = false;
    if (settings.v.lastPage !== id) settings.set({ lastPage: id });
    document.querySelector('main')?.scrollTo({ top: 0 });
  }

  open(kind: QuickKind, preset: Record<string, unknown> = {}): void {
    this.palette = false;
    this.preset = preset;
    this.quick = kind;
  }
}

export const ui = new UI();

export interface ToastItem {
  id: number;
  message: string;
  tone: 'ok' | 'error' | 'info';
  action?: { label: string; run: () => void };
}

class Toasts {
  list = $state<ToastItem[]>([]);
  private seq = 0;

  show(message: string, opts: { tone?: ToastItem['tone']; action?: ToastItem['action']; ms?: number } = {}): void {
    const id = ++this.seq;
    this.list.push({ id, message, tone: opts.tone ?? 'ok', action: opts.action });
    if (this.list.length > 4) this.list.shift();
    setTimeout(() => this.dismiss(id), opts.ms ?? (opts.action ? 6500 : 3500));
  }

  /** "Deleted X" with an Undo button. */
  undoable(message: string, undo: () => void): void {
    this.show(message, { tone: 'info', action: { label: 'Undo', run: undo } });
  }

  dismiss(id: number): void {
    const i = this.list.findIndex((t) => t.id === id);
    if (i >= 0) this.list.splice(i, 1);
  }
}

export const toast = new Toasts();
