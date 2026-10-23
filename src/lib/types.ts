// Shared data shapes. Money is always stored as integer cents (never floats),
// and calendar days as local 'YYYY-MM-DD' strings.

export type ID = string;
export type Cents = number;
export type ISODate = string;

export type AccountKind = 'savings' | 'cash' | 'invest' | 'crypto' | 'other';
export interface Account {
  id: ID;
  name: string;
  balance: Cents;
  kind: AccountKind;
  /** Counts towards the savings goal. */
  inGoal: boolean;
  order: number;
}

export type BudgetKind = 'save' | 'fixed' | 'flex';
/** One slice of the per-paycheck split. */
export interface BudgetLine {
  id: ID;
  name: string;
  amount: Cents;
  note: string;
  kind: BudgetKind;
  order: number;
}

export interface Bill {
  id: ID;
  name: string;
  monthly: Cents;
  note: string;
  active: boolean;
  order: number;
}

/** Money spent. `budgetId` ties it to an envelope in the paycheck split. */
export interface Spend {
  id: ID;
  date: ISODate;
  amount: Cents;
  budgetId: ID | null;
  note: string;
  createdAt: string;
}

/** Money moved into a goal account (usually on payday). */
export interface Contribution {
  id: ID;
  date: ISODate;
  amount: Cents;
  accountId: ID;
  note: string;
}

/** Goal total at the end of a day. `id` is the date. */
export interface BalancePoint {
  id: ISODate;
  date: ISODate;
  total: Cents;
}

export interface PlaybookItem {
  id: ID;
  group: string;
  text: string;
  order: number;
}

export type WishStatus = 'waiting' | 'bought' | 'dropped';
export interface Wish {
  id: ID;
  name: string;
  price: Cents;
  url: string;
  category: string;
  note: string;
  addedAt: string; // ISO timestamp
  status: WishStatus;
  decidedAt: string | null;
}

export type Area = 'finance' | 'fitness' | 'diet' | 'career' | 'learning' | 'personal' | 'travel';
export interface Milestone {
  id: ID;
  text: string;
  done: boolean;
}
export interface Goal {
  id: ID;
  title: string;
  area: Area;
  why: string;
  targetDate: ISODate | null;
  status: 'active' | 'paused' | 'done';
  milestones: Milestone[];
  /** 'savings' = progress comes from the money goal instead of milestones. */
  linked: 'savings' | null;
  createdAt: string;
  order: number;
}

export type WorkoutType = 'strength' | 'cardio' | 'mobility' | 'sport' | 'walk';
export interface Workout {
  id: ID;
  date: ISODate;
  type: WorkoutType;
  title: string;
  minutes: number;
  effort: number; // 1..5
  notes: string;
}

export interface WeightEntry {
  id: ISODate;
  date: ISODate;
  kg: number;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export interface Meal {
  id: ID;
  date: ISODate;
  slot: MealSlot;
  name: string;
  kcal: number;
  protein: number;
  takeout: boolean;
}

export interface DayLog {
  id: ISODate;
  date: ISODate;
  water: number;
}

export type PayFrequency = 'weekly' | 'biweekly' | 'monthly';

/** Tabs that can be switched on or off. */
export type ModuleId = 'money' | 'wishlist' | 'goals' | 'fitness' | 'diet';
export type Theme = 'dark' | 'light' | 'system';

export interface Settings {
  name: string;
  /** ISO currency code, e.g. EUR. Money is stored in its cents. */
  currency: string;
  /** Which tabs are switched on. */
  modules: ModuleId[];
  theme: Theme;
  /** Accent colour as #rrggbb. */
  accent: string;
  /** Ask GitHub for new versions in the background. */
  autoCheckUpdates: boolean;
  /** Version that last ran, to say "Updated to …" once after an update. */
  lastVersion: string;
  uiScale: number;
  sidebarCollapsed: boolean;
  lastPage: string;

  payAmount: Cents;
  payFrequency: PayFrequency;
  /** Any known payday (past or upcoming); the schedule is derived from it. */
  payAnchor: ISODate | null;

  goalName: string;
  goalTarget: Cents;
  emergencyBuffer: Cents;
  takeoutCap: number;
  wishCooldownHours: number;

  kcalTarget: number;
  proteinTarget: number;
  waterTarget: number;
  workoutsPerWeek: number;
}
