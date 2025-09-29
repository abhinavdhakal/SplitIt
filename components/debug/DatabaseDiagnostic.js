import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function DatabaseDiagnostic({ groupId }) {
  const [diagnostic, setDiagnostic] = useState(null);
  const [loading, setLoading] = useState(false);

  const runDiagnostic = async () => {
    if (!groupId) return;

    setLoading(true);
    const results = {
      groupId,
      timestamp: new Date().toISOString(),
      tests: [],
    };

    try {
      // Test 1: Check if group exists
      const { data: groupData, error: groupError } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId)
        .single();

      results.tests.push({
        name: "Group Exists",
        success: !groupError && !!groupData,
        data: groupData,
        error: groupError?.message,
      });

      // Test 2: Check current user
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      results.tests.push({
        name: "Current User",
        success: !userError && !!userData?.user,
        data: userData?.user
          ? { id: userData.user.id, email: userData.user.email }
          : null,
        error: userError?.message,
      });

      // Test 3: Check group_members table structure
      const { data: membersData, error: membersError } = await supabase
        .from("group_members")
        .select("*")
        .eq("group_id", groupId)
        .limit(5);

      results.tests.push({
        name: "Group Members Query",
        success: !membersError,
        data: membersData,
        error: membersError?.message,
      });

      // Test 4: Check if current user is a member
      if (userData?.user) {
        const { data: membershipData, error: membershipError } = await supabase
          .from("group_members")
          .select("*")
          .eq("group_id", groupId)
          .eq("user_id", userData.user.id)
          .single();

        results.tests.push({
          name: "Current User Membership",
          success: !membershipError && !!membershipData,
          data: membershipData,
          error: membershipError?.message,
        });
      }

      // Test 5: Check user_profiles table
      const { data: profilesData, error: profilesError } = await supabase
        .from("user_profiles")
        .select("*")
        .limit(5);

      results.tests.push({
        name: "User Profiles Access",
        success: !profilesError,
        data: profilesData,
        error: profilesError?.message,
      });
    } catch (error) {
      results.tests.push({
        name: "General Error",
        success: false,
        error: error.message,
      });
    }

    setDiagnostic(results);
    setLoading(false);
  };

  useEffect(() => {
    if (groupId) {
      runDiagnostic();
    }
  }, [groupId]);

  if (!groupId) return null;

  return (
    <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Database Diagnostic</h3>
        <button
          onClick={runDiagnostic}
          disabled={loading}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? "Running..." : "Refresh"}
        </button>
      </div>

      {diagnostic && (
        <div className="space-y-3">
          <div className="text-sm text-gray-600">
            <strong>Group ID:</strong> {diagnostic.groupId}
            <br />
            <strong>Time:</strong>{" "}
            {new Date(diagnostic.timestamp).toLocaleString()}
          </div>

          {diagnostic.tests.map((test, index) => (
            <div
              key={index}
              className={`p-3 rounded border ${
                test.success
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`w-4 h-4 rounded-full ${
                    test.success ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                <strong className="text-sm">{test.name}</strong>
              </div>

              {test.error && (
                <div className="text-red-600 text-sm mb-2">
                  <strong>Error:</strong> {test.error}
                </div>
              )}

              {test.data && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                    Show Data
                  </summary>
                  <pre className="mt-2 bg-white p-2 rounded border overflow-auto">
                    {JSON.stringify(test.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
