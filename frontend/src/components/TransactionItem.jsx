const TransactionItem = ({
  transaction,
  isEditing,
  editForm,
  setEditForm,
  onSave,
  onCancel,
  onDelete,
  type = "expense",
  categoryIcons,
  setEditingId,
  amountClass = "font-bold truncate block text-right",
  iconClass = "p-3 rounded-xl flex-shrink-0",
}) => {
  const [errors, setErrors] = useState({ description: "", amount: "" });

  const classes = colorClasses[type];
  const sign = type === "income" ? "+" : "-";

  const validate = () => {
    const nextErrors = { description: "", amount: "" };
    const desc = String(editForm.description ?? "").trim();
    const amtRaw = editForm.amount;
    const amt = amtRaw === "" || amtRaw === null || amtRaw === undefined ? "" : String(amtRaw).trim();

    if (!desc) {
      nextErrors.description = "Description is required.";
    }

    if (amt === "") {
      nextErrors.amount = "Amount is required.";
    }  else if (Number(amt) <= 0) {
      nextErrors.amount = "Amount must be greater than 0.";
    }

    setErrors(nextErrors);
    return !nextErrors.description && !nextErrors.amount;
  };

  const handleSaveClick = () => {
    if (validate()) {
      setErrors({ description: "", amount: "" });
      onSave();
    }
  };




     <div className={transactionItemStyles.actionsContainer}>
        <div className={transactionItemStyles.amountContainer}>
          {isEditing ? (
            <>
              <input
                type="number"
                value={editForm.amount}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, amount: e.target.value }))
                }
                className={transactionItemStyles.amountInput(
                  !!errors.amount,
                  classes,
                )}
              />
              {errors.amount && (
                <p
                  id={`amt-error-${transaction.id}`}
                  className={transactionItemStyles.errorText}
                >
                  {errors.amount}
                </p>
              )}
            </>
          ) : (
            <span
              className={transactionItemStyles.amountText(amountClass, classes)}
            >
              {sign}$
              {Number(transaction.amount).toLocaleString("en-US", {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2,
              })}
            </span>
          )}
        </div>

        <div className={transactionItemStyles.buttonsContainer}>
          {isEditing ? (
            <>
              <button
                onClick={handleSaveClick}
                className={transactionItemStyles.saveButton(classes)}
                title="Save"
              >
                <Save size={16} />
              </button>

              <button
                onClick={() => {
                  setErrors({ description: "", amount: "" });
                  onCancel();
                }}
                className={transactionItemStyles.cancelButton}
                title="Cancel"
              >
                <X size={16} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setEditForm({
                    description: transaction.description ?? "",
                    amount: transaction.amount ?? "",
                    category: transaction.category ?? "",
                    date: transaction.date ?? "",
                    type: transaction.type ?? "expense",
                  });
                  setErrors({ description: "", amount: "" });
                  setEditingId(transaction.id);
                }}
                className={transactionItemStyles.editButton(classes)}
                title="Edit"
              >
                <Edit size={16} />
              </button>

              <button
                onClick={() => onDelete(transaction.id)}
                className={transactionItemStyles.deleteButton(classes)}
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>
