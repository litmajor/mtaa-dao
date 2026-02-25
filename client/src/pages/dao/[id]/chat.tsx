import React from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/pages/hooks/useAuth';
import DaoChat from '@/components/dao-chat';

export default function DaoChatPage() {
  const { id: daoId } = useParams<{ id: string }>();
  const { user } = useAuth();

  if (!daoId) {
    return <div className="p-4">Invalid DAO ID</div>;
  }

  if (!user) {
    return <div className="p-4">Please log in to access chat</div>;
  }

  return (
    <div className="h-full flex flex-col p-6">
      <DaoChat 
        daoId={daoId} 
        daoName="DAO Chat"
        currentUserId={user.id}
      />
    </div>
  );
}
