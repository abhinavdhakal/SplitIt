import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ReceiptUpload from "../../components/ReceiptUpload";
import Link from "next/link";
import { finalizeShares } from "../../utils/finalize";

export default function GroupPage() {
  const router = useRouter();
  const groupId = router.query.id;
  const [group, setGroup] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserMembership, setCurrentUserMembership] = useState(null);

  useEffect(() => {
    if (!groupId) return;
    getCurrentUser();
    fetchGroup();
    fetchReceipts();
    fetchMembers();
  }, [groupId]);

  async function getCurrentUser() {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      setCurrentUser(data.user);

      // Get user's membership in this group
      const { data: membership } = await supabase
        .from("group_members")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", data.user.id)
        .single();

      setCurrentUserMembership(membership);
    }
  }

  async function fetchGroup() {
    const { data } = await supabase
      .from("groups")
      .select("*")
      .eq("id", groupId)
      .single();
    setGroup(data);
  }
  async function fetchReceipts() {
    const { data } = await supabase
      .from("receipts")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });
    setReceipts(data || []);
  }
  async function fetchMembers() {
    const { data } = await supabase
      .from("group_members")
      .select("user_id, role")
      .eq("group_id", groupId);

    if (!data || data.length === 0) {
      setMembers([]);
      return;
    }

    // Get user profiles for all members
    const userIds = data.map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("user_id, display_name, email")
      .in("user_id", userIds);

    const membersWithNames = data.map((m) => {
      const profile = profiles?.find((p) => p.user_id === m.user_id);
      return {
        user_id: m.user_id,
        role: m.role,
        display_name:
          profile?.display_name || `User ${m.user_id.substring(0, 8)}...`,
        email: profile?.email || "",
      };
    });

    setMembers(membersWithNames);
  }

  async function refresh() {
    await fetchReceipts();
  }

  async function claimItem(itemId, userId) {
    await supabase
      .from("items")
      .update({ claimed_by: userId })
      .eq("id", itemId);
    // log
    await supabase.from("logs").insert([
      {
        receipt_id: null,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        action: "claim_item",
        details: { itemId, claimed_by: userId },
      },
    ]);
    refresh();
  }

  async function finalizeReceipt(receipt) {
    if (!currentUser) {
      alert("You must be logged in to finalize receipts.");
      return;
    }

    // Check permissions: only receipt uploader or group admin can finalize
    const isUploader = receipt.uploader_user_id === currentUser.id;
    const isGroupAdmin = currentUserMembership?.role === "admin";

    if (!isUploader && !isGroupAdmin) {
      alert("Only the receipt uploader or group admin can finalize receipts.");
      return;
    }

    setLoading(true);
    try {
      // Load items for receipt
      const { data: receiptItems } = await supabase
        .from("items")
        .select("*")
        .eq("receipt_id", receipt.id);

      if (!receiptItems || receiptItems.length === 0) {
        alert("Cannot finalize receipt with no items.");
        setLoading(false);
        return;
      }

      // Load item claims to handle splitting properly
      const { data: claims } = await supabase
        .from("item_claims")
        .select("*")
        .in(
          "item_id",
          receiptItems.map((item) => item.id)
        );

      // Build claims map
      const claimsMap = {};
      claims?.forEach((claim) => {
        if (!claimsMap[claim.item_id]) {
          claimsMap[claim.item_id] = [];
        }
        claimsMap[claim.item_id].push(claim);
      });

      // Build items for finalization using the same logic as receipt page
      const itemsForFinalize = [];

      for (const item of receiptItems) {
        // Skip unavailable items from finalization
        if (item.available === false) {
          console.log(`Skipping unavailable item: ${item.name}`);
          continue;
        }

        const itemClaims = claimsMap[item.id] || [];

        if (itemClaims.length === 0) {
          // Unclaimed item - add as unclaimed
          itemsForFinalize.push({
            id: item.id,
            total_price: Number(item.total_price),
            claimed_by: null,
          });
        } else {
          // Calculate proportional shares for split items
          const totalShares = itemClaims.reduce(
            (sum, claim) => sum + claim.claimed_quantity,
            0
          );
          const itemPrice = Number(item.total_price);

          for (const claim of itemClaims) {
            // Calculate proportional price based on shares
            const shareRatio = claim.claimed_quantity / totalShares;
            const claimPrice = itemPrice * shareRatio;

            itemsForFinalize.push({
              id: `${item.id}_${claim.user_id}`,
              total_price: claimPrice,
              claimed_by: claim.user_id,
            });
          }
        }
      }

      // Calculate adjusted tax based on available items (same logic as receipt summary)
      const availableItems = receiptItems.filter(
        (item) => item.available !== false
      );
      const availableSubtotal = availableItems.reduce(
        (sum, item) => sum + Number(item.total_price || 0),
        0
      );
      const originalSubtotal = Number(receipt.subtotal || 0);
      const availableRatio =
        originalSubtotal > 0 ? availableSubtotal / originalSubtotal : 1;
      const adjustedTax = Number(receipt.tax_total || 0) * availableRatio;

      console.log("Tax calculation debug:");
      console.log("- Original tax:", Number(receipt.tax_total || 0));
      console.log("- Available subtotal:", availableSubtotal);
      console.log("- Original subtotal:", originalSubtotal);
      console.log("- Available ratio:", availableRatio);
      console.log("- Adjusted tax:", adjustedTax);

      const result = finalizeShares(
        itemsForFinalize,
        adjustedTax,
        Number(receipt.tip_total || 0)
      );
      // store finalized_shares in receipt
      await supabase
        .from("receipts")
        .update({
          status: "finalized",
          finalized_shares: result.perUser,
          finalized_at: new Date().toISOString(),
        })
        .eq("id", receipt.id);
      // Log
      await supabase.from("logs").insert([
        {
          receipt_id: receipt.id,
          user_id: currentUser.id,
          action: "finalize",
          details: { perUser: result.perUser },
        },
      ]);
      refresh();
    } catch (error) {
      console.error("Error finalizing receipt:", error);
      alert("Error finalizing receipt. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-green-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">S</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">SplitNice</h1>
                  <p className="text-xs text-gray-500">
                    Smart Receipt Splitter
                  </p>
                </div>
              </Link>
              {group && (
                <div className="ml-4 pl-4 border-l border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {group.name}
                  </h2>
                  <p className="text-sm text-gray-500">Group Dashboard</p>
                </div>
              )}
            </div>
            <Link
              href="/"
              className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <ReceiptUpload groupId={groupId} onUploaded={refresh} />

            <div className="bg-white p-6 rounded-2xl shadow-sm border">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Receipts
                </h3>
                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {receipts.length}
                </span>
              </div>
              {receipts.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <svg
                    className="mx-auto w-12 h-12 text-gray-400 mb-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p>No receipts yet</p>
                  <p className="text-sm">Upload your first PDF receipt above</p>
                </div>
              )}
              <div className="space-y-3">
                {receipts.map((r) => (
                  <div
                    key={r.id}
                    className="border border-gray-200 p-4 rounded-xl hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="font-semibold text-gray-900">
                            {r.name || "Untitled Receipt"}
                          </div>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              r.status === "finalized"
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {r.status === "finalized"
                              ? "✓ Finalized"
                              : "⏳ Open"}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 grid grid-cols-3 gap-4">
                          <div>
                            Subtotal:{" "}
                            <span className="font-medium">${r.subtotal}</span>
                          </div>
                          <div>
                            Tax:{" "}
                            <span className="font-medium">${r.tax_total}</span>
                          </div>
                          <div>
                            Tip:{" "}
                            <span className="font-medium">${r.tip_total}</span>
                          </div>
                        </div>
                        <div className="text-sm text-gray-900 font-semibold mt-1">
                          Total: ${parseFloat(r.total || 0).toFixed(2)}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        {r.status !== "finalized" &&
                          currentUser &&
                          (r.uploader_user_id === currentUser.id ||
                            currentUserMembership?.role === "admin") && (
                            <button
                              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                              onClick={() => finalizeReceipt(r)}
                              disabled={loading}
                            >
                              Finalize
                            </button>
                          )}
                        <button
                          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                          onClick={() => router.push(`/receipt/${r.id}`)}
                        >
                          Open →
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Room Code Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Room Code
                </h3>
              </div>
              <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-xl">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      Share this code with friends:
                    </p>
                    <span className="font-mono text-lg font-bold text-gray-900">
                      {groupId}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(groupId);
                      alert("Room code copied!");
                    }}
                    className="px-3 py-2 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 border"
                  >
                    📋 Copy
                  </button>
                </div>
              </div>
            </div>

            {/* Members Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Members</h3>
                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {members.length}
                </span>
              </div>
              <div className="space-y-3">
                {members.length === 0 && (
                  <div className="text-center py-6 text-gray-500">
                    <svg
                      className="mx-auto w-8 h-8 text-gray-400 mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    <p className="text-sm">No members yet</p>
                  </div>
                )}
                {members.map((m) => (
                  <div
                    key={m.user_id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-semibold">
                          {(m.display_name ||
                            m.email?.split("@")[0] ||
                            "U")[0]?.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {m.display_name}
                        </div>
                        {m.email && (
                          <div className="text-sm text-gray-500">{m.email}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.role === "admin" && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                          Admin
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
