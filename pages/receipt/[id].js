import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Link from "next/link";

export default function ReceiptView() {
  const router = useRouter();
  const receiptId = router.query.id;
  const [receipt, setReceipt] = useState(null);
  const [items, setItems] = useState([]);
  const [members, setMembers] = useState([]);
  const [userProfiles, setUserProfiles] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [itemClaims, setItemClaims] = useState({});
  const [splittingItem, setSplittingItem] = useState(null);
  const [splitShares, setSplitShares] = useState({});
  const [editingMode, setEditingMode] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingTip, setEditingTip] = useState(false);

  useEffect(() => {
    if (!receiptId) return;
    fetchReceipt();
    fetchItems();
    getCurrentUser();
  }, [receiptId]);

  useEffect(() => {
    if (items.length > 0) {
      fetchItemClaims();
    }
  }, [items]);

  async function getCurrentUser() {
    const { data } = await supabase.auth.getUser();
    setCurrentUser(data.user);
  }

  async function fetchReceipt() {
    const { data } = await supabase
      .from("receipts")
      .select("*")
      .eq("id", receiptId)
      .single();
    setReceipt(data);
  }
  async function fetchItems() {
    const { data } = await supabase
      .from("items")
      .select("*")
      .eq("receipt_id", receiptId);
    setItems(data || []);
  }

  async function fetchItemClaims() {
    if (items.length === 0) return;

    const itemIds = items.map((item) => item.id);
    console.log("Fetching claims for item IDs:", itemIds);

    const { data: claims, error } = await supabase
      .from("item_claims")
      .select("*")
      .in("item_id", itemIds);

    if (error) {
      console.error("Error fetching claims:", error);
      return;
    }

    console.log("Fetched claims:", claims);

    // Group claims by item_id
    const claimsMap = {};
    claims?.forEach((claim) => {
      if (!claimsMap[claim.item_id]) {
        claimsMap[claim.item_id] = [];
      }
      claimsMap[claim.item_id].push(claim);
    });

    console.log("Claims map:", claimsMap);
    setItemClaims(claimsMap);
  }

  async function loadMembers(groupId) {
    const { data } = await supabase
      .from("group_members")
      .select("user_id, role")
      .eq("group_id", groupId);
    setMembers(data || []);

    // Load user profiles for all members
    if (data && data.length > 0) {
      const userIds = data.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("user_id, display_name, email")
        .in("user_id", userIds);

      const profileMap = {};
      profiles?.forEach((profile) => {
        profileMap[profile.user_id] = profile;
      });
      setUserProfiles(profileMap);
    }
  }

  useEffect(() => {
    if (receipt) loadMembers(receipt.group_id);
  }, [receipt]);

  async function claimQuantity(itemId, quantity) {
    if (!currentUser || quantity <= 0) return;

    // Check if user already has a claim on this item
    const existingClaim = itemClaims[itemId]?.find(
      (claim) => claim.user_id === currentUser.id
    );

    if (existingClaim) {
      // Update existing claim
      await supabase
        .from("item_claims")
        .update({ claimed_quantity: quantity })
        .eq("id", existingClaim.id);
    } else {
      // Create new claim
      await supabase.from("item_claims").insert({
        item_id: itemId,
        user_id: currentUser.id,
        claimed_quantity: quantity,
      });
    }

    fetchItemClaims();
  }

  async function unclaimItem(itemId) {
    if (!currentUser) return;

    await supabase
      .from("item_claims")
      .delete()
      .eq("item_id", itemId)
      .eq("user_id", currentUser.id);

    fetchItemClaims();
  }

  // Helper functions for quantity calculations
  function getTotalClaimedQuantity(itemId) {
    return (
      itemClaims[itemId]?.reduce(
        (sum, claim) => sum + claim.claimed_quantity,
        0
      ) || 0
    );
  }

  function getMyClaimedQuantity(itemId) {
    const myClaim = itemClaims[itemId]?.find(
      (claim) => claim.user_id === currentUser?.id
    );
    return myClaim?.claimed_quantity || 0;
  }

  function getAvailableQuantity(item) {
    // If item is marked as unavailable, return 0
    if (item.available === false) return 0;
    return item.quantity - getTotalClaimedQuantity(item.id);
  }

  function startSplitting(item) {
    setSplittingItem(item);
    // Initialize with current user getting 1 share
    setSplitShares({ [currentUser.id]: 1 });
  }

  function addPersonToSplit(userId) {
    setSplitShares((prev) => ({
      ...prev,
      [userId]: prev[userId] ? prev[userId] + 1 : 1,
    }));
  }

  function removePersonFromSplit(userId) {
    setSplitShares((prev) => {
      const newShares = { ...prev };
      if (newShares[userId] > 1) {
        newShares[userId] -= 1;
      } else {
        delete newShares[userId];
      }
      return newShares;
    });
  }

  function getTotalShares() {
    return Object.values(splitShares).reduce((sum, shares) => sum + shares, 0);
  }

  async function applySplit() {
    if (!splittingItem || !currentUser) return;

    const totalShares = getTotalShares();
    if (totalShares === 0) {
      alert("Please add at least one person to split with.");
      return;
    }

    console.log("=== APPLY SPLIT DEBUG ===");
    console.log("Splitting item:", splittingItem);
    console.log("Split shares:", splitShares);
    console.log("Total shares:", totalShares);

    // Confirm the split
    const sharesList = Object.entries(splitShares)
      .map(([userId, shares]) => {
        const userName =
          userProfiles[userId]?.display_name ||
          `User ${userId.substring(0, 8)}...`;
        const percentage = ((shares / totalShares) * 100).toFixed(1);
        return `${userName}: ${shares} share${
          shares > 1 ? "s" : ""
        } (${percentage}%)`;
      })
      .join("\n");

    const confirm = window.confirm(
      `Split "${splittingItem.name}" ($${splittingItem.total_price})?\n\n` +
        `${sharesList}\n\n` +
        `Each person will pay proportionally based on their shares.`
    );

    if (!confirm) return;

    try {
      // Remove existing claims for this item
      await supabase
        .from("item_claims")
        .delete()
        .eq("item_id", splittingItem.id);

      // Create new claims based on split
      const pricePerShare = splittingItem.total_price / totalShares;

      console.log("Price per share:", pricePerShare);

      for (const [userId, shares] of Object.entries(splitShares)) {
        const claimData = {
          item_id: splittingItem.id,
          user_id: userId,
          claimed_quantity: shares, // Using shares as quantity for split items
        };

        console.log("Creating claim:", claimData);

        const { data, error } = await supabase
          .from("item_claims")
          .insert(claimData)
          .select();

        if (error) {
          console.error("Error creating claim:", error);
          throw error;
        }

        console.log("Created claim:", data);
      }

      // Note: Split applied successfully

      // Reset state and refresh
      setSplittingItem(null);
      setSplitShares({});
      console.log("Refreshing item claims...");
      await fetchItemClaims();

      // Give state a moment to update and then log
      setTimeout(() => {
        console.log("Item claims after split (delayed):", itemClaims);
      }, 100);
    } catch (error) {
      console.error("Error applying split:", error);
      alert("Error splitting item. Please try again.");
    }
  }

  async function deleteReceipt() {
    if (!currentUser || !receipt) return;

    // Check if current user is the uploader
    if (receipt.uploader_user_id !== currentUser.id) {
      alert("Only the person who uploaded this receipt can delete it.");
      return;
    }

    // Show confirmation dialog
    const isFinalized = receipt.status === "finalized";
    const confirmDelete = window.confirm(
      `Are you sure you want to delete this receipt?\n\n` +
        `Receipt: ${receipt.filename}\n` +
        `Items: ${items.length}\n` +
        `Total: $${receipt.total}\n` +
        `Status: ${isFinalized ? "FINALIZED" : "Open"}\n\n` +
        (isFinalized
          ? "⚠️  WARNING: This receipt has been finalized with calculated splits!\n" +
            "Deleting it will permanently remove all expense calculations and claims.\n\n"
          : "") +
        `This action cannot be undone and will remove all associated items and claims.`
    );
    if (!confirmDelete) return;

    try {
      // Delete the receipt (cascade will handle items and claims)
      const { error } = await supabase
        .from("receipts")
        .delete()
        .eq("id", receiptId);

      if (error) throw error;

      // Log the deletion
      await supabase.from("logs").insert([
        {
          receipt_id: receiptId,
          user_id: currentUser.id,
          action: "delete_receipt",
          details: {
            filename: receipt.filename,
            total: receipt.total,
            items_count: items.length,
          },
        },
      ]);

      // Redirect back to group
      router.push(`/group/${receipt.group_id}`);
    } catch (error) {
      console.error("Error deleting receipt:", error);
      alert("Error deleting receipt. Please try again.");
    }
  }

  async function finalizeReceipt() {
    if (!currentUser || !receipt) return;

    // Check if current user is the uploader
    if (receipt.uploader_user_id !== currentUser.id) {
      alert("Only the person who uploaded this receipt can finalize it.");
      return;
    }

    // Check if receipt is already finalized
    if (receipt.status === "finalized") {
      alert("This receipt is already finalized.");
      return;
    }

    try {
      // Load items for receipt
      const { data: receiptItems } = await supabase
        .from("items")
        .select("*")
        .eq("receipt_id", receipt.id);

      if (!receiptItems || receiptItems.length === 0) {
        alert("Cannot finalize receipt with no items.");
        return;
      }

      // Import finalization logic
      const { finalizeShares } = await import("../../utils/finalize");

      // Build claims data for finalization
      const itemsForFinalize = [];

      for (const item of receiptItems) {
        // Skip unavailable items from finalization
        if (item.available === false) {
          console.log(`Skipping unavailable item: ${item.name}`);
          continue;
        }

        const claims = itemClaims[item.id] || [];

        if (claims.length === 0) {
          // Unclaimed item - add as unclaimed
          itemsForFinalize.push({
            id: item.id,
            total_price: Number(item.total_price),
            claimed_by: null,
          });
        } else {
          // Calculate proportional shares for split items
          const totalShares = claims.reduce(
            (sum, claim) => sum + claim.claimed_quantity,
            0
          );
          const itemPrice = Number(item.total_price);

          for (const claim of claims) {
            // Calculate proportional price based on shares
            const shareRatio = claim.claimed_quantity / totalShares;
            const claimPrice = itemPrice * shareRatio;

            itemsForFinalize.push({
              id: `${item.id}_${claim.user_id}`,
              total_price: claimPrice,
              claimed_by: claim.user_id,
            });
          }

          // No need to add unclaimed portion since we're using all shares

          // Note: Using proportional shares, no unclaimed portions
        }
      }

      const result = finalizeShares(
        itemsForFinalize,
        Number(receipt.tax_total || 0),
        Number(receipt.tip_total || 0)
      );

      // Update receipt with finalized data
      const { error } = await supabase
        .from("receipts")
        .update({
          status: "finalized",
          finalized_shares: result.perUser,
          finalized_at: new Date().toISOString(),
        })
        .eq("id", receipt.id);

      if (error) throw error;

      // Finalization completed successfully

      // Refresh receipt data
      fetchReceipt();

      alert("Receipt has been finalized! Expense splits have been calculated.");
    } catch (error) {
      console.error("Error finalizing receipt:", error);
      alert("Error finalizing receipt. Please try again.");
    }
  }

  async function undoFinalization() {
    if (!currentUser || !receipt) return;

    // Check if current user is the uploader
    if (receipt.uploader_user_id !== currentUser.id) {
      alert("Only the person who uploaded this receipt can undo finalization.");
      return;
    }

    // Check if receipt is finalized
    if (receipt.status !== "finalized") {
      alert("This receipt is not finalized.");
      return;
    }

    // Show confirmation dialog
    const confirmUndo = window.confirm(
      `Are you sure you want to reopen this receipt for editing?\n\n` +
        `Receipt: ${receipt.filename}\n` +
        `Current status: FINALIZED\n\n` +
        `This will:\n` +
        `• Remove the finalized status\n` +
        `• Clear the calculated expense splits\n` +
        `• Allow people to change their claims again\n` +
        `• Require re-finalization when ready\n\n` +
        `The receipt will need to be finalized again after any changes.`
    );

    if (!confirmUndo) return;

    try {
      // Update receipt status and clear finalization data
      const { error } = await supabase
        .from("receipts")
        .update({
          status: "open",
          finalized_shares: null,
          finalized_at: null,
        })
        .eq("id", receiptId);

      if (error) throw error;

      // Log the undo action
      await supabase.from("logs").insert([
        {
          receipt_id: receiptId,
          user_id: currentUser.id,
          action: "undo_finalization",
          details: {
            filename: receipt.filename,
            previous_status: "finalized",
          },
        },
      ]);

      // Refresh receipt data
      fetchReceipt();

      alert("Receipt has been reopened for editing!");
    } catch (error) {
      console.error("Error undoing finalization:", error);
      alert("Error reopening receipt. Please try again.");
    }
  }

  // New editing functions
  async function toggleItemAvailability(itemId, currentAvailability) {
    if (!currentUser || receipt.uploader_user_id !== currentUser.id) {
      alert("Only the receipt uploader can toggle item availability.");
      return;
    }

    try {
      const { error } = await supabase
        .from("items")
        .update({ available: !currentAvailability })
        .eq("id", itemId);

      if (error) throw error;

      // Log the action
      await supabase.from("logs").insert([
        {
          receipt_id: receiptId,
          user_id: currentUser.id,
          action: "toggle_item_availability",
          details: {
            itemId,
            from: currentAvailability,
            to: !currentAvailability,
          },
        },
      ]);

      fetchItems(); // Refresh items
    } catch (error) {
      console.error("Error toggling item availability:", error);
      alert("Error updating item. Please try again.");
    }
  }

  async function updateItem(itemId, updates) {
    if (!currentUser || receipt.uploader_user_id !== currentUser.id) {
      alert("Only the receipt uploader can edit items.");
      return;
    }

    try {
      const { error } = await supabase
        .from("items")
        .update(updates)
        .eq("id", itemId);

      if (error) throw error;

      // Log the action
      await supabase.from("logs").insert([
        {
          receipt_id: receiptId,
          user_id: currentUser.id,
          action: "edit_item",
          details: { itemId, updates },
        },
      ]);

      fetchItems(); // Refresh items
      setEditingItem(null); // Close editing mode
    } catch (error) {
      console.error("Error updating item:", error);
      alert("Error updating item. Please try again.");
    }
  }

  async function updateReceiptTip(newTip) {
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

      const { error } = await supabase
        .from("receipts")
        .update({
          tip_total: tipAmount,
          total: newTotal,
        })
        .eq("id", receiptId);

      if (error) throw error;

      // Log the action
      await supabase.from("logs").insert([
        {
          receipt_id: receiptId,
          user_id: currentUser.id,
          action: "edit_tip",
          details: { from: receipt.tip_total, to: tipAmount },
        },
      ]);

      fetchReceipt(); // Refresh receipt
      setEditingTip(false); // Close editing mode
    } catch (error) {
      console.error("Error updating tip:", error);
      alert("Error updating tip. Please try again.");
    }
  }

  if (!receipt) return <div className="p-6">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Receipt Details</h1>
            <p className="text-sm text-gray-600">{receipt.filename}</p>
            {receipt.uploader_user_id && (
              <p className="text-xs text-gray-500 mt-1">
                Uploaded by{" "}
                {userProfiles[receipt.uploader_user_id]?.display_name ||
                  "Unknown user"}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Edit mode toggle - only show to uploader for open receipts */}
            {currentUser &&
              receipt.uploader_user_id === currentUser.id &&
              receipt.status !== "finalized" && (
                <button
                  onClick={() => setEditingMode(!editingMode)}
                  className={`px-3 py-2 text-sm rounded hover:bg-purple-700 transition-colors flex items-center gap-1 ${
                    editingMode
                      ? "bg-purple-600 text-white"
                      : "bg-purple-100 text-purple-700 hover:bg-purple-200"
                  }`}
                  title="Edit receipt items and amounts"
                >
                  ✏️ {editingMode ? "Exit Edit" : "Edit"}
                </button>
              )}
            {/* Finalize button - only show to uploader for open receipts */}
            {currentUser &&
              receipt.uploader_user_id === currentUser.id &&
              receipt.status !== "finalized" && (
                <button
                  onClick={finalizeReceipt}
                  className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                  title="Calculate final expense splits"
                >
                  ✅ Finalize
                </button>
              )}
            {/* Undo finalization button - only show to uploader for finalized receipts */}
            {currentUser &&
              receipt.uploader_user_id === currentUser.id &&
              receipt.status === "finalized" && (
                <button
                  onClick={undoFinalization}
                  className="px-3 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors flex items-center gap-1"
                  title="Reopen this receipt for editing"
                >
                  ↩️ Reopen
                </button>
              )}
            {/* Delete button - only show to uploader */}
            {currentUser && receipt.uploader_user_id === currentUser.id && (
              <button
                onClick={deleteReceipt}
                className="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors flex items-center gap-1"
                title="Delete this receipt"
              >
                🗑️ Delete
              </button>
            )}
            <Link
              href={`/group/${receipt.group_id}`}
              className="text-sky-600 hover:text-sky-700"
            >
              ← Back to Group
            </Link>
          </div>
        </div>

        {/* Finalized Summary - Show at top when finalized */}
        {receipt.finalized_shares && (
          <div className="bg-green-50 border border-green-200 p-6 rounded shadow mb-6">
            <h3 className="text-lg font-semibold mb-4 text-green-800">
              💰 Final Expense Split
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(receipt.finalized_shares).map(
                ([userId, amounts]) => (
                  <div
                    key={userId}
                    className="border rounded-lg p-4 bg-white border-green-300"
                  >
                    <div className="font-medium text-gray-900 mb-2">
                      {userProfiles[userId]?.display_name ||
                        `User ${userId.substring(0, 8)}...`}
                    </div>
                    {userProfiles[userId]?.email && (
                      <div className="text-xs text-gray-600 mb-2">
                        {userProfiles[userId].email}
                      </div>
                    )}
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Items:</span>
                        <span>${amounts.subtotal}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax:</span>
                        <span>${amounts.tax}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tip:</span>
                        <span>${amounts.tip}</span>
                      </div>
                      <div className="border-t pt-1 flex justify-between font-semibold text-green-700">
                        <span>Total:</span>
                        <span>${amounts.total}</span>
                      </div>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                          📋 View Breakdown
                        </summary>
                        <div className="mt-2 text-xs space-y-1 bg-gray-50 p-2 rounded">
                          <div className="font-medium text-gray-700 mb-1">
                            Items claimed:
                          </div>
                          {items
                            .filter((item) => {
                              const claims = itemClaims[item.id] || [];
                              return claims.some(
                                (claim) => claim.user_id === userId
                              );
                            })
                            .map((item) => {
                              const claims = itemClaims[item.id] || [];
                              const userClaim = claims.find(
                                (claim) => claim.user_id === userId
                              );
                              const totalShares = claims.reduce(
                                (sum, claim) => sum + claim.claimed_quantity,
                                0
                              );
                              const shareRatio = userClaim
                                ? userClaim.claimed_quantity / totalShares
                                : 0;
                              const itemCost = item.total_price * shareRatio;
                              return (
                                <div
                                  key={item.id}
                                  className="flex justify-between"
                                >
                                  <span className="text-gray-600">
                                    {item.name} ({userClaim?.claimed_quantity}/
                                    {totalShares} shares)
                                  </span>
                                  <span>${itemCost.toFixed(2)}</span>
                                </div>
                              );
                            })}
                        </div>
                      </details>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded shadow mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-bold mb-2">Receipt Summary</h2>
              <div className="space-y-1 text-sm">
                <div>
                  Subtotal:{" "}
                  <span className="font-medium">${receipt.subtotal}</span>
                </div>
                <div>
                  Tax: <span className="font-medium">${receipt.tax_total}</span>
                </div>
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
                      {editingMode &&
                        currentUser &&
                        receipt.uploader_user_id === currentUser.id && (
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
                  Total: ${receipt.total}
                </div>
              </div>
            </div>
            <div>
              {receipt.status === "finalized" ? (
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                  ✅ Finalized
                </span>
              ) : (
                <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                  ⏳ Open
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded shadow">
          <h3 className="text-lg font-semibold mb-4">Items ({items.length})</h3>
          <div className="space-y-3">
            {items.map((it) => (
              <div
                key={it.id}
                className={`border rounded-lg p-4 transition-colors ${
                  it.available === false
                    ? "border-red-200 bg-red-50 opacity-60" // Gray out unavailable items
                    : getTotalClaimedQuantity(it.id) > 0
                    ? getTotalClaimedQuantity(it.id) >= it.quantity
                      ? "border-green-200 bg-green-50"
                      : "border-yellow-200 bg-yellow-50"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {/* Status indicator */}
                      <div
                        className={`w-3 h-3 rounded-full ${
                          it.available === false
                            ? "bg-red-500" // Red for unavailable
                            : getTotalClaimedQuantity(it.id) > 0
                            ? getTotalClaimedQuantity(it.id) >= it.quantity
                              ? "bg-green-500"
                              : "bg-yellow-500"
                            : "bg-gray-300"
                        }`}
                      ></div>

                      {/* Item name with editing capability */}
                      {editingItem?.id === it.id ? (
                        <input
                          type="text"
                          defaultValue={it.name}
                          className="font-medium text-gray-900 bg-white border rounded px-2 py-1 flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              updateItem(it.id, { name: e.target.value });
                            } else if (e.key === "Escape") {
                              setEditingItem(null);
                            }
                          }}
                          onBlur={(e) => {
                            const newName = e.target.value.trim();
                            if (newName && newName !== it.name) {
                              updateItem(it.id, { name: newName });
                            } else {
                              setEditingItem(null);
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <div
                          className={`font-medium ${
                            it.available === false
                              ? "text-red-600 line-through"
                              : "text-gray-900"
                          } flex items-center gap-2`}
                        >
                          {it.name}
                          {it.available === false && (
                            <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                              UNAVAILABLE
                            </span>
                          )}
                          {editingMode &&
                            currentUser &&
                            receipt.uploader_user_id === currentUser.id && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  console.log(
                                    "Edit button clicked for item:",
                                    it.id
                                  );
                                  console.log(
                                    "Current editingItem:",
                                    editingItem?.id
                                  );
                                  // Small delay to prevent immediate blur
                                  setTimeout(() => {
                                    console.log(
                                      "Setting editingItem to:",
                                      it.id
                                    );
                                    setEditingItem(it);
                                  }, 10);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800"
                                title="Click to edit item"
                              >
                                ✏️
                              </button>
                            )}
                        </div>
                      )}
                    </div>
                    <div className="ml-5 mt-1 flex items-center gap-2">
                      {editingItem?.id === it.id ? (
                        <div className="flex items-center gap-2">
                          <span>$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={it.total_price}
                            className="w-20 px-2 py-1 border rounded text-sm"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                updateItem(it.id, {
                                  total_price: parseFloat(e.target.value),
                                  unit_price:
                                    parseFloat(e.target.value) / it.quantity,
                                });
                              } else if (e.key === "Escape") {
                                setEditingItem(null);
                              }
                            }}
                            onBlur={(e) => {
                              // Only update if the value actually changed
                              const newValue = parseFloat(e.target.value);
                              if (
                                !isNaN(newValue) &&
                                newValue !== it.total_price
                              ) {
                                updateItem(it.id, {
                                  total_price: newValue,
                                  unit_price: newValue / it.quantity,
                                });
                              } else {
                                setEditingItem(null);
                              }
                            }}
                            autoFocus
                            onFocus={(e) => e.target.select()}
                          />
                        </div>
                      ) : (
                        <span
                          className={`text-lg font-semibold ${
                            it.available === false
                              ? "text-red-600 line-through"
                              : "text-gray-900"
                          }`}
                        >
                          ${it.total_price}
                        </span>
                      )}

                      {/* Quantity - always show and editable in edit mode */}
                      {editingItem?.id === it.id ? (
                        <div className="ml-2 flex items-center gap-1">
                          <span className="text-sm text-gray-500">×</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            defaultValue={it.quantity || 1}
                            className="w-16 px-2 py-1 border rounded text-sm"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const newQty = parseInt(e.target.value) || 1;
                                updateItem(it.id, {
                                  quantity: newQty,
                                  unit_price: it.total_price / newQty,
                                });
                              } else if (e.key === "Escape") {
                                setEditingItem(null);
                              }
                            }}
                            onBlur={(e) => {
                              const newQty = parseInt(e.target.value) || 1;
                              if (newQty !== (it.quantity || 1)) {
                                updateItem(it.id, {
                                  quantity: newQty,
                                  unit_price: it.total_price / newQty,
                                });
                              } else {
                                setEditingItem(null);
                              }
                            }}
                            onFocus={(e) => e.target.select()}
                          />
                        </div>
                      ) : (
                        <span className="ml-2 text-sm text-gray-500">
                          ×{it.quantity || 1}
                        </span>
                      )}

                      {/* Availability toggle - only for uploader in edit mode */}
                      {editingMode &&
                        currentUser &&
                        receipt.uploader_user_id === currentUser.id && (
                          <button
                            onClick={() =>
                              toggleItemAvailability(it.id, it.available)
                            }
                            className={`text-xs px-2 py-1 rounded ${
                              it.available === false
                                ? "bg-green-100 text-green-700 hover:bg-green-200"
                                : "bg-red-100 text-red-700 hover:bg-red-200"
                            }`}
                            title={
                              it.available === false
                                ? "Mark as available"
                                : "Mark as unavailable"
                            }
                          >
                            {it.available === false ? "✓ Enable" : "✗ Disable"}
                          </button>
                        )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-sm">
                      {getTotalClaimedQuantity(it.id) > 0 ? (
                        <div>
                          <span
                            className={`font-medium ${
                              getTotalClaimedQuantity(it.id) >= it.quantity
                                ? "text-green-700"
                                : "text-yellow-700"
                            }`}
                          >
                            {getTotalClaimedQuantity(it.id)}/{it.quantity}{" "}
                            claimed
                          </span>
                          {itemClaims[it.id] && (
                            <div className="mt-1 space-y-1">
                              {itemClaims[it.id].map((claim, index) => (
                                <div
                                  key={index}
                                  className="text-xs text-gray-600"
                                >
                                  {userProfiles[claim.user_id]?.display_name ||
                                    `User ${claim.user_id.substring(0, 8)}...`}
                                  : {claim.claimed_quantity}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500">Unclaimed</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {/* Split functionality for any item */}
                      {splittingItem?.id === it.id ? (
                        /* Item splitting interface */
                        <div className="bg-yellow-50 border border-yellow-300 rounded p-3 space-y-3">
                          <div className="flex justify-between items-center">
                            <h4 className="font-medium text-yellow-800">
                              Split "{it.name}"
                            </h4>
                            <button
                              onClick={() => setSplittingItem(null)}
                              className="text-yellow-600 hover:text-yellow-800"
                            >
                              ✕
                            </button>
                          </div>

                          <div className="space-y-2">
                            {Object.entries(splitShares).map(
                              ([userId, shares]) => (
                                <div
                                  key={userId}
                                  className="flex items-center justify-between bg-white rounded p-2"
                                >
                                  <span className="text-sm">
                                    {userProfiles[userId]?.display_name ||
                                      `User ${userId.substring(0, 8)}...`}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() =>
                                        removePersonFromSplit(userId)
                                      }
                                      className="w-6 h-6 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                                    >
                                      −
                                    </button>
                                    <span className="min-w-[20px] text-center text-sm">
                                      {shares}
                                    </span>
                                    <button
                                      onClick={() => addPersonToSplit(userId)}
                                      className="w-6 h-6 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              )
                            )}
                          </div>

                          <div className="space-y-2">
                            <div className="text-xs text-gray-600">
                              Add more people:
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {members
                                .filter((m) => !splitShares[m.user_id])
                                .map((member) => (
                                  <button
                                    key={member.user_id}
                                    onClick={() =>
                                      addPersonToSplit(member.user_id)
                                    }
                                    className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200"
                                  >
                                    +{" "}
                                    {userProfiles[member.user_id]
                                      ?.display_name ||
                                      `User ${member.user_id.substring(
                                        0,
                                        8
                                      )}...`}
                                  </button>
                                ))}
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2 border-t">
                            <button
                              onClick={applySplit}
                              className="flex-1 px-3 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                              disabled={getTotalShares() === 0}
                            >
                              Apply Split ({getTotalShares()} share
                              {getTotalShares() !== 1 ? "s" : ""})
                            </button>
                            <button
                              onClick={() => setSplittingItem(null)}
                              className="px-3 py-2 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {/* Split button for any item */}
                          <button
                            onClick={() => startSplitting(it)}
                            className="w-full px-3 py-1 bg-orange-500 text-white text-sm rounded hover:bg-orange-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                            disabled={
                              receipt.status === "finalized" ||
                              !currentUser ||
                              it.available === false
                            }
                            title={
                              it.available === false
                                ? "Item is unavailable"
                                : "Split this item with others"
                            }
                          >
                            🍽️ Split Item
                          </button>

                          {/* Quantity claiming controls for multi-quantity items */}
                          {it.quantity > 1 ? (
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-1 bg-gray-50 rounded p-2">
                                <span className="text-xs text-gray-600 mr-2">
                                  You:
                                </span>
                                <button
                                  onClick={() => {
                                    const current = getMyClaimedQuantity(it.id);
                                    if (current > 0) {
                                      claimQuantity(it.id, current - 1);
                                    }
                                  }}
                                  className="w-7 h-7 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors flex items-center justify-center"
                                  disabled={
                                    receipt.status === "finalized" ||
                                    !currentUser ||
                                    getMyClaimedQuantity(it.id) === 0 ||
                                    it.available === false
                                  }
                                >
                                  −
                                </button>
                                <span className="min-w-[30px] text-center text-sm font-medium">
                                  {getMyClaimedQuantity(it.id)}
                                </span>
                                <button
                                  onClick={() => {
                                    const current = getMyClaimedQuantity(it.id);
                                    const available = getAvailableQuantity(it);
                                    if (available > 0) {
                                      claimQuantity(it.id, current + 1);
                                    }
                                  }}
                                  className="w-7 h-7 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors flex items-center justify-center"
                                  disabled={
                                    receipt.status === "finalized" ||
                                    !currentUser ||
                                    getAvailableQuantity(it) === 0 ||
                                    it.available === false
                                  }
                                >
                                  +
                                </button>
                                <span className="text-xs text-gray-500 ml-2">
                                  ({getAvailableQuantity(it)} left)
                                </span>
                              </div>

                              {/* Unclaim button for multi-quantity items if user has claims */}
                              {getMyClaimedQuantity(it.id) > 0 && (
                                <button
                                  onClick={() => unclaimItem(it.id)}
                                  className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
                                  disabled={receipt.status === "finalized"}
                                >
                                  Clear My Claims
                                </button>
                              )}
                            </div>
                          ) : (
                            /* Simple claim/unclaim for single quantity items */
                            <div className="flex gap-2">
                              {getTotalClaimedQuantity(it.id) === 0 ? (
                                <button
                                  onClick={() => claimQuantity(it.id, 1)}
                                  className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
                                  disabled={
                                    receipt.status === "finalized" ||
                                    !currentUser ||
                                    it.available === false
                                  }
                                >
                                  Claim
                                </button>
                              ) : getMyClaimedQuantity(it.id) > 0 ? (
                                <button
                                  onClick={() => unclaimItem(it.id)}
                                  className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
                                  disabled={receipt.status === "finalized"}
                                >
                                  Unclaim
                                </button>
                              ) : (
                                <span className="px-3 py-1 bg-gray-300 text-gray-600 text-sm rounded">
                                  Claimed by{" "}
                                  {Object.values(userProfiles).find((p) =>
                                    itemClaims[it.id]?.some(
                                      (claim) => claim.user_id === p.user_id
                                    )
                                  )?.display_name || "Someone"}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
