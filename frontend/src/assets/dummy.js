import { v4 as uuidv4 } from 'uuid';

// Generate random dates within the last 30 days
const randomDate = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString().split('T')[0];
};
// Gauge Data (current + history)
export const gaugeData = [
  {
    name: 'Income',
    value: 4500,
    history: [3200, 4000, 5000, 6000, 5500],
  },
  {
    name: 'Expenses',
    value: 3200,
    history: [1800, 1900, 2100, 2400, 3000],
  },
  {
    name: 'Savings',
    value: 1800,
    history: [1000, 1200, 900, 1500, 1800],
  },
];

// Categories for expenses
const categories = ['Food', 'Housing', 'Transport', 'Shopping', 'Entertainment', 'Utilities', 'Healthcare'];

// Generate dummy transactions
export const dummyTransactions = Array.from({ length: 100 }, (_, i) => {
  const isExpense = Math.random() > 0.3; // 70% chance of being an expense
  const amount = (Math.random() * 500 + 10).toFixed(2);
  const category = categories[Math.floor(Math.random() * categories.length)];
  
  return {
    id: uuidv4(),
    type: isExpense ? 'expense' : 'income',
    amount,
    description: `${isExpense ? 'Payment for' : 'Income from'} ${category.toLowerCase()}`,
    category,
    date: randomDate(),
    receipt: null
  };
});

// Generate stats data
export const statsData = {
  monthSpent: 2450.75,
  monthRemaining: 1549.25,
  topCategory: 'Food',
  topCategoryAmount: 780.50,
  budget: 4000
};

// Generate financial overview data
export const financialOverviewData = [
  { name: 'Food', value: 780.50 },
  { name: 'Housing', value: 1200.00 },
  { name: 'Transport', value: 350.25 },
  { name: 'Shopping', value: 420.75 },
  { name: 'Entertainment', value: 230.50 },
  { name: 'Utilities', value: 180.00 },
  { name: 'Healthcare', value: 150.00 }
];

// Colors for charts
export const COLORS = ['#4f46e5', '#10b981', '#f97316', '#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b'];