import { useState } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { supabase } from "../../lib/supabaseClient";

export default function AdminControls({
  group,
  members,
  currentUserMembership,
  onRefresh,
}) {
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  // Only show admin controls if user is admin
  if (!currentUserMembership || currentUserMembership.role !== "admin") {
    return null;
  }

  const handleRemoveMember = async (memberId, memberName) => {
    if (
      !confirm(`Are you sure you want to remove ${memberName} from the group?`)
    ) {
      return;
    }

    console.log("Removing member:", { memberId, memberName });

    if (!memberId) {
      console.error("Member ID is undefined");
      alert("Error: Member ID is undefined. Please refresh and try again.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      alert(`${memberName} has been removed from the group.`);
      onRefresh();
    } catch (error) {
      console.error("Error removing member:", error);
      alert("Error removing member. Please try again.");
    }
    setLoading(false);
  };

  const handleToggleRole = async (memberId, currentRole, memberName) => {
    const newRole = currentRole === "admin" ? "member" : "admin";
    const action = newRole === "admin" ? "promote" : "demote";

    if (
      !confirm(
        `Are you sure you want to ${action} ${memberName} ${
          newRole === "admin" ? "to admin" : "to member"
        }?`
      )
    ) {
      return;
    }

    console.log("Toggling role:", {
      memberId,
      currentRole,
      newRole,
      memberName,
    });

    if (!memberId) {
      console.error("Member ID is undefined");
      alert("Error: Member ID is undefined. Please refresh and try again.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("group_members")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) throw error;

      alert(`${memberName} has been ${action}d to ${newRole}.`);
      onRefresh();
    } catch (error) {
      console.error("Error updating member role:", error);
      alert("Error updating member role. Please try again.");
    }
    setLoading(false);
  };

  const handleRegenerateGroupId = async () => {
    if (
      !confirm(
        "Are you sure you want to regenerate the group code? This will invalidate the current code and all pending invites."
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      // Create a new group with the same name and move all data
      const { data: newGroup, error: groupError } = await supabase
        .from("groups")
        .insert([{ name: group.name }])
        .select()
        .single();

      if (groupError) throw groupError;

      // Move all members to new group
      const memberUpdates = members.map((member) => ({
        group_id: newGroup.id,
        user_id: member.user_id,
        role: member.role,
      }));

      const { error: membersError } = await supabase
        .from("group_members")
        .insert(memberUpdates);

      if (membersError) throw membersError;

      // Move all receipts to new group
      const { error: receiptsError } = await supabase
        .from("receipts")
        .update({ group_id: newGroup.id })
        .eq("group_id", group.id);

      if (receiptsError) throw receiptsError;

      // Delete old group (cascade will handle cleanup)
      const { error: deleteError } = await supabase
        .from("groups")
        .delete()
        .eq("id", group.id);

      if (deleteError) throw deleteError;

      alert(
        "Group code regenerated successfully! The page will reload with the new code."
      );
      // Redirect to new group
      window.location.href = `/group/${newGroup.id}`;
    } catch (error) {
      console.error("Error regenerating group code:", error);
      alert("Error regenerating group code. Please try again.");
    }
    setLoading(false);
    setShowRegenerateModal(false);
  };

  const adminMembers = members.filter((m) => m.role === "admin");
  const regularMembers = members.filter((m) => m.role === "member");

  return (
    <>
      <Card>
        <Card.Header>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-4 h-4 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Admin Controls
            </h3>
          </div>
        </Card.Header>

        <div className="space-y-4">
          <div>
            <Button
              variant="outline"
              size="small"
              onClick={() => setShowMemberModal(true)}
              className="w-full"
            >
              Manage Members ({members.length})
            </Button>
          </div>

          <div>
            <Button
              variant="outline"
              size="small"
              onClick={() => setShowRegenerateModal(true)}
              className="w-full text-orange-600 border-orange-200 hover:bg-orange-50"
            >
              Regenerate Group Code
            </Button>
          </div>
        </div>
      </Card>

      {/* Member Management Modal */}
      <Modal
        isOpen={showMemberModal}
        onClose={() => setShowMemberModal(false)}
        title="Manage Group Members"
      >
        <div className="space-y-6">
          {adminMembers.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                Admins ({adminMembers.length})
              </h4>
              <div className="space-y-2">
                {adminMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-yellow-50"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {member.display_name || member.email}
                      </p>
                      <p className="text-sm text-gray-600">
                        Joined {new Date(member.joined_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {adminMembers.length > 1 && (
                        <Button
                          variant="outline"
                          size="small"
                          onClick={() =>
                            handleToggleRole(
                              member.id,
                              member.role,
                              member.display_name || member.email
                            )
                          }
                          disabled={loading}
                        >
                          Demote
                        </Button>
                      )}
                      {member.user_id !== currentUserMembership.user_id &&
                        adminMembers.length > 1 && (
                          <Button
                            variant="outline"
                            size="small"
                            onClick={() =>
                              handleRemoveMember(
                                member.id,
                                member.display_name || member.email
                              )
                            }
                            disabled={loading}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            Remove
                          </Button>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {regularMembers.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                Members ({regularMembers.length})
              </h4>
              <div className="space-y-2">
                {regularMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {member.display_name || member.email}
                      </p>
                      <p className="text-sm text-gray-600">
                        Joined {new Date(member.joined_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="small"
                        onClick={() =>
                          handleToggleRole(
                            member.id,
                            member.role,
                            member.display_name || member.email
                          )
                        }
                        disabled={loading}
                        className="text-green-600 border-green-200 hover:bg-green-50"
                      >
                        Make Admin
                      </Button>
                      <Button
                        variant="outline"
                        size="small"
                        onClick={() =>
                          handleRemoveMember(
                            member.id,
                            member.display_name || member.email
                          )
                        }
                        disabled={loading}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {members.length === 1 && (
            <div className="text-center text-gray-500 py-8">
              <p>You are the only member in this group.</p>
              <p className="text-sm">Share the group code to invite others!</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Regenerate Group Code Modal */}
      <Modal
        isOpen={showRegenerateModal}
        onClose={() => setShowRegenerateModal(false)}
        title="Regenerate Group Code"
      >
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-orange-600 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <div>
                <h4 className="font-medium text-orange-900 mb-1">Warning</h4>
                <p className="text-sm text-orange-800">
                  This will generate a new group code and invalidate the current
                  one. Anyone with the old code will no longer be able to join.
                  All existing members and data will remain intact.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowRegenerateModal(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRegenerateGroupId}
              disabled={loading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {loading ? "Regenerating..." : "Regenerate Code"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
