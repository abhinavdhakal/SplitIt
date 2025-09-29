import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

export function useReceipts(receiptId) {
  const [receipt, setReceipt] = useState(null);
  const [items, setItems] = useState([]);
  const [members, setMembers] = useState([]);
  const [userProfiles, setUserProfiles] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [itemClaims, setItemClaims] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingClaims, setPendingClaims] = useState(new Set());

  const getCurrentUser = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getUser();
      setCurrentUser(data.user);
    } catch (error) {
      console.error("Error getting current user:", error);
    }
  }, []);

  const fetchReceipt = useCallback(async () => {
    if (!receiptId) return;

    try {
      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .eq("id", receiptId)
        .single();

      if (error || !data) {
        console.log("Receipt not found or deleted:", receiptId);
        setReceipt("DELETED");
        return;
      }

      setReceipt(data);
    } catch (error) {
      console.error("Error fetching receipt:", error);
      setReceipt("DELETED");
    }
  }, [receiptId]);

  const fetchItems = useCallback(async () => {
    if (!receiptId) return;

    try {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("receipt_id", receiptId);

      if (error) {
        console.error("Error fetching items:", error);
        return;
      }

      setItems(data || []);
    } catch (error) {
      console.error("Error fetching items:", error);
      setItems([]);
    }
  }, [receiptId]);

  const fetchItemClaims = useCallback(async () => {
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
  }, [items]);

  const loadMembers = useCallback(async (groupId) => {
    if (!groupId) return;

    let { data, error } = await supabase
      .from("group_members")
      .select("id, user_id, role, joined_at")
      .eq("group_id", groupId);

    // Fallback if the full query fails (for production compatibility)
    if (error) {
      console.warn(
        "Full member query failed in useReceipts, trying fallback:",
        error
      );
      const fallback = await supabase
        .from("group_members")
        .select("user_id, role")
        .eq("group_id", groupId);

      data =
        fallback.data?.map((member) => ({
          id: member.user_id,
          user_id: member.user_id,
          role: member.role,
          joined_at: new Date().toISOString(),
        })) || [];
    }

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
  }, []);

  const claimQuantity = useCallback(
    async (itemId, quantity) => {
      if (!currentUser || quantity <= 0) return;

      // Prevent multiple simultaneous operations for the same item
      const operationKey = `${itemId}-${currentUser.id}`;
      if (pendingClaims.has(operationKey)) {
        console.log("Operation already in progress");
        return;
      }

      // Add to pending operations
      setPendingClaims((prev) => new Set([...prev, operationKey]));

      try {
        // Find the item and validate available quantity
        const item = items.find((i) => i.id === itemId);
        if (!item || item.available === false) return;

        // Calculate total claimed quantity inline to avoid dependency issues
        const totalClaimed =
          itemClaims[itemId]?.reduce(
            (sum, claim) => sum + claim.claimed_quantity,
            0
          ) || 0;
        const availableQuantity = item.quantity - totalClaimed;

        // Check if user already has a claim on this item
        const existingClaim = itemClaims[itemId]?.find(
          (claim) => claim.user_id === currentUser.id
        );

        const currentUserClaimed = existingClaim
          ? existingClaim.claimed_quantity
          : 0;
        const requestedChange = quantity - currentUserClaimed;

        // Validate that we don't exceed available quantity
        if (requestedChange > availableQuantity) {
          console.log("Cannot claim more than available quantity");
          return;
        }

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

        await fetchItemClaims();
      } finally {
        // Remove from pending operations
        setPendingClaims((prev) => {
          const newSet = new Set(prev);
          newSet.delete(operationKey);
          return newSet;
        });
      }
    },
    [currentUser, itemClaims, fetchItemClaims, items, pendingClaims]
  );

  const unclaimItem = useCallback(
    async (itemId) => {
      if (!currentUser) return;

      await supabase
        .from("item_claims")
        .delete()
        .eq("item_id", itemId)
        .eq("user_id", currentUser.id);

      fetchItemClaims();
    },
    [currentUser, fetchItemClaims]
  );

  const updateItem = useCallback(
    async (itemId, updates) => {
      try {
        const { error } = await supabase
          .from("items")
          .update(updates)
          .eq("id", itemId);

        if (error) throw error;

        await fetchItems();
        return { success: true };
      } catch (error) {
        console.error("Error updating item:", error);
        return { success: false, error: error.message };
      }
    },
    [fetchItems]
  );

  const addItem = useCallback(
    async (itemData) => {
      try {
        const { error } = await supabase.from("items").insert({
          receipt_id: receiptId,
          name: itemData.name,
          quantity: itemData.quantity || 1,
          total_price: itemData.total_price || 0,
          available: true,
        });

        if (error) throw error;

        await fetchItems();
        return { success: true };
      } catch (error) {
        console.error("Error adding item:", error);
        return { success: false, error: error.message };
      }
    },
    [receiptId, fetchItems]
  );

  const updateReceiptName = useCallback(
    async (newName) => {
      if (!receiptId || !newName.trim()) return { success: false };

      try {
        const { error } = await supabase
          .from("receipts")
          .update({ name: newName.trim() })
          .eq("id", receiptId);

        if (error) throw error;

        await fetchReceipt();
        return { success: true };
      } catch (error) {
        console.error("Error updating receipt name:", error);
        return { success: false, error: error.message };
      }
    },
    [receiptId, fetchReceipt]
  );

  const deleteReceipt = useCallback(async () => {
    if (!receiptId) return { success: false };

    try {
      const { error } = await supabase
        .from("receipts")
        .delete()
        .eq("id", receiptId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error("Error deleting receipt:", error);
      return { success: false, error: error.message };
    }
  }, [receiptId]);

  // Helper functions for quantity calculations
  const getTotalClaimedQuantity = useCallback(
    (itemId) => {
      return (
        itemClaims[itemId]?.reduce(
          (sum, claim) => sum + claim.claimed_quantity,
          0
        ) || 0
      );
    },
    [itemClaims]
  );

  const getMyClaimedQuantity = useCallback(
    (itemId) => {
      const myClaim = itemClaims[itemId]?.find(
        (claim) => claim.user_id === currentUser?.id
      );
      return myClaim?.claimed_quantity || 0;
    },
    [itemClaims, currentUser]
  );

  const getAvailableQuantity = useCallback(
    (item) => {
      // If item is marked as unavailable, return 0
      if (item.available === false) return 0;
      return item.quantity - getTotalClaimedQuantity(item.id);
    },
    [getTotalClaimedQuantity]
  );

  // Initialize data
  useEffect(() => {
    if (!receiptId) return;

    setLoading(true);
    getCurrentUser();
    fetchReceipt();
    fetchItems();
  }, [receiptId, getCurrentUser, fetchReceipt, fetchItems]);

  useEffect(() => {
    if (items.length > 0) {
      fetchItemClaims();
    }
  }, [items, fetchItemClaims]);

  useEffect(() => {
    if (receipt && receipt !== "DELETED") {
      loadMembers(receipt.group_id);
    }
    setLoading(false);
  }, [receipt, loadMembers]);

  return {
    receipt,
    items,
    members,
    userProfiles,
    currentUser,
    itemClaims,
    loading,
    error,

    // Actions
    claimQuantity,
    unclaimItem,
    updateItem,
    addItem,
    updateReceiptName,
    deleteReceipt,
    refreshData: () => {
      fetchReceipt();
      fetchItems();
      fetchItemClaims();
    },

    // Helpers
    getTotalClaimedQuantity,
    getMyClaimedQuantity,
    getAvailableQuantity,
  };
}
