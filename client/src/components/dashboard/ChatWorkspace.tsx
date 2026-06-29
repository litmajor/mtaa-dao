import React from 'react';
import DaoChat from '../dao-chat';

export default function ChatWorkspace({ daoId }: { daoId: string }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-[800px] flex flex-col">
      <div className="mb-4 shrink-0">
        <h2 className="text-xl font-bold text-white mb-2">💬 DAO Communications</h2>
        <p className="text-slate-400 text-sm">
          Discuss proposals, coordinate actions, and stay connected with other members.
        </p>
      </div>
      
      {/* 
        DaoChat expects daoId as a prop and internally handles 
        fetching messages, real-time presence, and WebSocket events.
      */}
      <div className="flex-1 bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
        <DaoChat daoId={daoId} />
      </div>
    </div>
  );
}
