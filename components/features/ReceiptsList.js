import { useRouter } from "next/router";
import Card from "../ui/Card";
import Button from "../ui/Button";
import StatusBadge from "../ui/StatusBadge";

export default function ReceiptsList({
  receipts,
  currentUser,
  currentUserMembership,
  loading,
  onFinalizeReceipt,
}) {
  const router = useRouter();

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg
              className="w-4 h-4 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            Recent Receipts
          </h3>
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {receipts.length}
          </span>
        </div>
      </Card.Header>

      <div className="space-y-4">
        {receipts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              No receipts yet
            </h4>
            <p className="text-gray-600 mb-4">
              Upload your first receipt to start splitting expenses
            </p>
          </div>
        ) : (
          receipts.map((receipt) => (
            <div
              key={receipt.id}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold text-gray-900">
                      {receipt.name || "Untitled Receipt"}
                    </h4>
                    <StatusBadge
                      status={
                        receipt.status === "finalized" ? "finalized" : "open"
                      }
                    >
                      {receipt.status === "finalized" ? "Finalized" : "Open"}
                    </StatusBadge>
                  </div>

                  <div className="text-sm text-gray-600 grid grid-cols-3 gap-4">
                    <div>
                      Subtotal:{" "}
                      <span className="font-medium">${receipt.subtotal}</span>
                    </div>
                    <div>
                      Tax:{" "}
                      <span className="font-medium">${receipt.tax_total}</span>
                    </div>
                    <div>
                      Tip:{" "}
                      <span className="font-medium">${receipt.tip_total}</span>
                    </div>
                  </div>

                  <div className="text-sm text-gray-900 font-semibold mt-1">
                    Total: ${parseFloat(receipt.total || 0).toFixed(2)}
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  {receipt.status !== "finalized" &&
                    currentUser &&
                    (receipt.uploader_user_id === currentUser.id ||
                      currentUserMembership?.role === "admin") && (
                      <Button
                        variant="primary"
                        size="small"
                        onClick={() => onFinalizeReceipt(receipt)}
                        disabled={loading}
                      >
                        Finalize
                      </Button>
                    )}

                  <Button
                    variant="outline"
                    size="small"
                    onClick={() => router.push(`/receipt/${receipt.id}`)}
                  >
                    Open →
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
