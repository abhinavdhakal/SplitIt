export default function WelcomeSection({ user, userProfile, profileLoading }) {
  const displayName = profileLoading
    ? "Loading..."
    : userProfile?.display_name || user?.email?.split("@")[0] || "User";

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">
            Welcome back, {displayName}!
          </h2>
          <p className="text-gray-600 mt-1">
            Manage your groups and split receipts easily
          </p>
        </div>
      </div>
    </div>
  );
}
