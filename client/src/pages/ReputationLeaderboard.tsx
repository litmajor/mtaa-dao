import React from "react";

// Mock leaderboard data
const leaderboard = [
  { name: "Alice Kimani", points: 320, badge: "Diamond", avatar: "A" },
  { name: "Brian Otieno", points: 270, badge: "Platinum", avatar: "B" },
  { name: "Cynthia Mwangi", points: 220, badge: "Gold", avatar: "C" },
  { name: "David Njoroge", points: 180, badge: "Gold", avatar: "D" },
  { name: "Eunice Wambui", points: 150, badge: "Silver", avatar: "E" },
];

export default function ReputationLeaderboard() {
  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-6">Reputation Leaderboard</h1>
      <table className="w-full border rounded-lg overflow-hidden mb-8">
        <thead className="bg-gray-100">
          <tr>
            <th className="py-2 px-4 text-left">Rank</th>
            <th className="py-2 px-4 text-left">Name</th>
            <th className="py-2 px-4 text-left">Points</th>
            <th className="py-2 px-4 text-left">Badge</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((row, i) => (
            <tr key={row.name} className="border-t">
              <td className="py-2 px-4 font-bold">{i + 1}</td>
              <td className="py-2 px-4 flex items-center space-x-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-mtaa-emerald text-white font-bold">
                  {row.avatar}
                </span>
                <span>{row.name}</span>
              </td>
              <td className="py-2 px-4">{row.points}</td>
              <td className="py-2 px-4">
                <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs">
                  {row.badge}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-sm text-gray-500">Earn more points by voting, referring, and leading proposals!</div>
    </div>
  );
}
