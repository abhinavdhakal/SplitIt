import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function ItemsList({
  items,
  currentUser,
  receipt,
  editingMode,
  itemClaims,
  userProfiles,
  onClaimQuantity,
  onUnclaimItem,
  onUpdateItem,
  onAddItem,
  getTotalClaimedQuantity,
  getMyClaimedQuantity,
  getAvailableQuantity,
  members,
  splittingItem,
  setSplittingItem,
  splitShares,
  setSplitShares,
}) {
  const [editingItemId, setEditingItemId] = useState(null);
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    quantity: 1,
    total_price: "",
  });

  const isUploader = currentUser && receipt.uploader_user_id === currentUser.id;

  // Split functionality
  function startSplitting(item) {
    setSplittingItem(item);
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
      for (const [userId, shares] of Object.entries(splitShares)) {
        const claimData = {
          item_id: splittingItem.id,
          user_id: userId,
          claimed_quantity: shares,
        };

        const { error } = await supabase.from("item_claims").insert(claimData);

        if (error) throw error;
      }

      setSplittingItem(null);
      setSplitShares({});
      // Refresh data through parent component
      window.location.reload();
    } catch (error) {
      console.error("Error applying split:", error);
      alert("Error splitting item. Please try again.");
    }
  }

  async function toggleItemAvailability(itemId, currentAvailability) {
    if (!isUploader) {
      alert("Only the receipt uploader can toggle item availability.");
      return;
    }

    try {
      const { error } = await supabase
        .from("items")
        .update({ available: !currentAvailability })
        .eq("id", itemId);

      if (error) throw error;
      window.location.reload();
    } catch (error) {
      console.error("Error toggling item availability:", error);
      alert("Error updating item. Please try again.");
    }
  }

  async function updateItem(itemId, updates, closeEditMode = true) {
    if (!isUploader) {
      alert("Only the receipt uploader can edit items.");
      return;
    }

    try {
      const { error } = await supabase
        .from("items")
        .update(updates)
        .eq("id", itemId);

      if (error) throw error;

      if (closeEditMode) {
        setEditingItemId(null);
      }
      window.location.reload();
    } catch (error) {
      console.error("Error updating item:", error);
      alert("Error updating item. Please try again.");
    }
  }

  return (
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
                  {editingItemId === it.id ? (
                    <input
                      type="text"
                      defaultValue={it.name}
                      className="font-medium text-gray-900 bg-white border rounded px-2 py-1 flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          updateItem(it.id, { name: e.target.value });
                        } else if (e.key === "Escape") {
                          setEditingItemId(null);
                        }
                      }}
                      onBlur={(e) => {
                        setTimeout(() => {
                          const newName = e.target.value.trim();
                          if (newName && newName !== it.name) {
                            updateItem(it.id, { name: newName }, false);
                          }
                        }, 500);
                      }}
                      autoFocus
                      onFocus={(e) => e.target.select()}
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
                      {editingMode && isUploader && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditingItemId(it.id);
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
                  {editingItemId === it.id ? (
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
                            setEditingItemId(null);
                          }
                        }}
                        onBlur={(e) => {
                          setTimeout(() => {
                            const newValue = parseFloat(e.target.value);
                            if (
                              !isNaN(newValue) &&
                              newValue !== it.total_price
                            ) {
                              updateItem(
                                it.id,
                                {
                                  total_price: newValue,
                                  unit_price: newValue / it.quantity,
                                },
                                false
                              );
                            }
                          }, 500);
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
                  {editingItemId === it.id ? (
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
                            setEditingItemId(null);
                          }
                        }}
                        onBlur={(e) => {
                          setTimeout(() => {
                            const newQty = parseInt(e.target.value) || 1;
                            if (newQty !== (it.quantity || 1)) {
                              updateItem(
                                it.id,
                                {
                                  quantity: newQty,
                                  unit_price: it.total_price / newQty,
                                },
                                false
                              );
                            }
                          }, 500);
                        }}
                        onFocus={(e) => e.target.select()}
                      />
                    </div>
                  ) : (
                    <span className="ml-2 text-gray-500">
                      ×{it.quantity || 1}
                    </span>
                  )}

                  {/* Availability toggle - only for uploader in edit mode */}
                  {editingMode && isUploader && (
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
                      {it.available === false ? "Enable" : "Disable"}
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
                        {getTotalClaimedQuantity(it.id)}/{it.quantity} claimed
                      </span>
                      {itemClaims[it.id] && (
                        <div className="mt-1 space-y-1">
                          {itemClaims[it.id].map((claim, index) => (
                            <div key={index} className="text-xs text-gray-600">
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
                        {Object.entries(splitShares).map(([userId, shares]) => (
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
                                onClick={() => removePersonFromSplit(userId)}
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
                        ))}
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs text-gray-600">
                          Add more people:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {members
                            ?.filter((m) => !splitShares[m.user_id])
                            .map((member) => (
                              <button
                                key={member.user_id}
                                onClick={() => addPersonToSplit(member.user_id)}
                                className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200"
                              >
                                +{" "}
                                {userProfiles[member.user_id]?.display_name ||
                                  `User ${member.user_id.substring(0, 8)}...`}
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
                                  onClaimQuantity(it.id, current - 1);
                                }
                              }}
                              className={`w-7 h-7 text-sm rounded transition-colors flex items-center justify-center ${
                                receipt.status === "finalized" ||
                                !currentUser ||
                                getMyClaimedQuantity(it.id) === 0 ||
                                it.available === false
                                  ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                                  : "bg-red-500 text-white hover:bg-red-600"
                              }`}
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
                                  onClaimQuantity(it.id, current + 1);
                                }
                              }}
                              className={`w-7 h-7 text-sm rounded transition-colors flex items-center justify-center ${
                                receipt.status === "finalized" ||
                                !currentUser ||
                                getAvailableQuantity(it) === 0 ||
                                it.available === false
                                  ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                                  : "bg-green-500 text-white hover:bg-green-600"
                              }`}
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
                              onClick={() => onUnclaimItem(it.id)}
                              className={`px-3 py-1 text-xs rounded transition-colors ${
                                receipt.status === "finalized"
                                  ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                                  : "bg-red-500 text-white hover:bg-red-600"
                              }`}
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
                              onClick={() => onClaimQuantity(it.id, 1)}
                              className={`px-3 py-1 text-sm rounded transition-colors ${
                                receipt.status === "finalized" ||
                                !currentUser ||
                                it.available === false
                                  ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                                  : "bg-green-500 text-white hover:bg-green-600"
                              }`}
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
                              onClick={() => onUnclaimItem(it.id)}
                              className={`px-3 py-1 text-sm rounded transition-colors ${
                                receipt.status === "finalized"
                                  ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                                  : "bg-red-500 text-white hover:bg-red-600"
                              }`}
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

        {/* Add Manual Item Section */}
        {editingMode && isUploader && (
          <div className="mt-6 border-t pt-6">
            {!showAddItemForm ? (
              <button
                onClick={() => setShowAddItemForm(true)}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Missing Item
              </button>
            ) : (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-4">Add New Item</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Item Name
                    </label>
                    <input
                      type="text"
                      value={newItem.name}
                      onChange={(e) =>
                        setNewItem((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      placeholder="Enter item name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={newItem.quantity}
                        onChange={(e) =>
                          setNewItem((prev) => ({
                            ...prev,
                            quantity: parseInt(e.target.value) || 1,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Total Price ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newItem.total_price}
                        onChange={(e) =>
                          setNewItem((prev) => ({
                            ...prev,
                            total_price: e.target.value,
                          }))
                        }
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={async () => {
                        if (!newItem.name.trim()) {
                          alert("Please enter an item name");
                          return;
                        }
                        const result = await onAddItem({
                          name: newItem.name.trim(),
                          quantity: newItem.quantity,
                          total_price: parseFloat(newItem.total_price) || 0,
                        });
                        if (result.success) {
                          setNewItem({
                            name: "",
                            quantity: 1,
                            total_price: "",
                          });
                          setShowAddItemForm(false);
                        } else {
                          alert("Error adding item. Please try again.");
                        }
                      }}
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Add Item
                    </button>
                    <button
                      onClick={() => {
                        setShowAddItemForm(false);
                        setNewItem({ name: "", quantity: 1, total_price: "" });
                      }}
                      className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
