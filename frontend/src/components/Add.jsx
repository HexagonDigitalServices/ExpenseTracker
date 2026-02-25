const AddTransactionModal = ({
  showModal,
  setShowModal,
  newTransaction,
  setNewTransaction,
  handleAddTransaction,
  type = "both",
  title = "Add New Transaction",
  buttonText = "Add Transaction",
  categories = ["Food", "Housing", "Transport", "Shopping", "Entertainment", "Utilities", "Healthcare", "Salary", "Freelance", "Investments","Bonus" , "Other"],
  color = "teal"
}) => {
  if (!showModal) return null;

  // Get current date in YYYY-MM-DD format
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentDate = today.toISOString().split('T')[0];
  const minDate = `${currentYear}-01-01`;

  const colorClass = modalStyles.colorClasses[color];
}


            {type === "both" && (
              <div>
                <label className={modalStyles.label}>Type</label>
                <div className={modalStyles.typeButtonContainer}>
                  <button 
                    type="button"
                    className={modalStyles.typeButton(
                      newTransaction.type === 'income', 
                      modalStyles.colorClasses.teal.typeButtonSelected
                    )}
                    onClick={() => setNewTransaction(prev => ({...prev, type: 'income'}))}
                  >
                    Income
                  </button>
                  <button 
                    type="button"
                    className={modalStyles.typeButton(
                      newTransaction.type === 'expense', 
                      modalStyles.colorClasses.orange.typeButtonSelected
                    )}
                    onClick={() => setNewTransaction(prev => ({...prev, type: 'expense'}))}
                  >
                    Expense
                  </button>
                </div>
              </div>
            )}
