import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Plus,
  DollarSign,
  Download,
  Eye,
  Calendar,
  TrendingDown,
  Filter,
  BarChart2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import axios from "axios";
import { exportToExcel } from "../utils/exportUtils";
import FinancialCard from "../components/FinancialCard";
import TimeFrameSelector from "../components/TimeFrame";
import TransactionItem from "../components/TransactionItem";
import AddTransactionModal from "../components/Add";
import { getTimeFrameRange, generateChartPoints } from "../components/Helpers";
import { CATEGORY_ICONS } from "../assets/color";
import { expensePageStyles as styles } from "../assets/dummyStyles";

const API_BASE = "http://localhost:4000/api";

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

const ExpensePage = () => {
  // Get data from outlet context including refreshTransactions
  const { 
    transactions: outletTransactions = [], 
    timeFrame = "monthly", 
    setTimeFrame = () => {},
    refreshTransactions 
  } = useOutletContext();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    description: "",
    amount: "",
    category: "Food",
    date: new Date().toISOString().split("T")[0],
  });
  const [newTransaction, setNewTransaction] = useState({
    date: new Date().toISOString().split("T")[0],
    description: "",
    amount: "",
    type: "expense",
    category: "Food",
  });
  const [ setOverview] = useState({
    totalExpense: 0,
    averageExpense: 0,
    numberOfTransactions: 0,
    recentTransactions: [],
    range: "monthly",
  });

  // Auth headers helper
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  // Fetch overview (GET /expense/overview?range=...)
  const fetchOverview = useCallback(async (range = timeFrame ?? "monthly") => {
    try {
      const res = await axios.get(`${API_BASE}/expense/overview`, {
        headers: getAuthHeaders(),
        params: { range },
      });
      const payload = res.data?.data ?? {};
      setOverview({
        totalExpense: payload.totalExpense ?? 0,
        averageExpense: payload.averageExpense ?? 0,
        numberOfTransactions: payload.numberOfTransactions ?? 0,
        recentTransactions: payload.recentTransactions ?? [],
        range: payload.range ?? range,
      });
    } catch (err) {
      console.error("Failed to fetch expense overview:", err);
    }
  }, [timeFrame, getAuthHeaders]);

  // Initial load
  useEffect(() => {
    fetchOverview(timeFrame);
  }, [fetchOverview, timeFrame]);

  // Re-fetch overview when timeframe changes
  useEffect(() => {
    if (filter === "month" && !timeFrame) setTimeFrame("monthly");
    fetchOverview(timeFrame);
  }, [timeFrame, selectedMonth, filter, setTimeFrame, fetchOverview]);

  // Time frame range and chart points
  const timeFrameRange = useMemo(
    () => getTimeFrameRange(timeFrame, selectedMonth),
    [timeFrame, selectedMonth]
  );
  const chartPoints = useMemo(
    () => generateChartPoints(timeFrame, timeFrameRange),
    [timeFrame, timeFrameRange]
  );

  // Function to check if a date is within a range
  const isDateInRange = useCallback((date, start, end) => {
    const transactionDate = new Date(date);
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    transactionDate.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    return transactionDate >= startDate && transactionDate <= endDate;
  }, []);

  // Filter expense transactions from outlet transactions
  const expenseTransactions = useMemo(
    () => (outletTransactions || [])
      .filter(t => t.type === "expense")
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [outletTransactions]
  );

  // Filter transactions by time frame
  const timeFrameTransactions = useMemo(
    () => expenseTransactions.filter(t => 
      isDateInRange(t.date, timeFrameRange.start, timeFrameRange.end)
    ),
    [expenseTransactions, timeFrameRange, isDateInRange]
  );

  // Filter logic — month/year use current calendar by default
  const filteredTransactions = useMemo(() => {
    if (filter === "all") return timeFrameTransactions;

    const now = new Date();
    const yearFromSelectedMonth = selectedMonth ? new Date(selectedMonth).getFullYear() : null;
    const monthFromSelectedMonth = selectedMonth ? new Date(selectedMonth).getMonth() : null;
    const yearFromTimeFrame = timeFrameRange?.start ? new Date(timeFrameRange.start).getFullYear() : null;
    const monthFromTimeFrame = timeFrameRange?.start ? new Date(timeFrameRange.start).getMonth() : null;

    return timeFrameTransactions.filter(t => {
      const transDate = new Date(t.date);
      
      if (filter === "month") {
        const compareYear = yearFromSelectedMonth ?? yearFromTimeFrame ?? now.getFullYear();
        const compareMonth = monthFromSelectedMonth ?? monthFromTimeFrame ?? now.getMonth();
        return transDate.getFullYear() === compareYear && transDate.getMonth() === compareMonth;
      }

      if (filter === "year") {
        const compareYear = yearFromSelectedMonth ?? yearFromTimeFrame ?? now.getFullYear();
        return transDate.getFullYear() === compareYear;
      }

      return t.category.toLowerCase() === filter.toLowerCase();
    });
  }, [timeFrameTransactions, filter, selectedMonth, timeFrameRange]);

  // Calculate totals
  const totalExpense = useMemo(
    () => filteredTransactions.reduce((sum, t) => sum + Math.round(Number(t.amount || 0)), 0),
    [filteredTransactions]
  );
  
  const averageExpense = useMemo(
    () => filteredTransactions.length ? Math.round(totalExpense / filteredTransactions.length) : 0,
    [filteredTransactions, totalExpense]
  );

  // Prepare chart data
  const chartData = useMemo(() => {
    const data = chartPoints.map(point => ({ ...point, expense: 0 }));

    filteredTransactions.forEach(transaction => {
      const transDate = new Date(transaction.date);
      const point = data.find(d =>
        timeFrame === "daily"
          ? d.hour === transDate.getHours()
          : timeFrame === "yearly"
          ? d.date.getMonth() === transDate.getMonth()
          : d.date.getDate() === transDate.getDate() && d.date.getMonth() === transDate.getMonth()
      );
      point && (point.expense += Math.round(Number(transaction.amount)));
    });

    return data;
  }, [filteredTransactions, chartPoints, timeFrame]);

  // API request handler
  const handleApiRequest = async (method, url, data = null) => {
    try {
      setLoading(true);
      const config = {
        method,
        url: `${API_BASE}${url}`,
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      };
      
      if (data) config.data = data;
      
      const response = await axios(config);
      await refreshTransactions();
      await fetchOverview(timeFrame);
      
      return response;
    } catch (err) {
      console.error(`${method} request error:`, err);
      const serverMsg = err?.response?.data?.message;
      alert(serverMsg || `Server error while ${method === 'post' ? 'adding' : method === 'put' ? 'updating' : 'deleting'} expense.`);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Add expense -> POST /expense/add
  const handleAddTransaction = async () => {
    if (!newTransaction.description || !newTransaction.amount) return;

    try {
      // Convert date-only to ISO with client time before sending
      const payload = {
        description: newTransaction.description.trim(),
        amount: parseFloat(newTransaction.amount),
        category: newTransaction.category,
        date: toIsoWithClientTime(newTransaction.date),
      };

      await handleApiRequest('post', '/expense/add', payload);

      // If added date is outside the current visible range, switch view to that month
      const addedDate = new Date(payload.date || newTransaction.date);
      const addedDateInRange = addedDate >= timeFrameRange.start && addedDate <= timeFrameRange.end;

      if (!addedDateInRange) {
        setTimeFrame("monthly");
        setSelectedMonth(new Date(addedDate.getFullYear(), addedDate.getMonth(), 1));
      }

      setNewTransaction({
        date: new Date().toISOString().split("T")[0],
        description: "",
        amount: "",
        type: "expense",
        category: "Food",
      });
      setShowModal(false);
    } catch (err) {
      // Error handled in handleApiRequest
    }
  };

  // Edit expense -> PUT /expense/update/:id
  const handleEditTransaction = async () => {
    if (!editingId || !editForm.description || !editForm.amount) return;

    try {
      const payload = {
        description: editForm.description.trim(),
        amount: parseFloat(editForm.amount),
        category: editForm.category,
        date: toIsoWithClientTime(editForm.date),
      };

      await handleApiRequest('put', `/expense/update/${editingId}`, payload);
      setEditingId(null);
    } catch (err) {
      // Error handled in handleApiRequest
    }
  };

  // Delete expense -> DELETE /expense/delete/:id
  const handleDeleteTransaction = async (id) => {
    if (!id || !window.confirm("Are you sure you want to delete this expense?")) return;
    await handleApiRequest('delete', `/expense/delete/${id}`);
  };

  // Export -> GET /expense/downloadexcel (server) with client fallback
  const handleExport = async () => {
    try {
      const res = await axios.get(`${API_BASE}/expense/downloadexcel`, {
        headers: getAuthHeaders(),
        responseType: "blob",
      });

      const blob = new Blob([res.data], {
        type: res.headers["content-type"] || "application/octet-stream",
      });
      const disposition = res.headers["content-disposition"];
      let filename = "expense_details.xlsx";
      
      if (disposition) {
        const match = disposition.match(/filename="?(.+)"?/);
        if (match && match[1]) filename = match[1];
      }
      
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Export error:", err);
      // Fallback client export
      try {
        const exportData = filteredTransactions.map(t => ({
          Date: new Date(t.date).toLocaleDateString(),
          Description: t.description,
          Category: t.category,
          Amount: t.amount,
          Type: "Expense",
        }));
        exportToExcel(exportData, `expenses_${new Date().toISOString().slice(0, 10)}`);
      } catch (e) {
        console.error("Fallback export failed:", e);
        alert("Failed to export data.");
      }
    }
  };


  return (
    <div className={styles.container}>
      <div className={styles.headerCard}>
        <div className={styles.headerContainer}>
          <div>
            <h1 className={styles.headerTitle}>Expense Overview</h1>
            <p className={styles.headerSubtitle}>Track and manage your expenses</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className={styles.addButton}
            disabled={loading}
          >
            <Plus size={20} /> {loading ? "Processing..." : "Add Expense"}
          </button>
        </div>

        <div className={styles.timeframePositioning}>
          <TimeFrameSelector
            timeFrame={timeFrame}
            setTimeFrame={(frame) => {
              setTimeFrame(frame);
              setSelectedMonth(null);
            }}
            options={["daily", "weekly", "monthly", "yearly"]}
            color="orange"
          />
        </div>
      </div>

      <div className={styles.cardsGrid}>
        <FinancialCard
          icon={
            <div className={styles.iconOrange}>
              <DollarSign className={`w-5 h-5 ${styles.textOrange}`} />
            </div>
          }
          label="Total Expenses"
          value={`$${totalExpense.toLocaleString()}`}
          additionalContent={
            <div className="mt-2 text-xs text-gray-500 flex items-center">
              <Calendar className="w-3 h-3 mr-1" /> {timeFrameRange.label}
            </div>
          }
          borderColor={styles.borderOrange}
        />

        <FinancialCard
          icon={
            <div className={styles.iconAmber}>
              <BarChart2 className={`w-5 h-5 ${styles.textAmber}`} />
            </div>
          }
          label="Average Expense"
          value={`$${averageExpense.toLocaleString()}`}
          additionalContent={
            <div className="mt-2 text-xs text-gray-500 flex items-center">
              <Calendar className="w-3 h-3 mr-1" /> {filteredTransactions.length} transactions
            </div>
          }
          borderColor={styles.borderAmber}
        />

        <FinancialCard
          icon={
            <div className={styles.iconYellow}>
              <TrendingDown className={`w-5 h-5 ${styles.textYellow}`} />
            </div>
          }
          label="Transactions"
          value={filteredTransactions.length}
          additionalContent={
            <div className="mt-2 text-xs text-gray-500 flex items-center">
              <Calendar className="w-3 h-3 mr-1" /> {filter === "all" ? "All records" : "Filtered records"}
            </div>
          }
          borderColor={styles.borderYellow}
        />
      </div>

      <div className={styles.chartContainer}>
        <div className={styles.chartHeader}>
          <h3 className={styles.chartTitle}>
            <BarChart2 className="w-6 h-6 text-orange-500" />
            {timeFrame === "daily" ? "Hourly" : timeFrame === "yearly" ? "Monthly" : "Daily"} Expense Trends
            <span className="text-sm text-gray-500 font-normal"> ({timeFrameRange.label})</span>
          </h3>

          <button
            onClick={handleExport}
            className={styles.chartExportButton}
          >
            <Download size={18} /> Export Data
          </button>
        </div>

        <div className={styles.chartHeight}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <defs>
                <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff9800" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#ff9800" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6b7280", fontSize: 12 }}
                width={60}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
              />
              <Tooltip
                formatter={(value) => [`$${Math.round(value).toLocaleString()}`, "Expense"]}
                contentStyle={styles.tooltipContent}
              />
              <Area
                type="monotone"
                dataKey="expense"
                stroke="#ff9800"
                fill="url(#expenseGradient)"
                strokeWidth={2}
                activeDot={{ r: 6, fill: "#ff9800" }}
              />
              {chartData.map(
                (point, index) =>
                  point.isCurrent && (
                    <ReferenceLine
                      key={index}
                      x={point.label}
                      stroke="#ff5722"
                      strokeWidth={2}
                      strokeDasharray="3 3"
                    />
                  )
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={styles.transactionsContainer}>
        <div className={styles.transactionsHeader}>
          <h3 className={styles.transactionsTitle}>
            <DollarSign className="w-6 h-6 -mx-1.5 lg:-mx-2 md:-mx-0 text-orange-500" />
            Expense Transactions
            <span className="text-sm text-gray-500 font-normal"> ({timeFrameRange.label})</span>
          </h3>

          <div className="flex flex-col sm:flex-row gap-2 md:gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Transactions</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
                <option value="Food">Food</option>
                <option value="Housing">Housing</option>
                <option value="Transport">Transport</option>
                <option value="Shopping">Shopping</option>
                <option value="Entertainment">Entertainment</option>
                <option value="Utilities">Utilities</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <button
              onClick={handleExport}
              className={styles.exportButton}
            >
              <Download size={18} /> Export
            </button>
          </div>
        </div>

        <div className={styles.transactionsList}>
          {filteredTransactions
            .slice(0, showAll ? filteredTransactions.length : 8)
            .map((transaction) => (
              <TransactionItem
                key={transaction.id}
                transaction={transaction}
                isEditing={editingId === transaction.id}
                editForm={editForm}
                setEditForm={setEditForm}
                onSave={handleEditTransaction}
                onCancel={() => setEditingId(null)}
                onDelete={handleDeleteTransaction}
                type="expense"
                categoryIcons={CATEGORY_ICONS}
                setEditingId={setEditingId}
                containerClass={styles.transactionItemContainer}
                amountClass={styles.transactionAmount}
                iconClass={styles.transactionIcon}
              />
            ))}

          {!showAll && filteredTransactions.length > 8 && (
            <button
              onClick={() => setShowAll(true)}
              className={styles.viewAllButton}
            >
              <Eye size={18} /> View All {filteredTransactions.length} Transactions
            </button>
          )}

          {filteredTransactions.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>
                <DollarSign className="w-8 h-8 text-orange-400" />
              </div>
              <p className={styles.emptyStateText}>No expense transactions found</p>
              <p className={styles.emptyStateSubtext}>
                {filter === "all" ? "You haven't recorded any expenses yet" : `No ${filter} transactions found`}
              </p>
              <button
                onClick={() => setShowModal(true)}
                className={styles.addButton}
              >
                <Plus size={20} /> Add Expense
              </button>
            </div>
          )}
        </div>
      </div>

      <AddTransactionModal
        showModal={showModal}
        setShowModal={setShowModal}
        newTransaction={newTransaction}
        setNewTransaction={setNewTransaction}
        handleAddTransaction={handleAddTransaction}
        loading={loading}
        type="expense"
        title="Add New Expense"
        buttonText="Add Expense"
        categories={[
          "Food",
          "Housing",
          "Transport",
          "Shopping",
          "Entertainment",
          "Utilities",
          "Healthcare",
          "Other",
        ]}
        color="orange"
      />
    </div>
  );
};

export default ExpensePage;
