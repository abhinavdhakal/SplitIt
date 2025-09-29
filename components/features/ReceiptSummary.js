import { useState } from "react";

export default function ReceiptSummary({
  receipt,
  currentUser,
  editingMode,
  onUpdateReceipt,
  onFinalize,
  onShowExpenseBreakdown,
  items,
  refreshData,
}) {
  const [editingTip, setEditingTip] = useState(false);
  const [editingTaxRate, setEditingTaxRate] = useState(false);

  const updateReceiptTip = async (newTip) => {
    if (!currentUser || receipt.uploader_user_id !== currentUser.id) {
      alert("Only the receipt uploader can edit the tip.");
      return;
    }

    try {
      const tipAmount = parseFloat(newTip);
      if (isNaN(tipAmount) || tipAmount < 0) {
        alert("Please enter a valid tip amount.");
        return;
      }

      // Recalculate total
      const newTotal =
        (receipt.subtotal || 0) + (receipt.tax_total || 0) + tipAmount;

      const result = await onUpdateReceipt({
        tip_total: tipAmount,
        total: newTotal,
      });

      setEditingTip(false);

      // Refresh data to ensure changes propagate to all users
      if (refreshData) {
        refreshData();
      }
    } catch (error) {
      console.error("Error updating tip:", error);
      alert("Error updating tip. Please try again.");
    }
  };

  const updateTaxRate = async (newTaxRate) => {
    if (!currentUser || receipt.uploader_user_id !== currentUser.id) {
      alert("Only the receipt uploader can edit the tax rate.");
      return;
    }

    try {
      const taxRate = parseFloat(newTaxRate);
      if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
        alert("Please enter a valid tax rate between 0 and 100.");
        return;
      }

      // Calculate new tax amount based on available items subtotal (not original receipt subtotal)
      const availableItems =
        items?.filter((item) => item.available !== false) || [];
      const availableSubtotal = availableItems.reduce(
        (sum, item) => sum + Number(item.total_price || 0),
        0
      );
      const newTaxAmount = (availableSubtotal * taxRate) / 100;
      const newTotal =
        availableSubtotal + newTaxAmount + Number(receipt.tip_total || 0);

      const result = await onUpdateReceipt({
        tax_total: newTaxAmount,
        total: newTotal,
      });

      setEditingTaxRate(false);

      // Refresh data to ensure changes propagate to all users
      if (refreshData) {
        refreshData();
      }
    } catch (error) {
      console.error("Error updating tax rate:", error);
      alert("Error updating tax rate. Please try again.");
    }
  };

  // Simple tax rate calculation: use available items total and original tax
  const calculateTaxRate = () => {
    const availableItems =
      items?.filter((item) => item.available !== false) || [];
    const availableSubtotal = availableItems.reduce(
      (sum, item) => sum + Number(item.total_price || 0),
      0
    );
    const originalTax = Number(receipt.tax_total || 0);

    if (availableSubtotal === 0) return 0;
    return ((originalTax / availableSubtotal) * 100).toFixed(2);
  };

  const isUploader = currentUser && receipt.uploader_user_id === currentUser.id;

  return (
    <div className="bg-white p-6 rounded shadow mb-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-bold mb-2">Receipt Summary</h2>
          <div className="space-y-1 text-sm">
            {(() => {
              // Calculate available items total
              const availableItems =
                items?.filter((item) => item.available !== false) || [];
              const availableSubtotal = availableItems.reduce(
                (sum, item) => sum + Number(item.total_price || 0),
                0
              );

              // Simple approach: calculate tax rate from available items and original tax, then apply it
              const originalTax = Number(receipt.tax_total || 0);
              const taxRatePercent = parseFloat(calculateTaxRate());
              const adjustedTax = (availableSubtotal * taxRatePercent) / 100;
              const originalSubtotal = availableSubtotal; // Keep for display consistency
              const adjustedTotal =
                availableSubtotal +
                adjustedTax +
                Number(receipt.tip_total || 0);

              return (
                <>
                  <div>
                    Subtotal (available items):{" "}
                    <span className="font-medium">
                      ${availableSubtotal.toFixed(2)}
                    </span>
                    {availableSubtotal !== originalSubtotal && (
                      <span className="text-xs text-gray-500 ml-1">
                        (was ${originalSubtotal.toFixed(2)})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Tax:</span>
                    {editingTaxRate && editingMode ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          defaultValue={calculateTaxRate()}
                          className="w-16 px-2 py-1 border rounded text-sm"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              updateTaxRate(e.target.value);
                            } else if (e.key === "Escape") {
                              setEditingTaxRate(false);
                            }
                          }}
                          autoFocus
                          onBlur={(e) => updateTaxRate(e.target.value)}
                        />
                        <span>%</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          ${adjustedTax.toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({calculateTaxRate()}%)
                        </span>
                        {editingMode && isUploader && (
                          <button
                            onClick={() => setEditingTaxRate(true)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                            title="Click to edit tax rate"
                          >
                            ✏️
                          </button>
                        )}
                        {adjustedTax !== Number(receipt.tax_total || 0) && (
                          <span className="text-xs text-gray-500 ml-1">
                            (was ${Number(receipt.tax_total || 0).toFixed(2)})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
            <div className="flex items-center gap-2">
              <span>Tip:</span>
              {editingTip && editingMode ? (
                <div className="flex items-center gap-2">
                  <span>$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={receipt.tip_total}
                    className="w-20 px-2 py-1 border rounded text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        updateReceiptTip(e.target.value);
                      } else if (e.key === "Escape") {
                        setEditingTip(false);
                      }
                    }}
                    autoFocus
                    onBlur={(e) => updateReceiptTip(e.target.value)}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-medium">${receipt.tip_total}</span>
                  {editingMode && isUploader && (
                    <button
                      onClick={() => setEditingTip(true)}
                      className="text-xs text-blue-600 hover:text-blue-800"
                      title="Click to edit tip"
                    >
                      ✏️
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="border-t pt-1 font-semibold">
              {(() => {
                const availableItems =
                  items?.filter((item) => item.available !== false) || [];
                const availableSubtotal = availableItems.reduce(
                  (sum, item) => sum + Number(item.total_price || 0),
                  0
                );
                // Simple tax calculation: use the calculated tax rate
                const taxRatePercent = parseFloat(calculateTaxRate());
                const adjustedTax = (availableSubtotal * taxRatePercent) / 100;
                const adjustedTotal =
                  availableSubtotal +
                  adjustedTax +
                  Number(receipt.tip_total || 0);

                return (
                  <>
                    Total (available): ${adjustedTotal.toFixed(2)}
                    {adjustedTotal !== Number(receipt.total || 0) && (
                      <span className="text-xs text-gray-500 ml-1">
                        (was ${Number(receipt.total || 0).toFixed(2)})
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
        <div>
          {receipt.status === "finalized" ? (
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
              Finalized
            </span>
          ) : (
            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
              Open
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
