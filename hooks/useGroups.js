import { useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

export function useGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchGroups = useCallback(async (currentUser) => {
    const u = currentUser || (await supabase.auth.getUser()).data.user;
    if (!u) {
      setGroups([]);
      return;
    }

    const { data, error } = await supabase
      .from("group_members")
      .select("group_id (id, name)")
      .eq("user_id", u.id);

    if (error) {
      console.error(error);
      return;
    }

    setGroups((data || []).map((r) => r.group_id));
  }, []);

  const createGroup = async (groupName) => {
    if (!groupName) return null;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("groups")
        .insert([{ name: groupName }])
        .select()
        .single();

      if (error) throw error;

      // Make the creator an admin of the new group
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        console.log("Adding user as admin to group:", {
          group_id: data.id,
          user_id: userData.user.id,
        });

        const { error: memberError } = await supabase
          .from("group_members")
          .insert([
            {
              group_id: data.id,
              user_id: userData.user.id,
              role: "admin",
            },
          ]);

        if (memberError) {
          console.error("Failed to add user to group:", memberError);
          throw memberError;
        }

        console.log("User added as admin successfully");

        // Refresh groups
        await fetchGroups(userData.user);
      }

      return data;
    } catch (error) {
      console.error("Error creating group:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const joinGroup = async (groupId) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // Check if already a member
      const { data: existingMembership } = await supabase
        .from("group_members")
        .select("*")
        .eq("group_id", groupId)
        .eq("user_id", userData.user.id)
        .single();

      if (existingMembership) {
        return { alreadyMember: true };
      }

      // Add as member
      const { error } = await supabase.from("group_members").insert([
        {
          group_id: groupId,
          user_id: userData.user.id,
        },
      ]);

      if (error) throw error;

      // Refresh groups
      await fetchGroups(userData.user);

      return { success: true };
    } catch (error) {
      console.error("Error joining group:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    groups,
    loading,
    fetchGroups,
    createGroup,
    joinGroup,
  };
}
