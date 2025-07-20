import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useEffect } from "react";

// Define the Member type for better type safety
export type Member = {
  id: number;
  name: string;
  role: string;
  status: string;
  initials: string;
  lastSeen: string;
  avatar: string;
};

const mockMembers = [
  { id: 1, name: "John Mwangi", role: "Elder", status: "online", initials: "JM", lastSeen: "now", avatar: "" },
  { id: 2, name: "Faith Kiprotich", role: "Proposer", status: "online", initials: "FK", lastSeen: "now", avatar: "" },
  { id: 3, name: "Sarah Muthoni", role: "Member", status: "offline", initials: "SM", lastSeen: "2h ago", avatar: "" },
  { id: 4, name: "David Kamau", role: "Member", status: "online", initials: "DK", lastSeen: "now", avatar: "" },
  { id: 5, name: "Grace Wanjiku", role: "Secretary", status: "away", initials: "GW", lastSeen: "5m ago", avatar: "" },
];

const getRoleColor = (role: string) => {
  switch (role) {
    case "Elder": return "from-purple-500 to-purple-700";
    case "Proposer": return "from-emerald-500 to-emerald-700";
    case "Secretary": return "from-blue-500 to-blue-700";
    default: return "from-gray-500 to-gray-700";
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "online": return "bg-emerald-500 shadow-emerald-500/50";
    case "away": return "bg-yellow-500 shadow-yellow-500/50";
    default: return "bg-gray-400";
  }
};

export default function MemberList() {
  const [hoveredMember, setHoveredMember] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    async function fetchMembers() {
      try {
        const res = await fetch('/api/members');
        const data = await res.json();
        setMembers(data);
      } catch {
        setMembers([]);
      }
    }
    fetchMembers();
  }, []);

  const onlineCount = members.filter(m => m.status === "online").length;

  return (
    <div className="relative">
      {/* Ambient background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-blue-50 to-purple-50 rounded-2xl blur-xl opacity-60"></div>
      
      <Card className="relative backdrop-blur-sm bg-white/90 border-0 shadow-2xl shadow-emerald-500/10 rounded-2xl overflow-hidden">
        {/* Premium header with gradient background */}
        <CardHeader className="relative bg-gradient-to-r from-emerald-600 via-emerald-500 to-blue-600 text-white pb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-blue-600/20 backdrop-blur-sm"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold tracking-tight flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-white"></div>
                </div>
                Active Members
              </CardTitle>
              <Badge className="bg-white/20 text-white border-white/30 px-3 py-1 text-sm font-medium">
                {onlineCount} online
              </Badge>
            </div>
            <p className="text-emerald-100 mt-2 text-sm">Community members ready to connect</p>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/20 rounded-full translate-y-12 -translate-x-12"></div>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          {members.map((member, index) => (
            <div
              key={member.id}
              className="group relative"
              onMouseEnter={() => setHoveredMember(member.id)}
              onMouseLeave={() => setHoveredMember(null)}
            >
              {/* Hover background effect */}
              <div className={`absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-50 to-blue-50 opacity-0 group-hover:opacity-100 transition-all duration-300 ${
                hoveredMember === member.id ? 'scale-105' : 'scale-100'
              }`}></div>
              
              <div className={`relative flex items-center space-x-4 p-4 rounded-xl transition-all duration-300 ${
                hoveredMember === member.id ? 'transform translate-x-2' : ''
              }`}>
                {/* Enhanced Avatar with premium styling */}
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-full p-0.5 animate-pulse">
                    <div className="w-full h-full bg-white rounded-full"></div>
                  </div>
                  <Avatar className="relative w-14 h-14 border-2 border-white shadow-lg">
                    <AvatarFallback className={`bg-gradient-to-br ${getRoleColor(member.role)} text-white font-bold text-lg`}>
                      {member.initials}
                    </AvatarFallback>
                  </Avatar>
                  
                  {/* Premium status indicator */}
                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-3 border-white ${getStatusColor(member.status)} shadow-lg animate-pulse`}>
                    {member.status === "online" && (
                      <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-75"></div>
                    )}
                  </div>
                </div>

                {/* Member info with enhanced typography */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-900 text-lg truncate group-hover:text-emerald-600 transition-colors">
                      {member.name}
                    </h3>
                    <Badge variant="secondary" className={`bg-gradient-to-r ${getRoleColor(member.role)} text-white text-xs px-2 py-1 shadow-sm`}>
                      {member.role}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${getStatusColor(member.status).replace('shadow-', 'bg-').split(' ')[0]}`}></span>
                    {member.status === "online" ? "Active now" : `Last seen ${member.lastSeen}`}
                  </p>
                </div>

                {/* Interactive elements */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-emerald-100 hover:text-emerald-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.418 8-9 8a9.013 9.013 0 01-5.314-1.686L3 21l3.686-3.686A8.961 8.961 0 013 12c0-4.418 4.418-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-blue-100 hover:text-blue-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {/* Enhanced CTA button */}
          <div className="pt-4">
            <Button className="w-full bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-105">
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                View All Members
                <span className="bg-white/20 px-2 py-1 rounded-full text-xs">
                  {mockMembers.length}
                </span>
              </span>
            </Button>
          </div>
        </CardContent>

        {/* Premium shine effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
      </Card>
    </div>
  );
}