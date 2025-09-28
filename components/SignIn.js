import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function SignIn({ onLogin }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [isSignUp, setIsSignUp] = useState(true);

  const signIn = async (e) => {
    e.preventDefault();

    // Validate name for signup
    if (isSignUp && !name.trim()) {
      setMsg("Please enter your name for sign up.");
      return;
    }

    setLoading(true);
    setMsg("");

    // Check if user already exists when trying to sign up
    if (isSignUp) {
      const { data: existingProfile } = await supabase
        .from("user_profiles")
        .select("email")
        .eq("email", email)
        .single();

      if (existingProfile) {
        setLoading(false);
        setMsg(
          "This email is already registered. Please use 'Sign In' instead."
        );
        setIsSignUp(false); // Switch to sign in mode
        return;
      }
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            display_name: isSignUp ? name.trim() : email.split("@")[0],
          },
          shouldCreateUser: isSignUp,
        },
      });

      if (error) throw error;
      
      setMsg(
        `Magic link sent to ${email}! Check your email (including spam folder) and click the link to sign in. ${
          isSignUp ? "Welcome!" : "Welcome back!"
        }`
      );
      
      if (onLogin) onLogin();
    } catch (error) {
      console.error('Sign in error:', error);
      setMsg("Error: " + error.message + " Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white shadow rounded mt-12">
      <h2 className="text-lg font-bold mb-4">
        {isSignUp ? "Create Account" : "Sign In"}
      </h2>

      {/* Toggle between login and signup */}
      <div className="flex mb-4 bg-gray-100 rounded p-1">
        <button
          type="button"
          onClick={() => setIsSignUp(true)}
          className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors ${
            isSignUp
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          Sign Up
        </button>
        <button
          type="button"
          onClick={() => setIsSignUp(false)}
          className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors ${
            !isSignUp
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          Sign In
        </button>
      </div>

      <form onSubmit={signIn}>
        {isSignUp && (
          <input
            className="w-full p-2 border rounded mb-3"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required={isSignUp}
          />
        )}
        <input
          className="w-full p-2 border rounded mb-3"
          placeholder="you@example.com"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          className="w-full p-2 bg-sky-600 text-white rounded"
          disabled={loading}
        >
          {loading
            ? "Sending..."
            : `Send magic link${isSignUp ? " (Sign Up)" : " (Sign In)"}`}
        </button>
      </form>
      <p className="text-sm mt-3 text-gray-600">{msg}</p>
    </div>
  );
}
