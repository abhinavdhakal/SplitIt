export default function Hero() {
  return (
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
        Upload your PDF receipts, let AI parse the items, and split costs fairly
        with your friends and roommates.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <div className="flex items-center gap-2 text-green-600">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm font-medium">PDF Receipt Parsing</span>
        </div>
        <div className="flex items-center gap-2 text-blue-600">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm font-medium">Smart Cost Splitting</span>
        </div>
        <div className="flex items-center gap-2 text-purple-600">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium">Fair & Accurate</span>
        </div>
      </div>
    </div>
  );
}
