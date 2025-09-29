import { useState } from "react";
import Link from "next/link";

export default function ReceiptHeader({
  receipt,
  currentUser,
  userProfiles,
  editingMode,
  onToggleEditMode,
  onFinalize,
  onUndoFinalization,
  onDeleteReceipt,
  onUpdateReceiptName,
}) {
  const [editingReceiptName, setEditingReceiptName] = useState(false);

  const isUploader = currentUser && receipt.uploader_user_id === currentUser.id;
  const isFinalized = receipt.status === "finalized";

  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        {/* Receipt name with editing capability */}
        {editingReceiptName && editingMode ? (
          <input
            type="text"
            defaultValue={
              receipt.name || receipt.filename || "Untitled Receipt"
            }
            className="text-2xl font-bold bg-white border rounded px-3 py-2 w-full max-w-md"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onUpdateReceiptName(e.target.value);
                setEditingReceiptName(false);
              } else if (e.key === "Escape") {
                setEditingReceiptName(false);
              }
            }}
            onBlur={(e) => {
              setTimeout(() => {
                const newName = e.target.value.trim();
                if (newName && newName !== (receipt.name || receipt.filename)) {
                  onUpdateReceiptName(newName);
                  setEditingReceiptName(false);
                } else {
                  setEditingReceiptName(false);
                }
              }, 100);
            }}
            autoFocus
            onFocus={(e) => e.target.select()}
          />
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">
              {receipt.name || receipt.filename || "Untitled Receipt"}
            </h1>
            {editingMode && isUploader && (
              <button
                onClick={() => setEditingReceiptName(true)}
                className="text-sm text-blue-600 hover:text-blue-800"
                title="Click to edit receipt name"
              >
                ✏️
              </button>
            )}
          </div>
        )}
        <p className="text-sm text-gray-600">
          {receipt.filename && receipt.name && receipt.name !== receipt.filename
            ? `File: ${receipt.filename}`
            : ""}
        </p>
        {receipt.uploader_user_id && (
          <p className="text-xs text-gray-500 mt-1">
            Uploaded by{" "}
            {userProfiles[receipt.uploader_user_id]?.display_name ||
              "Unknown user"}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {/* Edit mode toggle - only show to uploader for open receipts */}
        {isUploader && !isFinalized && (
          <button
            onClick={onToggleEditMode}
            className={`px-3 py-2 text-sm rounded hover:bg-purple-700 transition-colors flex items-center gap-1 ${
              editingMode
                ? "bg-purple-600 text-white"
                : "bg-purple-100 text-purple-700 hover:bg-purple-200 hover:text-white"
            }`}
            title="Edit receipt items and amounts"
          >
            {editingMode ? "Exit Edit" : "Edit"}
          </button>
        )}
        {/* Finalize button - only show to uploader for open receipts */}
        {isUploader && !isFinalized && (
          <button
            onClick={onFinalize}
            className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
            title="Calculate final expense splits"
          >
            Finalize
          </button>
        )}
        {/* Undo finalization button - only show to uploader for finalized receipts */}
        {isUploader && isFinalized && (
          <button
            onClick={onUndoFinalization}
            className="px-3 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors flex items-center gap-1"
            title="Reopen this receipt for editing"
          >
            Reopen
          </button>
        )}
        {/* Delete button - only show to uploader */}
        {isUploader && (
          <button
            onClick={onDeleteReceipt}
            className="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors flex items-center gap-1"
            title="Delete this receipt"
          >
            Delete
          </button>
        )}
        <Link
          href={`/group/${receipt.group_id}`}
          className="text-sky-600 hover:text-sky-700"
        >
          ← Back to Group
        </Link>
      </div>
    </div>
  );
}
