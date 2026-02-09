

const totalIncome = incomes.reduce((acc, cur) => acc + cur.amount, 0);
const averageIncome = incomes.length > 0 ? totalIncome / incomes.length : 0;
const numberOfTransactions = incomes.length;

const recentTransactions = incomes.slice(0, 9);