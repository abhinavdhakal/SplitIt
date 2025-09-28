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

  async function createOrUpdateProfile(user) {
    if (!user) return;

    // Get or create user profile
    let { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      // Create new profile
      const displayName =
        user.user_metadata?.display_name || user.email.split("@")[0];
      const { data: newProfile } = await supabase
        .from("user_profiles")
        .insert({
          user_id: user.id,
          display_name: displayName,
          email: user.email,
        })
        .select()
        .single();
      profile = newProfile;
    }

    setUserProfile(profile);
  }

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user || null);
      if (data.user) {
        await createOrUpdateProfile(data.user);
        fetchGroups(data.user);
      }
    };
    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        await createOrUpdateProfile(session.user);
        fetchGroups(session.user);
      } else {
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
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

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">
          Receipt Splitter (Open Source MVP)
        </h1>

        {!user && <SignIn onLogin={() => {}} />}

        {user && (
          <>
            <div className="mb-4 p-4 bg-white rounded shadow">
              <div className="flex items-center justify-between">
                <div>
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newDisplayName}
                        onChange={(e) => setNewDisplayName(e.target.value)}
                        className="px-2 py-1 border rounded"
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
                        className="px-2 py-1 bg-green-500 text-white rounded text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingName(false)}
                        className="px-2 py-1 bg-gray-500 text-white rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div>
                      Signed in as{" "}
                      <strong>
                        {userProfile?.display_name || "Loading..."}
                      </strong>{" "}
                      ({user.email})
                      <button
                        onClick={() => {
                          setNewDisplayName(userProfile?.display_name || "");
                          setEditingName(true);
                        }}
                        className="ml-2 text-blue-600 text-sm underline"
                      >
                        Edit name
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setUser(null);
                    setUserProfile(null);
                  }}
                  className="px-3 py-1 bg-red-500 text-white rounded"
                >
                  Sign out
                </button>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="font-semibold">Your groups</h2>
              <div className="mt-2 space-y-2">
                {groups.length === 0 && (
                  <div className="text-sm text-gray-600">
                    You have no groups yet.
                  </div>
                )}
                {groups.map((g) => (
                  <div
                    key={g.id}
                    className="p-3 bg-white rounded shadow-sm flex justify-between items-center"
                  >
                    <div>{g.name}</div>
                    <Link href={`/group/${g.id}`} className="text-sky-600">
                      Open
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-white rounded shadow">
                <h3 className="font-semibold">Create group</h3>
                <div className="mt-2 flex gap-2">
                  <input
                    className="flex-1 p-2 border rounded"
                    placeholder="Roommates"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                  <button
                    className="px-3 py-2 bg-sky-600 text-white rounded"
                    onClick={createGroup}
                    disabled={creating}
                  >
                    {creating ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-white rounded shadow">
                <h3 className="font-semibold">Join group</h3>
                <div className="mt-2">
                  <Link
                    href="/join"
                    className="block w-full text-center px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Join with Room Code
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
