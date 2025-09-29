import { useEffect } from "react";
import Head from "next/head";
import { useAuth } from "../hooks/useAuth";
import { useGroups } from "../hooks/useGroups";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import AppHeader from "../components/layout/AppHeader";
import Hero from "../components/layout/Hero";
import AuthSection from "../components/layout/AuthSection";
import WelcomeSection from "../components/layout/WelcomeSection";
import ProfileSection from "../components/features/ProfileSection";
import GroupsList from "../components/features/GroupsList";
import ActionCards from "../components/features/ActionCards";

export default function Home() {
  const {
    user,
    userProfile,
    authLoading,
    profileLoading,
    updateDisplayName,
    signOut,
  } = useAuth();

  const {
    groups,
    loading: groupsLoading,
    fetchGroups,
    createGroup,
  } = useGroups();

  // Fetch groups when user is available
  useEffect(() => {
    if (user) {
      fetchGroups(user);
    }
  }, [user, fetchGroups]);

  const handleCreateGroup = async (groupName) => {
    try {
      await createGroup(groupName);
    } catch (error) {
      alert(error.message);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="large" className="mb-4" />
          <p className="text-gray-600">Loading SplitIt...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>SplitIt - Split Receipts & Expenses with Friends</title>
        <meta
          name="description"
          content="Easily split receipts and expenses with your friends. Upload receipts, track expenses, and settle up seamlessly."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
        <AppHeader user={user} onSignOut={signOut} />

        <div className="max-w-6xl mx-auto px-4 py-8">
          {!user && (
            <>
              <Hero />
              <AuthSection />
            </>
          )}

          {user && (
            <>
              <WelcomeSection
                user={user}
                userProfile={userProfile}
                profileLoading={profileLoading}
              />

              <ProfileSection
                user={user}
                userProfile={userProfile}
                profileLoading={profileLoading}
                onUpdateProfile={updateDisplayName}
              />

              <GroupsList groups={groups} />

              <ActionCards
                onCreateGroup={handleCreateGroup}
                creating={groupsLoading}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
