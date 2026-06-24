import { z } from 'zod';
import dayjs from 'dayjs';

// Default category set — locked. Phase 24's ManageExpense.vue lazily seeds these per-user
// on first dialog open by bulk-inserting one row per category into wallecx_expense_categories.
// Phase 23 only DEFINES the constant; it does NOT seed (no PocketBase signup hook — D-09).
export const DEFAULT_EXPENSE_CATEGORIES = [
  'Food',
  'Transport',
  'Bills',
  'Health',
  'Shopping',
  'Entertainment',
  'Other',
] as const;

// Mode of payment — fixed set (value + display label), shared by the form Select
// and the expense-row badge. Stored on wallecx_expenses.payment_mode (optional).
export const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'credit', label: 'Credit card' },
  { value: 'debit', label: 'Debit card' },
  { value: 'ewallet', label: 'E-wallet' },
] as const;

export type PaymentMode = (typeof PAYMENT_MODES)[number]['value'];

export const expenseSchema = z.object({
  amount: z.number().positive().max(99_999_999.99),
  expense_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format.' })
    .refine(val => dayjs(val, 'YYYY-MM-DD', true).isValid(), { message: 'Date is not a valid calendar date.' }),
  category: z.string().min(1).max(60),
  description: z.string().min(1).max(120),
  notes: z.string().max(2000).optional(),
  payment_mode: z.enum(['cash', 'credit', 'debit', 'ewallet']).optional(),
  // receipt is handled separately as FormData (matches vaccinations/memberships file-field pattern)
});

export const expenseCategorySchema = z.object({
  name: z.string().min(1).max(60),
});

// Convenience inferred types (D-claude-discretion — removes type duplication)
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type ExpenseCategoryInput = z.infer<typeof expenseCategorySchema>;
