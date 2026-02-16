{ 
  showModal, 
  setShowModal, 
  newTransaction, 
  setNewTransaction, 
  handleAddTransaction,
  type = "both",
  title = "Add New Transaction",
  buttonText = "Add Transaction",
  categories = ["Food", "Housing", "Transport", "Shopping", "Entertainment", "Utilities", "Healthcare", "Salary", "Freelance"],
  color = "teal"
}

  if (!showModal) return null;

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentDate = today.toISOString().split('T')[0];
  const minDate = `${currentYear}-01-01`;
  const colorClass = modalStyles.colorClasses[color];
  