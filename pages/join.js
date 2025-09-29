import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "../hooks/useAuth";
import { useGroups } from "../hooks/useGroups";
import { Card, Button, LoadingSpinner } from "../components";

export default function JoinGroup() {
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const { user, authLoading } = useAuth();
  const { joinGroup, loading } = useGroups();

  const handleJoinGroup = async (e) => {
    e.preventDefault();
    if (!roomCode.trim()) return;

    setError("");

    try {
      if (!user) {
        setError("Please sign in first");
        return;
      }

      const result = await joinGroup(roomCode.trim());

      if (result.alreadyMember) {
        // Already a member, navigate to group
        router.push(`/group/${roomCode.trim()}`);
      } else if (result.success) {
        // Successfully joined
        router.push(`/group/${roomCode.trim()}`);
      }
    } catch (error) {
      if (error.message.includes("not found")) {
        setError("Invalid room code. Please check and try again.");
      } else {
        setError(error.message || "Failed to join group. Please try again.");
      }
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Sign In Required
            </h2>
            <p className="text-gray-600 mb-6">
              You need to be signed in to join a group.
            </p>
            <Link href="/">
              <Button variant="primary" className="w-full">
                Go to Sign In
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="max-w-md mx-auto px-4 py-16">
        <Card>
          <Card.Header>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-green-500 to-blue-500 rounded-2xl flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-white"
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
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Join Group
              </h1>
              <p className="text-gray-600">
                Enter the room code to join an existing group
              </p>
            </div>
          </Card.Header>

          <form onSubmit={handleJoinGroup} className="space-y-4">
            <div>
              <label
                htmlFor="roomCode"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Room Code
              </label>
              <input
                id="roomCode"
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="Enter 6-character room code"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg font-mono tracking-wider uppercase"
                maxLength="6"
                required
                autoFocus
                style={{ textTransform: "uppercase" }}
              />
              <p className="text-xs text-gray-500 mt-1">
                The room code is the same as the Group ID shown in the group
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm flex items-center gap-2">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {error}
                </p>
              </div>
            )}

            <Button
              type="submit"
              variant="success"
              disabled={loading || !roomCode.trim()}
              className="w-full"
            >
              {loading ? "Joining..." : "Join Group"}
            </Button>
          </form>

          <Card.Footer>
            <div className="text-center">
              <Link
                href="/"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                ← Back to Home
              </Link>
            </div>
          </Card.Footer>
        </Card>

        {/* Help section */}
        <Card className="mt-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              How to find a room code?
            </h3>
            <div className="text-sm text-gray-600 space-y-2 text-left">
              <p>• Ask the group creator to share the room code with you</p>
              <p>• The room code is the same as the Group ID (6 characters)</p>
              <p>• You can find it on the group page under the group name</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
