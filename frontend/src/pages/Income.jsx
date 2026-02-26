import { useState, useMemo, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Plus,
  DollarSign,
  Download,
  Eye,
  Calendar,
  TrendingUp,
  Filter,
  BarChart2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import axios from "axios";
import { exportToExcel } from "../utils/exportUtils";
import AddTransactionModal from "../components/Add";
import TransactionItem from "../components/TransactionItem";
import TimeFrameSelector from "../components/TimeFrame";
import FinancialCard from "../components/FinancialCard";
import { getTimeFrameRange, generateChartPoints } from "../components/Helpers";
import { INCOME_COLORS, CATEGORY_ICONS_Inc } from "../assets/color";
import { incomeStyles as styles } from "../assets/dummyStyles";

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

// Reusable components
const IncomeChart = ({ chartData, timeFrame, timeFrameRange }) => (
  <div className={styles.chartContainer}>
    <div className={styles.chartHeaderContainer}>
      <h3 className={styles.chartTitle}>
        <BarChart2 className="w-5 h-5 md:w-6 md:h-6 text-green-500" />
        {timeFrame === "daily" ? "Hourly" : timeFrame === "yearly" ? "Monthly" : "Daily"} Income Trends
        <span className="text-sm text-gray-500 font-normal"> ({timeFrameRange.label})</span>
      </h3>
    </div>

    <div className={styles.chartHeight}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
          <defs>
            <linearGradient id="incomeBarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#6b7280", fontSize: 12 }}
            width={50}
            tickFormatter={(value) => `$${value.toLocaleString()}`}
          />
          <Tooltip
            formatter={(value) => [`$${Math.round(value).toLocaleString()}`, "Income"]}
            contentStyle={styles.tooltipContent}
          />
          <Bar dataKey="income" name="Income" radius={[6, 6, 0, 0]} barSize={20}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={INCOME_COLORS[index % INCOME_COLORS.length]} />
            ))}
          </Bar>

          {chartData.map(
            (point, index) =>
              point.isCurrent && (
                <ReferenceLine
                  key={index}
                  x={point.label}
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                />
              )
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const FilterSection = ({ filter, setFilter, handleExport }) => (
  <div className={styles.filterContainer}>
    <div className="relative w-full sm:w-auto">
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className={styles.filterSelect}
      >
        <option value="all">All Transactions</option>
        <option value="month">This Month</option>
        <option value="year">This Year</option>
        <option value="Salary">Salary</option>
        <option value="Freelance">Freelance</option>
        <option value="Investment">Investment</option>
        <option value="Bonus">Bonus</option>
        <option value="Other">Other</option>
      </select>
      <Filter className={styles.filterIcon} />
    </div>

    <button
      onClick={handleExport}
      className={styles.exportButton}
    >
      <Download size={16} className="md:size-4" /> Export
    </button>
  </div>
);

const IncomePage = () => {
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
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState({
    totalIncome: 0,
    averageIncome: 0,
    numberOfTransactions: 0,
    recentTransactions: [],
    range: "monthly",
  });
  const [newTransaction, setNewTransaction] = useState({
    date: new Date().toISOString().split("T")[0],
    description: "",
    amount: "",
    type: "income",
    category: "Salary",
  });
  const [editForm, setEditForm] = useState({
    description: "",
    amount: "",
    category: "Salary",
    date: new Date().toISOString().split("T")[0],
  });

  // Helper: auth headers
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const timeFrameRange = useMemo(() => getTimeFrameRange(timeFrame, null), [timeFrame]);
  const chartPoints = useMemo(() => generateChartPoints(timeFrame, timeFrameRange), [timeFrame, timeFrameRange]);

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

  // Filter income transactions from outlet transactions
  const incomeTransactions = useMemo(
    () => (outletTransactions || [])
      .filter((t) => t.type === "income")
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [outletTransactions]
  );

  // Filter transactions by time frame
  const timeFrameTransactions = useMemo(
    () => incomeTransactions.filter((t) => 
      isDateInRange(t.date, timeFrameRange.start, timeFrameRange.end)
    ),
    [incomeTransactions, timeFrameRange, isDateInRange]
  );

  // Apply additional filters
  const filteredTransactions = useMemo(() => {
    if (filter === "all") return timeFrameTransactions;

    return timeFrameTransactions.filter((t) => {
      if (filter === "month" || filter === "year") {
        const transDate = new Date(t.date);
        if (filter === "month") {
          return (
            transDate.getMonth() === timeFrameRange.start.getMonth() &&
            transDate.getFullYear() === timeFrameRange.start.getFullYear()
          );
        }
        if (filter === "year") {
          return transDate.getFullYear() === timeFrameRange.start.getFullYear();
        }
      }
      return t.category.toLowerCase() === filter.toLowerCase();
    });
  }, [timeFrameTransactions, filter, timeFrameRange]);

  const chartData = useMemo(() => {
    const data = chartPoints.map((point) => ({ ...point, income: 0 }));

    filteredTransactions.forEach((transaction) => {
      const transDate = new Date(transaction.date);
      const point = data.find((d) =>
        timeFrame === "daily"
          ? d.hour === transDate.getHours()
          : timeFrame === "yearly"
          ? d.date.getMonth() === transDate.getMonth()
          : d.date.getDate() === transDate.getDate() &&
            d.date.getMonth() === transDate.getMonth()
      );
      point && (point.income += Math.round(Number(transaction.amount)));
    });

    return data;
  }, [filteredTransactions, chartPoints, timeFrame]);

  // fetch overview from backend (GET /income/overview?range=...)
  const fetchOverview = useCallback(async (range = timeFrame ?? "monthly") => {
    try {
      const res = await axios.get(`${API_BASE}/income/overview`, {
        headers: getAuthHeaders(),
        params: { range },
      });
      
      if (res.data?.success) {
        const payload = res.data.data ?? {};
        setOverview({
          totalIncome: payload.totalIncome ?? 0,
          averageIncome: payload.averageIncome ?? 0,
          numberOfTransactions: payload.numberOfTransactions ?? 0,
          recentTransactions: payload.recentTransactions ?? [],
          range: payload.range ?? range,
        });
      }
    } catch (err) {
      console.error("Failed to fetch overview:", err);
    }
  }, [timeFrame, getAuthHeaders]);

  useEffect(() => {
    fetchOverview(timeFrame ?? "monthly");
  }, [fetchOverview, timeFrame]);

  // Use backend overview when available for top cards, fallback to client calculation
  const totalIncome = useMemo(() => 
    overview.totalIncome ??
    filteredTransactions.reduce((sum, t) => sum + Math.round(Number(t.amount || 0)), 0),
    [overview.totalIncome, filteredTransactions]
  );

  const averageIncome = useMemo(() => 
    overview.averageIncome
      ? Math.round(overview.averageIncome)
      : filteredTransactions.length
      ? Math.round(filteredTransactions.reduce((s, t) => s + Math.round(Number(t.amount || 0)), 0) / filteredTransactions.length)
      : 0,
    [overview.averageIncome, filteredTransactions]
  );

  const transactionsCount = useMemo(() => 
    overview.numberOfTransactions ?? filteredTransactions.length,
    [overview.numberOfTransactions, filteredTransactions]
  );

  // API: add income (POST /income/add)
  const handleAddTransaction = useCallback(async () => {
    if (!newTransaction.description || !newTransaction.amount) return;

    try {
      setLoading(true);

      // Convert date-only ("YYYY-MM-DD") to ISO with client time before sending
      const payload = {
        description: newTransaction.description.trim(),
        amount: parseFloat(newTransaction.amount),
        category: newTransaction.category,
        date: toIsoWithClientTime(newTransaction.date),
      };

      await axios.post(`${API_BASE}/income/add`, payload, {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });

      // Refresh the layout data after successful addition
      await refreshTransactions();
      
      // Refresh the income overview
      await fetchOverview(timeFrame ?? "monthly");

      setNewTransaction({
        date: new Date().toISOString().split("T")[0],
        description: "",
        amount: "",
        type: "income",
        category: "Salary",
      });
      setShowModal(false);
    } catch (err) {
      console.error("Add income error:", err);
      const serverMsg = err?.response?.data?.message;
      alert(serverMsg || "Server error while adding income.");
    } finally {
      setLoading(false);
    }
  }, [newTransaction, getAuthHeaders, refreshTransactions, fetchOverview, timeFrame]);

  // API: edit income (PUT /income/update/:id)
  const handleEditTransaction = useCallback(async () => {
    if (!editingId || !editForm.description || !editForm.amount) return;

    try {
      setLoading(true);

      // Convert date-only ("YYYY-MM-DD") to ISO with client time before sending
      const payload = {
        description: editForm.description.trim(),
        amount: parseFloat(editForm.amount),
        category: editForm.category,
        date: toIsoWithClientTime(editForm.date),
      };

      await axios.put(`${API_BASE}/income/update/${editingId}`, payload, {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });

      // Refresh the layout data after successful edit
      await refreshTransactions();
      
      // Refresh the income overview
      await fetchOverview(timeFrame ?? "monthly");
      
      setEditingId(null);
    } catch (err) {
      console.error("Update income error:", err);
      const serverMsg = err?.response?.data?.message;
      alert(serverMsg || "Server error while updating income.");
    } finally {
      setLoading(false);
    }
  }, [editingId, editForm, getAuthHeaders, refreshTransactions, fetchOverview, timeFrame]);

  // API: delete income (DELETE /income/delete/:id)
  const handleDeleteTransaction = useCallback(async (id) => {
    if (!id) return;
    if (!window.confirm("Are you sure you want to delete this income?")) return;

    try {
      setLoading(true);
      await axios.delete(`${API_BASE}/income/delete/${id}`, {
        headers: getAuthHeaders(),
      });

      // Refresh the layout data after successful deletion
      await refreshTransactions();
      
      // Refresh the income overview
      await fetchOverview(timeFrame ?? "monthly");
    } catch (err) {
      console.error("Delete income error:", err);
      const serverMsg = err?.response?.data?.message;
      alert(serverMsg || "Server error while deleting income.");
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, refreshTransactions, fetchOverview, timeFrame]);

  // Export: call backend download endpoint and download XLSX as blob (GET /income/downloadexcel)
  const handleExport = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/income/downloadexcel`, {
        headers: getAuthHeaders(),
        responseType: "blob",
      });

      const blob = new Blob([res.data], {
        type: res.headers["content-type"] || "application/octet-stream",
      });
      const disposition = res.headers["content-disposition"];
      let filename = "income_details.xlsx";
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
      // fallback to client-side export
      try {
        const exportData = filteredTransactions.map((t) => ({
          Date: new Date(t.date).toLocaleDateString(),
          Description: t.description,
          Category: t.category,
          Amount: t.amount,
          Type: "Income",
        }));
        exportToExcel(
          exportData,
          `income_${new Date().toISOString().slice(0, 10)}`
        );
      } catch (e) {
        console.error("Fallback export failed:", e);
        alert("Failed to export data.");
      }
    }
  }, [getAuthHeaders, filteredTransactions]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.headerContainer}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.headerTitle}>
              Income Overview
            </h1>
            <p className={styles.headerSubtitle}>
              Track and manage your income sources
            </p>
          </div>
          <button 
            onClick={() => setShowModal(true)} 
            className={styles.addButton}
            disabled={loading}
          >
            <Plus size={18} className="md:size-5" /> {loading ? "Processing..." : "Add Income"}
          </button>
        </div>

        <div className={styles.timeFrameContainer}>
          <TimeFrameSelector
            timeFrame={timeFrame}
            setTimeFrame={setTimeFrame}
            options={["daily", "weekly", "monthly", "yearly"]}
            color="teal"
          />
        </div>
      </div>

      <div className={styles.summaryGrid}>
        <FinancialCard
          icon={
            <div className={styles.iconGreen}>
              <DollarSign className={`w-4 h-4 md:w-5 md:h-5 ${styles.textGreen}`} />
            </div>
          }
          label="Total Income"
          value={`$${Number(totalIncome || 0).toLocaleString()}`}
          additionalContent={
            <div className="mt-2 text-xs text-gray-500 flex items-center">
              <Calendar className="w-3 h-3 mr-1" /> {timeFrameRange.label}
            </div>
          }
        />

        <FinancialCard
          icon={
            <div className={styles.iconBlue}>
              <BarChart2 className={`w-4 h-4 md:w-5 md:h-5 ${styles.textBlue}`} />
            </div>
          }
          label="Average Income"
          value={`$${Number(averageIncome || 0).toLocaleString()}`}
          additionalContent={
            <div className="mt-2 text-xs text-gray-500 flex items-center">
              <Calendar className="w-3 h-3 mr-1" /> {transactionsCount} transactions
            </div>
          }
        />

        <FinancialCard
          icon={
            <div className={styles.iconPurple}>
              <TrendingUp className={`w-4 h-4 md:w-5 md:h-5 ${styles.textPurple}`} />
            </div>
          }
          label="Transactions"
          value={transactionsCount}
          additionalContent={
            <div className="mt-2 text-xs text-gray-500 flex items-center">
              <Calendar className="w-3 h-3 mr-1" />
              {filter === "all" ? "All records" : "Filtered records"}
            </div>
          }
        />
      </div>

      <IncomeChart chartData={chartData} timeFrame={timeFrame} timeFrameRange={timeFrameRange} />

      <div className={styles.listContainer}>
        <div className={styles.header}>
          <h3 className={styles.sectionTitle}>
            <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-green-500" />
            Income Transactions
            <span className="text-sm text-gray-500 font-normal"> ({timeFrameRange.label})</span>
          </h3>

          <FilterSection filter={filter} setFilter={setFilter} handleExport={handleExport} />
        </div>

        <div className={styles.transactionList}>
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
                type="income"
                categoryIcons={CATEGORY_ICONS_Inc}
                setEditingId={setEditingId}
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
            <div className={styles.emptyStateContainer}>
              <div className={styles.emptyStateIcon}>
                <DollarSign className="w-6 h-6 md:w-8 md:h-8 text-green-400" />
              </div>
              <p className={styles.emptyStateText}>
                No income transactions found
              </p>
              <p className={styles.emptyStateSubtext}>
                {filter === "all"
                  ? "You haven't recorded any income yet"
                  : `No ${filter} transactions found`}
              </p>
              <button
                onClick={() => setShowModal(true)}
                className={styles.emptyStateButton}
              >
                <Plus size={16} className="md:size-5" /> Add Income
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
        type="income"
        title="Add New Income"
        buttonText="Add Income"
        categories={["Salary", "Freelance", "Investment", "Bonus", "Other"]}
        color="teal"
      />
    </div>
  );
};

export default IncomePage;
