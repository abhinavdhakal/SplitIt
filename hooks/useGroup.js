import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

export function useGroup(groupId) {
  const [group, setGroup] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [members, setMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserMembership, setCurrentUserMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getCurrentUser = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setCurrentUser(data.user);

        // Get user's membership in this group
        if (groupId) {
          const { data: membership } = await supabase
            .from("group_members")
            .select("role")
            .eq("group_id", groupId)
            .eq("user_id", data.user.id)
            .single();

          setCurrentUserMembership(membership);
        }
      }
    } catch (error) {
      console.error("Error getting current user:", error);
    }
  }, [groupId]);

  const fetchGroup = useCallback(async () => {
    if (!groupId) return;

    try {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId)
        .single();

      if (error) throw error;
      setGroup(data);
    } catch (error) {
      console.error("Error fetching group:", error);
      setError(error.message);
    }
  }, [groupId]);

  const fetchReceipts = useCallback(async () => {
    if (!groupId) return;

    try {
      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReceipts(data || []);
    } catch (error) {
      console.error("Error fetching receipts:", error);
      setReceipts([]);
    }
  }, [groupId]);

  const fetchMembers = useCallback(async () => {
    if (!groupId) return;

    try {
      console.log("Fetching members for group:", groupId);

      // First try getting all the fields we need
      let { data, error } = await supabase
        .from("group_members")
        .select("id, user_id, role, joined_at")
        .eq("group_id", groupId);

      // Sometimes production DB is missing columns, so fallback to basic query
      if (error) {
        console.warn("Full member query failed, trying basic query:", error);
        const fallback = await supabase
          .from("group_members")
          .select("user_id, role")
          .eq("group_id", groupId);

        if (fallback.error) {
          throw fallback.error;
        }

        // Fill in missing fields with fallback values
        data =
          fallback.data?.map((member) => ({
            id: member.user_id, // just use user_id since we need something
            user_id: member.user_id,
            role: member.role,
            joined_at: new Date().toISOString(), // fake join date for now
          })) || [];
      }

      console.log("Raw member data:", data);

      if (!data || data.length === 0) {
        console.log("No members found for group");
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
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          joined_at: m.joined_at,
          display_name:
            profile?.display_name || `User ${m.user_id.substring(0, 8)}...`,
          email: profile?.email || "",
        };
      });

      setMembers(membersWithNames);
    } catch (error) {
      console.error("Error fetching members:", error);
      setMembers([]);
    }
  }, [groupId]);

  const finalizeReceipt = useCallback(
    async (receipt) => {
      if (!currentUser) return { success: false, error: "Not authenticated" };

      setLoading(true);
      try {
        // Get receipt items
        const { data: receiptItems } = await supabase
          .from("items")
          .select("*")
          .eq("receipt_id", receipt.id);

        if (!receiptItems || receiptItems.length === 0) {
          throw new Error("No items found for this receipt");
        }

        // Get item claims
        const itemIds = receiptItems.map((item) => item.id);
        const { data: claims } = await supabase
          .from("item_claims")
          .select("*")
          .in("item_id", itemIds);

        // Group claims by item_id
        const claimsMap = {};
        claims?.forEach((claim) => {
          if (!claimsMap[claim.item_id]) {
            claimsMap[claim.item_id] = [];
          }
          claimsMap[claim.item_id].push(claim);
        });

        // Calculate finalized shares using the finalize utility
        const { finalizeShares } = await import("../utils/finalize");

        // Calculate adjusted tax based on available items
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

        const result = finalizeShares(
          receiptItems,
          claimsMap,
          availableSubtotal,
          adjustedTax,
          Number(receipt.tip_total || 0)
        );

        // Update receipt with finalized shares
        const { error: updateError } = await supabase
          .from("receipts")
          .update({
            status: "finalized",
            finalized_shares: result,
            finalized_at: new Date().toISOString(),
          })
          .eq("id", receipt.id);

        if (updateError) throw updateError;

        // Refresh data
        await fetchReceipts();

        return { success: true };
      } catch (error) {
        console.error("Error finalizing receipt:", error);
        return { success: false, error: error.message };
      } finally {
        setLoading(false);
      }
    },
    [currentUser, fetchReceipts]
  );

  const refreshData = useCallback(() => {
    fetchGroup();
    fetchReceipts();
    fetchMembers();
  }, [fetchGroup, fetchReceipts, fetchMembers]);

  // Initialize data
  useEffect(() => {
    if (!groupId) return;

    setLoading(true);
    getCurrentUser();
    fetchGroup();
    fetchReceipts();
    fetchMembers();
    setLoading(false);
  }, [groupId, getCurrentUser, fetchGroup, fetchReceipts, fetchMembers]);

  return {
    group,
    receipts,
    members,
    currentUser,
    currentUserMembership,
    loading,
    error,

    // Actions
    finalizeReceipt,
    refreshData,
  };
}
