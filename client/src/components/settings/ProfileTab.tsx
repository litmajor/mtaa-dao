import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAccount, useDisconnect, useConnect } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, CheckCircle2, Wallet, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function ProfileTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();
  const injectedConnector = connectors.find((c) => c.name.toLowerCase().includes('injected') || c.id === 'injected');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
  });

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const res = await fetch('/api/profile');
      if (!res.ok) throw new Error('Failed to fetch profile');
      const data = await res.json();
      setFormData({
        firstName: data.user.firstName || '',
        lastName: data.user.lastName || '',
        username: data.user.username || '',
      });
      return data;
    },
  });

  const { data: followers } = useQuery({
    queryKey: ['followers', profile?.user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/user-follows/${profile?.user?.id}/followers`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!profile?.user?.id,
  });

  const { data: following } = useQuery({
    queryKey: ['following', profile?.user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/user-follows/${profile?.user?.id}/following`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!profile?.user?.id,
  });

  const updateProfile = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Send regular profile data
      const res = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: data.firstName, lastName: data.lastName }),
      });
      if (!res.ok) throw new Error('Failed to update profile');

      // Send username update to the dedicated endpoint
      if (data.username && data.username !== profile?.user?.username) {
        const userRes = await fetch('/api/profile/username', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: data.username }),
        });
        if (!userRes.ok) throw new Error('Failed to update username');
      }

      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Profile updated successfully' });
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error updating profile', description: err.message, variant: 'destructive' });
    },
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // TODO: Wire to real S3 bucket upload endpoint
    const formData = new FormData();
    formData.append('avatar', file);

    toast({
      title: 'Uploading avatar...',
      description: 'Storage bucket integration pending.',
    });
    
    // Simulate upload
    // const res = await fetch('/api/upload', { method: 'POST', body: formData });
    // const { url } = await res.json();
    // await fetch('/api/profile', { method: 'PUT', body: JSON.stringify({ profileImageUrl: url }) });
  };

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading profile...</div>;

  const user = profile?.user;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="bg-black/40 border-white/10 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white">Personal Information</CardTitle>
          <CardDescription className="text-gray-400">Update your basic profile details and public persona.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          
          {/* Avatar Section */}
          <div className="flex items-center gap-6">
            <div className="relative group">
              <Avatar className="w-24 h-24 border-2 border-white/10">
                <AvatarImage src={user?.profilePicture} />
                <AvatarFallback className="bg-primary/20 text-primary text-2xl">
                  {user?.firstName?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                <Camera className="w-6 h-6 text-white" />
                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
              </label>
            </div>
            <div>
              <h3 className="text-lg font-medium text-white">{user?.firstName} {user?.lastName}</h3>
              <p className="text-sm text-gray-400 mb-2">{user?.email}</p>
              
              <div className="flex items-center gap-4 text-sm mt-1 mb-2">
                <div className="flex items-center text-gray-300">
                  <span className="font-bold text-white mr-1">{followers?.length || 0}</span> Followers
                </div>
                <div className="flex items-center text-gray-300">
                  <span className="font-bold text-white mr-1">{following?.length || 0}</span> Following
                </div>
              </div>

              <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
                <CheckCircle2 className="w-3 h-3 mr-1 inline" /> KYC Verified
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-gray-300">First Name</Label>
              <Input 
                className="bg-white/5 border-white/10 text-white"
                value={formData.firstName}
                onChange={e => setFormData({ ...formData, firstName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Last Name</Label>
              <Input 
                className="bg-white/5 border-white/10 text-white"
                value={formData.lastName}
                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Username</Label>
              <Input 
                className="bg-white/5 border-white/10 text-white"
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
              />
            </div>
          </div>

          <Button 
            onClick={() => updateProfile.mutate(formData)}
            disabled={updateProfile.isPending}
            className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-black/40 border-white/10 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white">Connected Wallet</CardTitle>
          <CardDescription className="text-gray-400">Manage your Web3 wallet connection.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-500/20">
                <Wallet className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-white">
                  {isConnected ? 'Wallet Connected' : 'No Wallet Connected'}
                </p>
                <p className="text-sm text-gray-400">
                  {isConnected 
                    ? `${address?.slice(0, 6)}...${address?.slice(-4)}`
                    : 'Connect your wallet to interact with DAOs'}
                </p>
              </div>
            </div>
            {isConnected ? (
              <Button variant="outline" className="border-red-500/20 text-red-400 hover:bg-red-500/10" onClick={() => disconnect()}>
                Disconnect
              </Button>
            ) : (
              <Button 
                variant="outline" 
                className="border-white/20 text-white hover:bg-white/10"
                onClick={() => {
                  if (injectedConnector) {
                    connect({ connector: injectedConnector });
                  } else if (connectors.length > 0) {
                    connect({ connector: connectors[0] });
                  } else {
                    toast({ title: 'No wallet found', description: 'Please install MetaMask or another Web3 wallet.', variant: 'destructive' });
                  }
                }}
              >
                Connect Wallet
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
