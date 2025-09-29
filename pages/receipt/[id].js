import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import { useReceipts } from "../../hooks/useReceipts";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import ReceiptHeader from "../../components/features/ReceiptHeader";
import ExpenseBreakdown from "../../components/features/ExpenseBreakdown";
import ItemsList from "../../components/features/ItemsList";
import ReceiptSummary from "../../components/features/ReceiptSummary";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { finalizeShares } from "../../utils/finalize";

export default function ReceiptView() {
  const router = useRouter();
  const receiptId = router.query.id;

  const {
    receipt,
    items,
    members,
    userProfiles,
    currentUser,
    itemClaims,
    loading,
    error,
    claimQuantity,
    unclaimItem,
    updateItem,
    addItem,
    updateReceiptName,
    deleteReceipt,
    refreshData,
    getTotalClaimedQuantity,
    getMyClaimedQuantity,
    getAvailableQuantity,
  } = useReceipts(receiptId);

  const [editingMode, setEditingMode] = useState(false);
  const [showExpenseBreakdown, setShowExpenseBreakdown] = useState(false);
  const [splittingItem, setSplittingItem] = useState(null);
  const [splitShares, setSplitShares] = useState({});

  // Handle special states
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="large" className="mb-4" />
          <p className="text-gray-600">Loading receipt...</p>
        </div>
      </div>
    );
  }

  if (receipt === "DELETED" || error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 18.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Receipt Not Found
          </h2>
          <p className="text-gray-600 mb-6">
            This receipt may have been deleted or you don't have permission to
            view it.
          </p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const handleFinalize = async () => {
    if (!currentUser || receipt.uploader_user_id !== currentUser.id) return;

    try {
      // Transform items and claims into the format expected by finalizeShares
      const itemsForFinalization = [];

      for (const item of items) {
        if (item.available === false) continue; // Skip unavailable items

        const claims = itemClaims[item.id] || [];

        if (claims.length === 0) {
          // Unclaimed item
          itemsForFinalization.push({
            id: item.id,
            total_price: parseFloat(item.total_price || 0),
            claimed_by: null,
          });
        } else {
          // Split item proportionally among claimers
          const totalShares = claims.reduce(
            (sum, claim) => sum + claim.claimed_quantity,
            0
          );
          const itemPrice = parseFloat(item.total_price || 0);

          for (const claim of claims) {
            const shareRatio = claim.claimed_quantity / totalShares;
            const claimPrice = itemPrice * shareRatio;

            itemsForFinalization.push({
              id: `${item.id}_${claim.user_id}`,
              total_price: claimPrice,
              claimed_by: claim.user_id,
            });
          }
        }
      }

      console.log("Items for finalization:", itemsForFinalization);

      const finalizedShares = finalizeShares(
        itemsForFinalization,
        parseFloat(receipt.tax_total || 0),
        parseFloat(receipt.tip_total || 0)
      );

      console.log("Finalized shares result:", finalizedShares);

      const { error } = await supabase
        .from("receipts")
        .update({
          status: "finalized",
          finalized_shares: finalizedShares.perUser,
        })
        .eq("id", receiptId);

      if (error) throw error;

      refreshData();
    } catch (error) {
      console.error("Error finalizing receipt:", error);
      alert("Failed to finalize receipt: " + error.message);
    }
  };

  const handleUndoFinalization = async () => {
    if (!currentUser || receipt.uploader_user_id !== currentUser.id) return;

    try {
      const { error } = await supabase
        .from("receipts")
        .update({
          status: "open",
          finalized_shares: null,
        })
        .eq("id", receiptId);

      if (error) throw error;

      refreshData();
    } catch (error) {
      console.error("Error undoing finalization:", error);
      alert("Failed to reopen receipt: " + error.message);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this receipt? This cannot be undone."
      )
    ) {
      return;
    }

    const result = await deleteReceipt();
    if (result.success) {
      router.push(`/group/${receipt.group_id}`);
    } else {
      alert("Failed to delete receipt: " + result.error);
    }
  };

  const updateReceipt = async (updates) => {
    try {
      const { error } = await supabase
        .from("receipts")
        .update(updates)
        .eq("id", receiptId);

      if (error) throw error;

      refreshData();
      return { success: true };
    } catch (error) {
      console.error("Error updating receipt:", error);
      return { success: false, error: error.message };
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <ReceiptHeader
          receipt={receipt}
          currentUser={currentUser}
          userProfiles={userProfiles}
          editingMode={editingMode}
          onToggleEditMode={() => setEditingMode(!editingMode)}
          onFinalize={handleFinalize}
          onUndoFinalization={handleUndoFinalization}
          onDeleteReceipt={handleDelete}
          onUpdateReceiptName={updateReceiptName}
        />

        <ExpenseBreakdown
          receipt={receipt}
          userProfiles={userProfiles}
          items={items}
          itemClaims={itemClaims}
        />

        <ReceiptSummary
          receipt={receipt}
          currentUser={currentUser}
          editingMode={editingMode}
          onUpdateReceipt={updateReceipt}
          onFinalize={handleFinalize}
          onShowExpenseBreakdown={() => setShowExpenseBreakdown(true)}
          items={items}
          refreshData={refreshData}
        />

        <ItemsList
          items={items}
          currentUser={currentUser}
          receipt={receipt}
          editingMode={editingMode}
          itemClaims={itemClaims}
          userProfiles={userProfiles}
          onClaimQuantity={claimQuantity}
          onUnclaimItem={unclaimItem}
          onUpdateItem={updateItem}
          onAddItem={addItem}
          getTotalClaimedQuantity={getTotalClaimedQuantity}
          getMyClaimedQuantity={getMyClaimedQuantity}
          getAvailableQuantity={getAvailableQuantity}
          members={members}
          splittingItem={splittingItem}
          setSplittingItem={setSplittingItem}
          splitShares={splitShares}
          setSplitShares={setSplitShares}
        />

        {/* Expense Breakdown Modal */}
        <Modal
          isOpen={showExpenseBreakdown}
          onClose={() => setShowExpenseBreakdown(false)}
          title="Expense Breakdown"
          size="large"
        >
          <div className="space-y-4">
            {/* Preview breakdown logic would go here */}
            <p className="text-gray-600">
              Expense breakdown preview functionality would be implemented here.
            </p>
          </div>
        </Modal>
      </div>
    </div>
  );
}
