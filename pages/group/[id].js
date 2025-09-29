import { useRouter } from "next/router";
import Head from "next/head";
import { useGroup } from "../../hooks/useGroup";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import GroupHeader from "../../components/layout/GroupHeader";
import ReceiptUpload from "../../components/ReceiptUpload";
import ReceiptsList from "../../components/features/ReceiptsList";
import MembersList from "../../components/features/MembersList";
import RoomCodeCard from "../../components/features/RoomCodeCard";
import AdminControls from "../../components/features/AdminControls";
import Button from "../../components/ui/Button";

export default function GroupPage() {
  const router = useRouter();
  const groupId = router.query.id;

  const {
    group,
    receipts,
    members,
    currentUser,
    currentUserMembership,
    loading,
    error,
    finalizeReceipt,
    refreshData,
  } = useGroup(groupId);

  const handleFinalizeReceipt = async (receipt) => {
    const result = await finalizeReceipt(receipt);
    if (!result.success) {
      alert("Error finalizing receipt: " + result.error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="large" className="mb-4" />
          <p className="text-gray-600">Loading group...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 18.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Group Not Found
          </h2>
          <p className="text-gray-600 mb-6">
            This group may not exist or you don't have permission to view it.
          </p>
          <Button onClick={() => router.push("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>
          {group?.name ? `${group.name} - SplitIt` : "Group - SplitIt"}
        </title>
        <meta
          name="description"
          content="Manage your group expenses and receipts with SplitIt"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
        <GroupHeader group={group} />

        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              <ReceiptUpload groupId={groupId} onUploaded={refreshData} />

              <ReceiptsList
                receipts={receipts}
                currentUser={currentUser}
                currentUserMembership={currentUserMembership}
                loading={loading}
                onFinalizeReceipt={handleFinalizeReceipt}
              />
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <RoomCodeCard groupId={groupId} />
              <MembersList members={members} />
              <AdminControls
                group={group}
                members={members}
                currentUserMembership={currentUserMembership}
                onRefresh={refreshData}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
