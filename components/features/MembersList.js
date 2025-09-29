import Card from "../ui/Card";

export default function MembersList({ members }) {
  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <svg
              className="w-4 h-4 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Members</h3>
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {members.length}
          </span>
        </div>
      </Card.Header>

      <div className="space-y-3">
        {members.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <svg
              className="mx-auto w-8 h-8 text-gray-400 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className="text-sm">No members yet</p>
          </div>
        ) : (
          members.map((member) => (
            <div
              key={member.user_id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">
                    {(member.display_name ||
                      member.email?.split("@")[0] ||
                      "U")[0]?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="font-medium text-gray-900">
                    {member.display_name}
                  </div>
                  {member.email && (
                    <div className="text-sm text-gray-500">{member.email}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {member.role === "admin" && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                    Admin
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
