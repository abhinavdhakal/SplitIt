import Link from "next/link";

export default function GroupHeader({ group }) {
  return (
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-green-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">S</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">SplitIt</h1>
                <p className="text-xs text-gray-500">Smart Receipt Splitter</p>
              </div>
            </Link>
            {group && (
              <div className="ml-4 pl-4 border-l border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  {group.name}
                </h2>
                <p className="text-sm text-gray-500">Group Dashboard</p>
              </div>
            )}
          </div>
          <Link
            href="/"
            className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
