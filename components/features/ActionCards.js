import { useState } from "react";
import Link from "next/link";
import Button from "../ui/Button";

export default function ActionCards({ onCreateGroup, creating }) {
  const [groupName, setGroupName] = useState("");

  const handleCreateGroup = async () => {
    if (groupName.trim()) {
      await onCreateGroup(groupName.trim());
      setGroupName("");
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Create Group Card */}
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
          <h3 className="text-lg font-semibold text-gray-900">Create Group</h3>
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
            onKeyPress={(e) => {
              if (e.key === "Enter" && !creating && groupName.trim()) {
                handleCreateGroup();
              }
            }}
          />
          <Button
            onClick={handleCreateGroup}
            disabled={creating || !groupName.trim()}
            variant="primary"
          >
            {creating ? "Creating..." : "Create"}
          </Button>
        </div>
      </div>

      {/* Join Group Card */}
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
          <h3 className="text-lg font-semibold text-gray-900">Join Group</h3>
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
  );
}
