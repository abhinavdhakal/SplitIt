import { useState } from "react";
import Button from "../ui/Button";

export default function ProfileSection({
  user,
  userProfile,
  profileLoading,
  onUpdateProfile,
}) {
  const [editingName, setEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");

  const handleSaveName = async () => {
    if (newDisplayName.trim()) {
      const success = await onUpdateProfile(newDisplayName.trim());
      if (success) {
        setEditingName(false);
      }
    }
  };

  const handleStartEdit = () => {
    setNewDisplayName(
      userProfile?.display_name || user?.email?.split("@")[0] || ""
    );
    setEditingName(true);
  };

  return (
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
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleSaveName();
                    }
                  }}
                />
                <Button onClick={handleSaveName} variant="success" size="small">
                  Save
                </Button>
                <Button
                  onClick={() => setEditingName(false)}
                  variant="secondary"
                  size="small"
                >
                  Cancel
                </Button>
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
                <div className="text-gray-600 text-sm">{user.email}</div>
                <button
                  onClick={handleStartEdit}
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
  );
}
