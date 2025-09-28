import SignIn from "../SignIn";

export default function AuthSection() {
  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Get Started</h2>
          <p className="text-gray-600">Sign in to start splitting receipts</p>
        </div>
        <SignIn onLogin={() => {}} />
      </div>
    </div>
  );
}
