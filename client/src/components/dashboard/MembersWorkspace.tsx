import React, { useState, useEffect } from 'react';
import MemberList from '../member-list';
import { getDaoMembers, inviteMember, updateMemberRole, removeMember } from '../../api/membersApi';
import { Button } from '@/components/ui/button';
import { UserPlus, Shield, Star, Users } from 'lucide-react';

export default function MembersWorkspace({ daoId }: { daoId: string }) {
  const [activeTab, setActiveTab] = useState<'roster' | 'invite' | 'roles' | 'reputation'>('roster');
  
  // Invite State
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteMsg, setInviteMsg] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  // Role Management State
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === 'roles' || activeTab === 'reputation') {
      getDaoMembers(daoId).then((res: any) => {
        if (res && res.data) setMembers(res.data);
      }).catch(console.error);
    }
  }, [activeTab, daoId]);

  const handleInvite = async () => {
    if (!inviteEmail && !invitePhone) {
      setInviteMsg({ text: 'Provide an email or phone number', type: 'error' });
      return;
    }
    try {
      await inviteMember(daoId, { email: inviteEmail || undefined, phone: invitePhone || undefined, role: inviteRole });
      setInviteMsg({ text: 'Invite sent successfully!', type: 'success' });
      setInviteEmail('');
      setInvitePhone('');
    } catch (e: any) {
      setInviteMsg({ text: e.message || 'Failed to send invite', type: 'error' });
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateMemberRole(daoId, userId, newRole);
      setMembers(members.map(m => m.userId === userId ? { ...m, role: newRole } : m));
    } catch (e: any) {
      alert('Failed to update role');
    }
  };

  return (
    <div className="bg-slate-900/70 rounded-xl p-4 md:p-6 border border-slate-800">
      {/* Header and Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            👥 Members
          </h3>
          <p className="text-slate-400 mt-1 text-sm">
            Manage your chama roster, roles, and reputation.
          </p>
        </div>
        
        <div className="flex bg-slate-800 rounded-lg p-1 text-sm border border-slate-700">
          <button onClick={() => setActiveTab('roster')} className={`px-4 py-1.5 rounded-md flex items-center gap-2 ${activeTab === 'roster' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            <Users className="w-4 h-4" /> Roster
          </button>
          <button onClick={() => setActiveTab('invite')} className={`px-4 py-1.5 rounded-md flex items-center gap-2 ${activeTab === 'invite' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            <UserPlus className="w-4 h-4" /> Invite
          </button>
          <button onClick={() => setActiveTab('roles')} className={`px-4 py-1.5 rounded-md flex items-center gap-2 ${activeTab === 'roles' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            <Shield className="w-4 h-4" /> Roles
          </button>
          <button onClick={() => setActiveTab('reputation')} className={`px-4 py-1.5 rounded-md flex items-center gap-2 ${activeTab === 'reputation' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            <Star className="w-4 h-4" /> Reputation
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === 'roster' && (
          <div className="text-black">
            <MemberList daoId={daoId} />
          </div>
        )}

        {activeTab === 'invite' && (
          <div className="max-w-md bg-slate-800 p-5 rounded-lg border border-slate-700">
            <h4 className="text-lg font-semibold text-white mb-4">Invite New Member</h4>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400">Email Address</label>
                <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded text-white" placeholder="friend@example.com" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Phone Number (M-Pesa registered)</label>
                <input value={invitePhone} onChange={(e) => setInvitePhone(e.target.value)} className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded text-white" placeholder="254..." />
              </div>
              <div>
                <label className="text-xs text-slate-400">Initial Role</label>
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="w-full mt-1 p-2 bg-slate-900 border border-slate-700 rounded text-white">
                  <option value="member">Member</option>
                  <option value="proposer">Proposer</option>
                  <option value="elder">Elder</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {inviteMsg && (
                <div className={`p-2 rounded text-sm ${inviteMsg.type === 'success' ? 'bg-green-900/30 text-green-400 border border-green-500' : 'bg-red-900/30 text-red-400 border border-red-500'}`}>
                  {inviteMsg.text}
                </div>
              )}

              <Button onClick={handleInvite} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                Send Invite
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'roles' && (
          <div className="overflow-x-auto bg-slate-800/50 rounded-lg border border-slate-700">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700 text-xs uppercase text-slate-400">
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Current Role</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-sm">
                {members.map(m => (
                  <tr key={m.userId} className="hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-white font-medium">{m.userName || m.userEmail || m.userId}</td>
                    <td className="px-4 py-3 capitalize text-slate-300">{m.role || 'member'}</td>
                    <td className="px-4 py-3">
                      <select 
                        value={m.role || 'member'} 
                        onChange={(e) => handleRoleChange(m.userId, e.target.value)}
                        className="bg-slate-900 text-white p-1 rounded border border-slate-600 text-xs"
                      >
                        <option value="member">Member</option>
                        <option value="proposer">Proposer</option>
                        <option value="elder">Elder</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'reputation' && (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-white">Reputation Leaderboard</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {members.sort((a,b) => ((b.trustScore||0) - (a.trustScore||0))).map(m => (
                <div key={m.userId} className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">{m.userName || m.userEmail || m.userId}</div>
                    <div className="text-xs text-slate-400 capitalize">{m.role || 'member'}</div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className={`text-xl font-bold ${(m.trustScore || 60) >= 80 ? 'text-green-400' : (m.trustScore || 60) >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {m.trustScore || 60}
                    </div>
                    <div className="text-xs text-slate-500">Trust Score</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
