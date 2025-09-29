import Card from "../ui/Card";
import Button from "../ui/Button";

export default function RoomCodeCard({ groupId }) {
  const copyRoomCode = () => {
    navigator.clipboard.writeText(groupId);
    // You might want to add a toast notification here instead of alert
    alert("Room code copied!");
  };

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
            <svg
              className="w-4 h-4 text-purple-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Room Code</h3>
        </div>
      </Card.Header>

      <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-xl">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-600 mb-1">
              Share this code with friends:
            </p>
            <span className="font-mono text-lg font-bold text-gray-900">
              {groupId}
            </span>
          </div>
          <Button variant="outline" size="small" onClick={copyRoomCode}>
            Copy
          </Button>
        </div>
      </div>
    </Card>
  );
}
