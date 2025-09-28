import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import SignIn from "../components/SignIn";

export default function Home() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [groups, setGroups] = useState([]);
  const [creating, setCreating] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
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
          await fetchGroups(session.user);
        } else {
          // If no session, try to get current user (in case of fresh login)
          const { data, error } = await supabase.auth.getUser();
          if (error) {
            console.error("Auth check error:", error);
            setUser(null);
          } else if (data.user) {
            setUser(data.user);
            await setupUserProfile(data.user);
            await fetchGroups(data.user);
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
        setGroups([]);
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
          await fetchGroups(session.user);
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

  async function fetchGroups(currentUser) {
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
  }

  async function createGroup() {
    if (!groupName) return;
    setCreating(true);

    const { data, error } = await supabase
      .from("groups")
      .insert([{ name: groupName }])
      .select()
      .single();

    if (error) {
      alert(error.message);
      setCreating(false);
      return;
    }

    const u = (await supabase.auth.getUser()).data.user;
    await supabase
      .from("group_members")
      .insert([{ group_id: data.id, user_id: u.id, role: "admin" }]);

    setGroupName("");
    setCreating(false);
    fetchGroups(u);
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading SplitIt...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-green-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">S</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">SplitIt</h1>
                <p className="text-xs text-gray-500">Smart Receipt Splitter</p>
              </div>
            </div>
            {user && (
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  setUser(null);
                  setUserProfile(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {!user && (
          <>
            {/* Hero Section */}
            <div className="text-center py-16">
              <div className="inline-flex items-center gap-3 mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-green-600 rounded-2xl flex items-center justify-center">
                  <span className="text-white font-bold text-2xl">S</span>
                </div>
              </div>
              <h1 className="text-5xl font-bold text-gray-900 mb-4">
                Split receipts
                <span className="bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                  {" "}
                  effortlessly
                </span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                Upload your PDF receipts, let AI parse the items, and split
                costs fairly with your friends and roommates.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <div className="flex items-center gap-2 text-green-600">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm font-medium">
                    PDF Receipt Parsing
                  </span>
                </div>
                <div className="flex items-center gap-2 text-blue-600">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm font-medium">
                    Smart Cost Splitting
                  </span>
                </div>
                <div className="flex items-center gap-2 text-purple-600">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm font-medium">
                    Real-time Collaboration
                  </span>
                </div>
              </div>
            </div>

            {/* Sign In Section */}
            <div className="max-w-md mx-auto">
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Get Started
                  </h2>
                  <p className="text-gray-600">
                    Sign in to start splitting receipts
                  </p>
                </div>
                <SignIn onLogin={() => {}} />
              </div>
            </div>
          </>
        )}

        {user && (
          <>
            {/* Welcome Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">
                    Welcome back,{" "}
                    {profileLoading ? (
                      <span className="text-gray-500">Loading...</span>
                    ) : (
                      userProfile?.display_name ||
                      user?.email?.split("@")[0] ||
                      "User"
                    )}
                    !
                  </h2>
                  <p className="text-gray-600 mt-1">
                    Manage your groups and split receipts easily
                  </p>
                </div>
              </div>
            </div>

            {/* Profile Section */}
            <div className="mb-8 p-6 bg-white rounded-2xl shadow-sm border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-green-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-lg">
                      {(userProfile?.display_name ||
                        user?.email?.split("@")[0] ||
                        "U")[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    {editingName ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newDisplayName}
                          onChange={(e) => setNewDisplayName(e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Display name"
                        />
                        <button
                          onClick={async () => {
                            if (newDisplayName.trim()) {
                              await supabase
                                .from("user_profiles")
                                .update({ display_name: newDisplayName.trim() })
                                .eq("user_id", user.id);
                              setUserProfile({
                                ...userProfile,
                                display_name: newDisplayName.trim(),
                              });
                            }
                            setEditingName(false);
                          }}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingName(false)}
                          className="px-4 py-2 bg-gray-500 text-white rounded-lg text-sm font-medium hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="font-semibold text-gray-900">
                          {profileLoading ? (
                            <span className="text-gray-500">Loading...</span>
                          ) : (
                            userProfile?.display_name ||
                            user?.email?.split("@")[0] ||
                            "User"
                          )}
                        </div>
                        <div className="text-gray-600 text-sm">
                          {user.email}
                        </div>
                        <button
                          onClick={() => {
                            setNewDisplayName(
                              userProfile?.display_name ||
                                user?.email?.split("@")[0] ||
                                ""
                            );
                            setEditingName(true);
                          }}
                          className="mt-1 text-blue-600 text-sm font-medium hover:text-blue-700"
                          disabled={profileLoading}
                        >
                          Edit name
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Your Groups */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Your Groups
                </h2>
                <span className="text-sm text-gray-500">
                  {groups.length} {groups.length === 1 ? "group" : "groups"}
                </span>
              </div>

              <div className="grid gap-4">
                {groups.length === 0 && (
                  <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
                    <div className="text-gray-400 mb-4">
                      <svg
                        className="mx-auto w-12 h-12"
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
                    <h3 className="text-lg font-medium text-gray-900 mb-1">
                      No groups yet
                    </h3>
                    <p className="text-gray-500 mb-4">
                      Create your first group to start splitting receipts
                    </p>
                  </div>
                )}
                {groups.map((g) => (
                  <div
                    key={g.id}
                    className="p-6 bg-white rounded-2xl shadow-sm border hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                          <span className="text-white font-semibold">
                            {g.name[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {g.name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            Group ID: {g.id}
                          </p>
                        </div>
                      </div>
                      <Link
                        href={`/group/${g.id}`}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                      >
                        Open →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-8 bg-white rounded-2xl shadow-sm border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Create Group
                  </h3>
                </div>
                <p className="text-gray-600 mb-4 text-sm">
                  Start a new group to split receipts with friends or roommates
                </p>
                <div className="flex gap-3">
                  <input
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Roommates, Office Team"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                  <button
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    onClick={createGroup}
                    disabled={creating || !groupName.trim()}
                  >
                    {creating ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>

              <div className="p-8 bg-white rounded-2xl shadow-sm border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Join Group
                  </h3>
                </div>
                <p className="text-gray-600 mb-4 text-sm">
                  Enter a room code to join an existing group
                </p>
                <Link
                  href="/join"
                  className="block w-full text-center px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  Join with Room Code
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
