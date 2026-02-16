import React, { useState, useEffect, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Plus,
  DollarSign,
  ArrowDown,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  PieChart as PieChartIcon,
  BarChart2,
  Wallet,
  PiggyBank,
  TrendingUp as ProfitIcon,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import axios from "axios";
import AddTransactionModal from "../components/Add";
import FinancialCard from "../components/FinancialCard";
import GaugeCard from "../components/GaugeCard";
import { getTimeFrameRange, getPreviousTimeFrameRange, calculateData } from "../components/Helpers";
import { GAUGE_COLORS, COLORS, INCOME_CATEGORY_ICONS, EXPENSE_CATEGORY_ICONS } from "../assets/color";
import { dashboardStyles, trendStyles, chartStyles } from "../assets/dummyStyles";

const API_BASE = "http://localhost:4000/api";

const getAuthHeader = () => {
  const token = localStorage.getItem("token") || localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Helper: convert date (or datetime) to ISO by attaching client current time
 * - If `dateValue` is "YYYY-MM-DD" (length 10) => attach current HH:MM:SS
 * - Otherwise attempt to parse and return ISO
 * - Fallback to now if parsing fails
 */
function toIsoWithClientTime(dateValue) {
  if (!dateValue) {
    return new Date().toISOString();
  }

  // Plain date YYYY-MM-DD
  if (typeof dateValue === "string" && dateValue.length === 10) {
    const now = new Date();
    const hhmmss = now.toTimeString().slice(0, 8); // "HH:MM:SS"
    const combined = new Date(`${dateValue}T${hhmmss}`);
    return combined.toISOString();
  }

  // Already a datetime or ISO-like string
  try {
    return new Date(dateValue).toISOString();
  } catch (err) {
    return new Date().toISOString();
  }
}

const Dashboard = () => {
  // Get refreshTransactions from the outlet context
  const { 
    transactions: outletTransactions = [], 
    timeFrame = "monthly", 
    setTimeFrame = () => {},
    refreshTransactions 
  } = useOutletContext();

  const [showModal, setShowModal] = useState(false);
  const [gaugeData, setGaugeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [overviewMeta, setOverviewMeta] = useState({});
  const [showAllIncome, setShowAllIncome] = useState(false);
  const [showAllExpense, setShowAllExpense] = useState(false);

  const [newTransaction, setNewTransaction] = useState({
    date: new Date().toISOString().split("T")[0],
    description: "",
    amount: "",
    type: "expense",
    category: "Food",
  });

  const timeFrameRange = useMemo(() => getTimeFrameRange(timeFrame), [timeFrame]);
  const prevTimeFrameRange = useMemo(() => getPreviousTimeFrameRange(timeFrame), [timeFrame]);

  // Function to check if a date is within a range (date-portion comparison)
  const isDateInRange = (date, start, end) => {
    const transactionDate = new Date(date);
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    // Compare based on day range — include full end day
    transactionDate.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    return transactionDate >= startDate && transactionDate <= endDate;
  };

  const filteredTransactions = useMemo(
    () => (outletTransactions || []).filter((t) => 
      isDateInRange(t.date, timeFrameRange.start, timeFrameRange.end)
    ),
    [outletTransactions, timeFrameRange]
  );

  const prevFilteredTransactions = useMemo(
    () => (outletTransactions || []).filter((t) => 
      isDateInRange(t.date, prevTimeFrameRange.start, prevTimeFrameRange.end)
    ),
    [outletTransactions, prevTimeFrameRange]
  );

  // Calculated data (fallback)
  const currentTimeFrameData = useMemo(() => {
    const data = calculateData(filteredTransactions);
    data.savings = data.income - data.expenses;
    return data;
  }, [filteredTransactions]);

  const prevTimeFrameData = useMemo(() => {
    const data = calculateData(prevFilteredTransactions);
    data.savings = data.income - data.expenses;
    return data;
  }, [prevFilteredTransactions]);

  // Update gauge data when time frame changes or currentTimeFrameData changes
  useEffect(() => {
    const maxValues = {
      income: Math.max(currentTimeFrameData.income, 5000),
      expenses: Math.max(currentTimeFrameData.expenses, 3000),
      savings: Math.max(Math.abs(currentTimeFrameData.savings), 2000),
    };

    setGaugeData([
      { name: "Income", value: currentTimeFrameData.income, max: maxValues.income },
      { name: "Spent", value: currentTimeFrameData.expenses, max: maxValues.expenses },
      { name: "Savings", value: currentTimeFrameData.savings, max: maxValues.savings },
    ]);
  }, [currentTimeFrameData, timeFrame]);

  // Use overviewMeta (server) when available for the monthly summary cards,
  // otherwise fall back to locally computed values.
  const displayIncome =
    timeFrame === "monthly" && typeof overviewMeta.monthlyIncome === "number"
      ? overviewMeta.monthlyIncome
      : currentTimeFrameData.income;

  const displayExpenses =
    timeFrame === "monthly" && typeof overviewMeta.monthlyExpense === "number"
      ? overviewMeta.monthlyExpense
      : currentTimeFrameData.expenses;

  const displaySavings =
    timeFrame === "monthly" && typeof overviewMeta.savings === "number"
      ? overviewMeta.savings
      : currentTimeFrameData.savings;

  // Expense change percentage (safe guard when prev is 0)
  const expenseChange = useMemo(() => {
    const prev = prevTimeFrameData.expenses;
    const curr = displayExpenses;
    if (!prev) {
      if (!curr) return 0;
      return 100;
    }
    return Math.round(((curr - prev) / prev) * 100);
  }, [prevTimeFrameData, displayExpenses]);

  // Expense distribution — prefer server distribution when provided
  const financialOverviewData = useMemo(() => {
    if (
      timeFrame === "monthly" &&
      overviewMeta.expenseDistribution &&
      Array.isArray(overviewMeta.expenseDistribution) &&
      overviewMeta.expenseDistribution.length > 0
    ) {
      return overviewMeta.expenseDistribution.map((d) => ({
        name: d.category,
        value: Math.round(Number(d.amount) || 0),
      }));
    }

    const categories = {};
    filteredTransactions.forEach((transaction) => {
      if (transaction.type === "expense") {
        categories[transaction.category] =
          (categories[transaction.category] || 0) + transaction.amount;
      }
    });

    return Object.keys(categories).map((category) => ({
      name: category,
      value: Math.round(categories[category]),
    }));
  }, [filteredTransactions, overviewMeta, timeFrame]);

  // build server-provided recent lists (if present) and fall back to filtered lists
  const serverRecent = overviewMeta.recentTransactions || [];
  const serverRecentIncome = serverRecent
    .filter((t) => t.type === "income")
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const serverRecentExpense = serverRecent
    .filter((t) => t.type === "expense")
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const incomeTransactions = useMemo(
    () => filteredTransactions
      .filter((t) => t.type === "income")
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [filteredTransactions]
  );

  const expenseTransactions = useMemo(
    () => filteredTransactions
      .filter((t) => t.type === "expense")
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [filteredTransactions]
  );

  // For monthly time frame, use server data if available, otherwise use filtered data
  // For daily/weekly, always use filtered data
  const incomeListForDisplay =
    timeFrame === "monthly" && serverRecentIncome.length > 0
      ? serverRecentIncome
      : incomeTransactions;

  const expenseListForDisplay =
    timeFrame === "monthly" && serverRecentExpense.length > 0
      ? serverRecentExpense
      : expenseTransactions;

  // Determine how many transactions to show based on showAll state
  const displayedIncome = showAllIncome 
    ? incomeListForDisplay 
    : incomeListForDisplay.slice(0, 3);

  const displayedExpense = showAllExpense 
    ? expenseListForDisplay 
    : expenseListForDisplay.slice(0, 3);

  // fetches server-side aggregates and recent transactions
  const fetchDashboardOverview = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/dashboard`, {
        headers: getAuthHeader(),
      });
      if (res?.data?.success) {
        const data = res.data.data;

        // normalize recent transactions for overview
        // IMPORTANT: keep the full ISO timestamp in `date` so charting by hour works
        const recent = (data.recentTransactions || []).map((item) => {
          const typeFromServer =
            item.type || (item.category ? "expense" : "income");
          const amountNum = Number(item.amount) || 0;
          // Keep full ISO timestamp for date (fallback to createdAt or now)
          const isoDate = item.date
            ? new Date(item.date).toISOString()
            : item.createdAt
            ? new Date(item.createdAt).toISOString()
            : new Date().toISOString();

          return {
            id: item._id || item.id || Date.now() + Math.random(),
            date: isoDate, // full ISO timestamp (preserves hour)
            description:
              item.description ||
              item.note ||
              item.title ||
              (typeFromServer === "income"
                ? item.source || "Income"
                : item.category || "Expense"),
            amount: amountNum,
            type: typeFromServer,
            category:
              item.category ||
              (typeFromServer === "income" ? "Salary" : "Other"),
            raw: item,
          };
        });

        // store recent in overview meta
        setOverviewMeta((prev) => ({
          ...prev,
          monthlyIncome: Number(data.monthlyIncome || 0),
          monthlyExpense: Number(data.monthlyExpense || 0),
          savings:
            typeof data.savings !== "undefined"
              ? Number(data.savings)
              : Number(data.monthlyIncome || 0) - Number(data.monthlyExpense || 0),
          savingsRate:
            typeof data.savingsRate !== "undefined" ? data.savingsRate : null,
          spendByCategory: data.spendByCategory || {},
          expenseDistribution: data.expenseDistribution || [],
          recentTransactions: recent,
        }));

        // For monthly time frame, use server data for gauges
        if (timeFrame === "monthly") {
          const monthlyIncome = Number(data.monthlyIncome || 0);
          const monthlyExpense = Number(data.monthlyExpense || 0);
          const savings =
            typeof data.savings !== "undefined"
              ? Number(data.savings)
              : monthlyIncome - monthlyExpense;

          const maxValues = {
            income: Math.max(monthlyIncome, 5000),
            expenses: Math.max(monthlyExpense, 3000),
            savings: Math.max(Math.abs(savings), 2000),
          };

          setGaugeData([
            { name: "Income", value: monthlyIncome, max: maxValues.income },
            { name: "Spent", value: monthlyExpense, max: maxValues.expenses },
            { name: "Savings", value: savings, max: maxValues.savings },
          ]);
        }
      } else {
        console.warn("Dashboard endpoint returned success:false", res?.data);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard overview:", err?.response || err.message || err);
    } finally {
      setLoading(false);
    }
  };

  // initial load: fetch overview
  useEffect(() => {
    fetchDashboardOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add / edit / delete handlers
  const handleAddTransaction = async () => {
    if (!newTransaction.description || !newTransaction.amount) return;

    // Build payload: convert date-only to ISO with client time to preserve hour
    const payload = {
      date: toIsoWithClientTime(newTransaction.date),
      description: newTransaction.description,
      amount: parseFloat(newTransaction.amount),
      category: newTransaction.category,
    };

    try {
      setLoading(true);
      if (newTransaction.type === "income") {
        await axios.post(`${API_BASE}/income/add`, payload, {
          headers: getAuthHeader(),
        });
      } else {
        await axios.post(`${API_BASE}/expense/add`, payload, {
          headers: getAuthHeader(),
        });
      }

      // Refresh the layout data after successful addition
      await refreshTransactions();
      
      // Refresh the dashboard overview
      await fetchDashboardOverview();

      // reset the add form and close modal
      setNewTransaction({
        date: new Date().toISOString().split("T")[0],
        description: "",
        amount: "",
        type: "expense",
        category: "Food",
      });
      setShowModal(false);
    } catch (err) {
      console.error("Failed to add transaction:", err?.response || err.message || err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={dashboardStyles.container}>
      {/* Header */}
      <div className={dashboardStyles.headerContainer}>
        <div className={dashboardStyles.headerContent}>
          <div>
            <h1 className={dashboardStyles.headerTitle}>
              Finance Dashboard
            </h1>
            <p className={dashboardStyles.headerSubtitle}>Track your income and expenses</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className={dashboardStyles.addButton}
          >
            <Plus size={20} />
            Add Transaction
          </button>
        </div>

        {/* Time Frame Selector */}
        <div className={dashboardStyles.timeFrameContainer}>
          <div className={dashboardStyles.timeFrameWrapper}>
            {["daily", "weekly", "monthly"].map((frame) => (
              <button
                key={frame}
                onClick={() => setTimeFrame(frame)}
                className={dashboardStyles.timeFrameButton(timeFrame === frame)}
              >
                {frame.charAt(0).toUpperCase() + frame.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className={dashboardStyles.summaryGrid}>
        <FinancialCard
          icon={
            <div className={dashboardStyles.walletIconContainer}>
              <Wallet className="w-5 h-5 text-teal-600" />
            </div>
          }
          label="Total Balance"
          value={`$${Math.round(displayIncome - displayExpenses).toLocaleString()}`}
          additionalContent={
            <div className="flex items-center gap-2 mt-2 text-sm">
              <span className={dashboardStyles.balanceBadge}>
                +${Math.round(displayIncome).toLocaleString()}
              </span>
              <span className={dashboardStyles.expenseBadge}>
                -${Math.round(displayExpenses).toLocaleString()}
              </span>
            </div>
          }
        />

        <FinancialCard
          icon={
            <div className={dashboardStyles.arrowDownIconContainer}>
              <ArrowDown className="w-5 h-5 text-orange-600" />
            </div>
          }
          label={`${timeFrameRange.label} Expenses`}
          value={`$${Math.round(displayExpenses).toLocaleString()}`}
          additionalContent={
            <div className={`mt-2 text-xs flex items-center gap-1 ${expenseChange >= 0 ? trendStyles.positive : trendStyles.negative}`}>
              {expenseChange >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span>
                {Math.abs(expenseChange)}%{" "}
                {expenseChange >= 0 ? "increase" : "decrease"} from{" "}
                {prevTimeFrameRange.label}
              </span>
            </div>
          }
        />

        <FinancialCard
          icon={
            <div className={dashboardStyles.piggyBankIconContainer}>
              <PiggyBank className="w-5 h-5 text-cyan-600" />
            </div>
          }
          label={`${timeFrameRange.label} Savings`}
          value={`$${Math.round(displaySavings).toLocaleString()}`}
          additionalContent={
            <div className="mt-2 text-xs text-cyan-600 flex items-center gap-2">
              <div className="flex items-center gap-1">
                <BarChart2 className="w-4 h-4" />
                <span>
                  {displayIncome > 0
                    ? Math.round((displaySavings / displayIncome) * 100)
                    : 0}
                  % of income
                </span>
              </div>

              {typeof overviewMeta.savingsRate === "number" && (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  overviewMeta.savingsRate < 0 ? trendStyles.negativeRate : trendStyles.positiveRate
                }`}>
                  {overviewMeta.savingsRate}%
                </span>
              )}
            </div>
          }
        />
      </div>

      {/* Gauges */}
      <div className={dashboardStyles.gaugeGrid}>
        {gaugeData.map((gauge) => (
          <GaugeCard
            key={gauge.name}
            gauge={gauge}
            colorInfo={GAUGE_COLORS[gauge.name]}
            timeFrameLabel={timeFrameRange.label}
          />
        ))}
      </div>

      {/* Expense distribution pie - Hidden on mobile */}
      <div className={dashboardStyles.pieChartContainer}>
        <div className={dashboardStyles.pieChartHeader}>
          <h3 className={dashboardStyles.pieChartTitle}>
            <PieChartIcon className="w-6 h-6 text-teal-500" />
            Expense Distribution
            <span className={dashboardStyles.listSubtitle}> ({timeFrameRange.label})</span>
          </h3>
        </div>

        <div className={dashboardStyles.pieChartHeight}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart className={chartStyles.pieChart}>
              <Pie
                data={financialOverviewData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) =>
                  `${name}: ${Math.round(percent * 100)}%`
                }
                labelLine={false}
              >
                {financialOverviewData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`$${Math.round(value).toLocaleString()}`, "Amount"]}
                contentStyle={dashboardStyles.tooltipContent}
                itemStyle={dashboardStyles.tooltipItem}
              />
              <Legend
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                formatter={(v) => (
                  <span className={dashboardStyles.legendText}>{v}</span>
                )}
                iconSize={10}
                iconType="circle"
                wrapperStyle={dashboardStyles.legendWrapper}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Income & Expense lists - Made responsive */}
      <div className={dashboardStyles.listsGrid}>
        {/* Income Column */}
        <div className={dashboardStyles.listContainer}>
          <div className={dashboardStyles.listHeader}>
            <h3 className={dashboardStyles.listTitle}>
              <ProfitIcon className="w-6 h-6 text-green-500" /> Recent Income{" "}
              <span className={dashboardStyles.listSubtitle}> ({timeFrameRange.label})</span>
            </h3>
            <span className={dashboardStyles.incomeCountBadge}>
              {incomeListForDisplay.length} records
            </span>
          </div>

          <div className={dashboardStyles.transactionList}>
            {displayedIncome.map((transaction) => {
              const IconComponent = INCOME_CATEGORY_ICONS[transaction.category] || INCOME_CATEGORY_ICONS.Other;
              return (
                <div key={transaction.id} className={dashboardStyles.incomeTransactionItem}>
                  <div className={dashboardStyles.transactionContent}>
                    <div className={dashboardStyles.incomeIconContainer}>
                      {IconComponent}
                    </div>
                    <div>
                      <p className={dashboardStyles.transactionDescription}>{transaction.description}</p>
                      <p className={dashboardStyles.transactionCategory}>{transaction.category}</p>
                    </div>
                  </div>
                  <div className={dashboardStyles.transactionAmount}>
                    <p className={dashboardStyles.incomeAmount}>+${Math.abs(transaction.amount).toLocaleString()}</p>
                    <p className={dashboardStyles.transactionDate}>{new Date(transaction.date).toLocaleDateString()}</p>
                  </div>
                </div>
              );
            })}

            {incomeListForDisplay.length === 0 && (
              <div className={dashboardStyles.emptyState}>
                <div className={dashboardStyles.emptyIconContainer("bg-green-50")}>
                  <DollarSign className="w-8 h-8 text-green-400" />
                </div>
                <p className={dashboardStyles.emptyText}>No income transactions</p>
              </div>
            )}

            {incomeListForDisplay.length > 3 && (
              <div className={dashboardStyles.viewAllContainer}>
                <button 
                  onClick={() => setShowAllIncome(!showAllIncome)}
                  className={dashboardStyles.viewAllButton}
                >
                  {showAllIncome ? (
                    <>
                      <ChevronUp className="w-5 h-5" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-5 h-5" />
                      View All Income ({incomeListForDisplay.length})
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Expense Column */}
        <div className={dashboardStyles.listContainer}>
          <div className={dashboardStyles.listHeader}>
            <h3 className="text-lg md:text-xl lg:text-xl xl:text-xl font-bold text-gray-800 md:mt-3 mt-3 flex items-center gap-3">
              <ArrowDown className="w-6 h-6 text-orange-500" /> Recent Expenses{" "}
              <span className={dashboardStyles.listSubtitle}> ({timeFrameRange.label})</span>
            </h3>
            <span className={dashboardStyles.expenseCountBadge}>
              {expenseListForDisplay.length} records
            </span>
          </div>

          <div className={dashboardStyles.transactionList}>
            {displayedExpense.map((transaction) => {
              const IconComponent = EXPENSE_CATEGORY_ICONS[transaction.category] || EXPENSE_CATEGORY_ICONS.Other;
              return (
                <div key={transaction.id} className={dashboardStyles.expenseTransactionItem}>
                  <div className={dashboardStyles.transactionContent}>
                    <div className={dashboardStyles.expenseIconContainer}>
                      {IconComponent}
                    </div>
                    <div>
                      <p className={dashboardStyles.transactionDescription}>{transaction.description}</p>
                      <p className={dashboardStyles.transactionCategory}>{transaction.category}</p>
                    </div>
                  </div>
                  <div className={dashboardStyles.transactionAmount}>
                    <p className={dashboardStyles.expenseAmount}>-${Math.abs(transaction.amount).toLocaleString()}</p>
                    <p className={dashboardStyles.transactionDate}>{new Date(transaction.date).toLocaleDateString()}</p>
                  </div>
                </div>
              );
            })}

            {expenseListForDisplay.length === 0 && (
              <div className={dashboardStyles.emptyState}>
                <div className={dashboardStyles.emptyIconContainer("bg-orange-50")}>
                  <ShoppingCart className="w-8 h-8 text-orange-400" />
                </div>
                <p className={dashboardStyles.emptyText}>No expense transactions</p>
              </div>
            )}

            {expenseListForDisplay.length > 3 && (
              <div className={dashboardStyles.viewAllContainer}>
                <button 
                  onClick={() => setShowAllExpense(!showAllExpense)}
                  className={dashboardStyles.viewAllButton}
                >
                  {showAllExpense ? (
                    <>
                      <ChevronUp className="w-5 h-5" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-5 h-5" />
                      View All Expenses ({expenseListForDisplay.length})
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Transaction Modal */}
      <AddTransactionModal
        showModal={showModal}
        setShowModal={setShowModal}
        newTransaction={newTransaction}
        setNewTransaction={setNewTransaction}
        handleAddTransaction={handleAddTransaction}
        loading={loading}
      />
    </div>
  );
};

export default Dashboard;
