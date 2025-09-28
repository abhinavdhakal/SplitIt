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
      // load items for receipt
      const { data: items } = await supabase
        .from("items")
        .select("*")
        .eq("receipt_id", receipt.id);
      // build items format expected
      const itemsForFinalize = items.map((it) => ({
        id: it.id,
        total_price: Number(it.total_price),
        claimed_by: it.claimed_by,
      }));
      const result = finalizeShares(
        itemsForFinalize,
        Number(receipt.tax_total || 0),
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
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">Group</h1>
          <Link href="/" className="text-sky-600">
            Back
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-4">
            <ReceiptUpload groupId={groupId} onUploaded={refresh} />

            <div className="bg-white p-4 rounded shadow">
              <h3 className="font-semibold mb-2">Receipts</h3>
              {receipts.length === 0 && <div>No receipts yet</div>}
              {receipts.map((r) => (
                <div key={r.id} className="border p-2 rounded mb-2">
                  <div className="flex justify-between">
                    <div>
                      <div className="font-medium">Receipt: {r.filename}</div>
                      <div className="text-sm text-gray-600">
                        Subtotal: ${r.subtotal} • Tax: ${r.tax_total} • Tip: $
                        {r.tip_total}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {r.status !== "finalized" &&
                        currentUser &&
                        (r.uploader_user_id === currentUser.id ||
                          currentUserMembership?.role === "admin") && (
                          <button
                            className="px-2 py-1 bg-blue-600 text-white rounded"
                            onClick={() => finalizeReceipt(r)}
                            disabled={loading}
                          >
                            Finalize
                          </button>
                        )}
                      <button
                        className="px-2 py-1 bg-gray-200 rounded"
                        onClick={() => router.push(`/receipt/${r.id}`)}
                      >
                        Open
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-4 rounded shadow">
            <div className="mb-3">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">Members ({members.length})</h3>
              </div>
              <div className="p-2 bg-gray-100 rounded text-sm">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-gray-600">Room Code: </span>
                    <span className="font-mono font-medium">{groupId}</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(groupId);
                      alert("Room code copied!");
                    }}
                    className="text-sky-600 hover:text-sky-700 text-xs"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {members.length === 0 && (
                <div className="text-sm text-gray-600">No members</div>
              )}
              {members.map((m) => (
                <div
                  key={m.user_id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <div>
                    <div className="font-medium">{m.display_name}</div>
                    {m.email && (
                      <div className="text-sm text-gray-600">{m.email}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {m.role === "admin" && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
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
  );
}
