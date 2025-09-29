export default function ExpenseBreakdown({
  receipt,
  userProfiles,
  items,
  itemClaims,
}) {
  if (!receipt.finalized_shares) {
    return null;
  }

  // Debug logging to see what's in finalized_shares
  console.log("Finalized shares data:", receipt.finalized_shares);

  return (
    <div className="bg-green-50 border border-green-200 p-6 rounded shadow mb-6">
      <h3 className="text-lg font-semibold mb-4 text-green-800">
        Final Expense Split
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(receipt.finalized_shares).map(([userId, amounts]) => {
          // Handle null amounts object
          const safeAmounts = amounts || {
            subtotal: 0,
            tax: 0,
            tip: 0,
            total: 0,
          };
          console.log(safeAmounts);

          return (
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
                  <span>${safeAmounts.subtotal || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>${safeAmounts.tax || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tip:</span>
                  <span>${safeAmounts.tip || 0}</span>
                </div>
                <div className="border-t pt-1 flex justify-between font-semibold text-green-700">
                  <span>Total:</span>
                  <span>${safeAmounts.total || 0}</span>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                    View Breakdown
                  </summary>
                  <div className="mt-2 text-xs space-y-1 bg-gray-50 p-2 rounded">
                    <div className="font-medium text-gray-700 mb-1">
                      Items claimed:
                    </div>
                    {items
                      .filter((item) => {
                        const claims = itemClaims[item.id] || [];
                        return claims.some((claim) => claim.user_id === userId);
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
                          <div key={item.id} className="flex justify-between">
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
          );
        })}
      </div>
    </div>
  );
}
