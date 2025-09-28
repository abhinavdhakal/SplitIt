import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const setupUserProfile = async (user) => {
    if (!user) return;

    setProfileLoading(true);
    try {
      // First check if profile exists
      const { data: profile, error: fetchError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!profile && fetchError?.code === "PGRST116") {
        // Profile doesn't exist, create new one
        const displayName =
          user.user_metadata?.display_name ||
          user.user_metadata?.name ||
          user.email.split("@")[0];

        // Use upsert to handle race conditions
        const { data: newProfile, error: createError } = await supabase
          .from("user_profiles")
          .upsert(
            {
              user_id: user.id,
              display_name: displayName,
              email: user.email,
            },
            {
              onConflict: "user_id",
            }
          )
          .select()
          .single();

        if (createError) {
          console.error("Profile creation error:", createError);
          // Set fallback profile
          setUserProfile({
            display_name: displayName,
            email: user.email,
            user_id: user.id,
          });
        } else {
          setUserProfile(newProfile);
        }
      } else if (profile) {
        // Profile exists, use it
        setUserProfile(profile);
      } else {
        // Handle other errors with fallback
        console.error("Profile fetch error:", fetchError);
        setUserProfile({
          display_name: user.email.split("@")[0],
          email: user.email,
          user_id: user.id,
        });
      }
    } catch (error) {
      console.error("Profile setup error:", error);
      // Fallback profile
      setUserProfile({
        display_name: user.email.split("@")[0],
        email: user.email,
        user_id: user.id,
      });
    } finally {
      setProfileLoading(false);
    }
  };

  const updateDisplayName = async (newName) => {
    if (!user || !newName) return false;

    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ display_name: newName })
        .eq("user_id", user.id);

      if (error) throw error;

      setUserProfile((prev) => ({ ...prev, display_name: newName }));
      return true;
    } catch (error) {
      console.error("Error updating display name:", error);
      return false;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserProfile(null);
  };

  useEffect(() => {
    const init = async () => {
      setAuthLoading(true);

      try {
        // Get the current session from storage first
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Session check error:", sessionError);
        }

        if (session?.user) {
          console.log("Restored session for:", session.user.email);
          setUser(session.user);
          await setupUserProfile(session.user);
        } else {
          // If no session, try to get current user (in case of fresh login)
          const { data, error } = await supabase.auth.getUser();
          if (error) {
            console.error("Auth check error:", error);
            setUser(null);
          } else if (data.user) {
            setUser(data.user);
            await setupUserProfile(data.user);
          }
        }
      } catch (error) {
        console.error("Init error:", error);
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event, session?.user?.email);

      if (event === "SIGNED_OUT" || !session) {
        setUser(null);
        setUserProfile(null);
        setAuthLoading(false);
      } else if (session?.user) {
        setUser(session.user);

        // Handle different auth events
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          console.log("Session refreshed/restored for:", session.user.email);
        }

        // Add small delay to prevent race conditions
        setTimeout(async () => {
          await setupUserProfile(session.user);
        }, 100);
      }
    });

    // Set up periodic session refresh to ensure long-term persistence
    const refreshInterval = setInterval(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        // Refresh the session token proactively
        await supabase.auth.refreshSession();
      }
    }, 30 * 60 * 1000); // Refresh every 30 minutes

    return () => {
      subscription.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, []);

  return {
    user,
    userProfile,
    authLoading,
    profileLoading,
    setupUserProfile,
    updateDisplayName,
    signOut,
  };
}
