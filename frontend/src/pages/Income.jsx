function toIsoWithClientTime(dateValue) {
  if (!dateValue) {
    return new Date().toISOString();
  }

  if (typeof dateValue === "string" && dateValue.length === 10) {
    const now = new Date();
    const hhmmss = now.toTimeString().slice(0, 8);
    const combined = new Date(`${dateValue}T${hhmmss}`);
    return combined.toISOString();
  }

  try {
    return new Date(dateValue).toISOString();
  } catch (err) {
    return new Date().toISOString();
  }
}

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

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const timeFrameRange = useMemo(() => getTimeFrameRange(timeFrame, null), [timeFrame]);
  const chartPoints = useMemo(() => generateChartPoints(timeFrame, timeFrameRange), [timeFrame, timeFrameRange]);

  const isDateInRange = useCallback((date, start, end) => {
    const transactionDate = new Date(date);
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    transactionDate.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    return transactionDate >= startDate && transactionDate <= endDate;
  }, []);

  const incomeTransactions = useMemo(
    () => (outletTransactions || [])
      .filter((t) => t.type === "income")
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [outletTransactions]
  );

  const timeFrameTransactions = useMemo(
    () => incomeTransactions.filter((t) => 
      isDateInRange(t.date, timeFrameRange.start, timeFrameRange.end)
    ),
    [incomeTransactions, timeFrameRange, isDateInRange]
  );

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

  const handleAddTransaction = useCallback(async () => {
    if (!newTransaction.description || !newTransaction.amount) return;

    try {
      setLoading(true);
      const payload = {
        description: newTransaction.description.trim(),
        amount: parseFloat(newTransaction.amount),
        category: newTransaction.category,
        date: toIsoWithClientTime(newTransaction.date),
      };

      await axios.post(`${API_BASE}/income/add`, payload, {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });

      await refreshTransactions();
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

  const handleEditTransaction = useCallback(async () => {
    if (!editingId || !editForm.description || !editForm.amount) return;

    try {
      setLoading(true);
      const payload = {
        description: editForm.description.trim(),
        amount: parseFloat(editForm.amount),
        category: editForm.category,
        date: toIsoWithClientTime(editForm.date),
      };

      await axios.put(`${API_BASE}/income/update/${editingId}`, payload, {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });

      await refreshTransactions();
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

  const handleDeleteTransaction = useCallback(async (id) => {
    if (!id) return;
    if (!window.confirm("Are you sure you want to delete this income?")) return;

    try {
      setLoading(true);
      await axios.delete(`${API_BASE}/income/delete/${id}`, {
        headers: getAuthHeaders(),
      });
      await refreshTransactions();
      
      await fetchOverview(timeFrame ?? "monthly");
    } catch (err) {
      console.error("Delete income error:", err);
      const serverMsg = err?.response?.data?.message;
      alert(serverMsg || "Server error while deleting income.");
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, refreshTransactions, fetchOverview, timeFrame]);

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