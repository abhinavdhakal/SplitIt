export default function AppHeader({ user, onSignOut }) {
  return (
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
              onClick={onSignOut}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
