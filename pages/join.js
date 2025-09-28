import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import Link from "next/link";

export default function JoinGroup() {
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const joinGroup = async (e) => {
    e.preventDefault();
    if (!roomCode.trim()) return;

    setLoading(true);
    setError("");

    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Please sign in first");
        return;
      }

      // Find group by room code (group ID)
      const { data: group, error: groupError } = await supabase
        .from("groups")
        .select("*")
        .eq("id", roomCode.trim())
        .single();

      if (groupError || !group) {
        setError("Invalid room code");
        return;
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from("group_members")
        .select("*")
        .eq("group_id", group.id)
        .eq("user_id", user.id)
        .single();

      if (existingMember) {
        // Already a member, just navigate to the group
        router.push(`/group/${group.id}`);
        return;
      }

      // Add user to group
      const { error: joinError } = await supabase.from("group_members").insert([
        {
          group_id: group.id,
          user_id: user.id,
          role: "member",
        },
      ]);

      if (joinError) {
        setError("Failed to join group");
        return;
      }

      // Navigate to group page
      router.push(`/group/${group.id}`);
    } catch (err) {
      console.error(err);
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Join Group</h1>
          <Link href="/" className="text-sky-600 hover:text-sky-700">
            ← Back
          </Link>
        </div>

        <div className="bg-white p-6 rounded shadow">
          <p className="text-gray-600 mb-4">
            Enter the room code shared by your group admin to join their group.
          </p>

          <form onSubmit={joinGroup}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Room Code
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="Enter room code..."
                className="w-full p-3 border rounded-lg"
                required
              />
            </div>

            {error && (
              <div className="mb-4 text-red-600 text-sm bg-red-50 p-3 rounded">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full p-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50"
            >
              {loading ? "Joining..." : "Join Group"}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Don't have a room code?{" "}
            <Link href="/" className="text-sky-600 hover:text-sky-700">
              Create your own group
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
