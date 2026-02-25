import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/index';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/index';
import { Avatar, AvatarImage, AvatarFallback } from './ui/index';
import { Button } from './ui/index';
import { Badge } from './ui/index';
import { Input } from './ui/index';
import { Loader2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FollowUser {
  id: string;
  firstName: string;
  lastName: string;
  username?: string;
  profileImageUrl?: string;
  followersCount?: number;
  followingCount?: number;
}

interface FollowersFollowingModalProps {
  userId: string;
  userName?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'followers' | 'following';
}

export function FollowersFollowingModal({
  userId,
  userName,
  isOpen,
  onOpenChange,
  defaultTab = 'followers',
}: FollowersFollowingModalProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(defaultTab);

  // Fetch followers list
  const { data: followersList = [], isLoading: followersLoading } = useQuery({
    queryKey: [`/api/user-follows/${userId}/followers-list`],
    queryFn: async () => {
      const response = await fetch(`/api/user-follows/${userId}/followers-list`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch followers');
      return response.json();
    },
    enabled: isOpen && activeTab === 'followers',
  });

  // Fetch following list
  const { data: followingList = [], isLoading: followingLoading } = useQuery({
    queryKey: [`/api/user-follows/${userId}/following-list`],
    queryFn: async () => {
      const response = await fetch(`/api/user-follows/${userId}/following-list`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch following');
      return response.json();
    },
    enabled: isOpen && activeTab === 'following',
  });

  const filteredFollowers = followersList.filter((user: FollowUser) =>
    `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFollowing = followingList.filter((user: FollowUser) =>
    `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayList = activeTab === 'followers' ? filteredFollowers : filteredFollowing;
  const isLoading = activeTab === 'followers' ? followersLoading : followingLoading;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {userName}'s Network
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'followers' | 'following')} className="w-full flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="followers" className="flex items-center gap-1">
              Followers
              <Badge variant="secondary" className="ml-1">{followersList.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="following" className="flex items-center gap-1">
              Following
              <Badge variant="secondary" className="ml-1">{followingList.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 mb-3">
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <TabsContent value="followers" className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : displayList.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <p>{searchQuery ? 'No followers found' : 'No followers yet'}</p>
              </div>
            ) : (
              <div className="space-y-2 pr-4">
                {displayList.map((user: FollowUser) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      navigate(`/profile/${user.username || user.id}`);
                      onOpenChange(false);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={user.profileImageUrl} />
                      <AvatarFallback>
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {user.firstName} {user.lastName}
                      </p>
                      {user.username && (
                        <p className="text-xs text-muted-foreground truncate">
                          @{user.username}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="following" className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : displayList.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <p>{searchQuery ? 'No users found' : 'Not following anyone yet'}</p>
              </div>
            ) : (
              <div className="space-y-2 pr-4">
                {displayList.map((user: FollowUser) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      navigate(`/profile/${user.username || user.id}`);
                      onOpenChange(false);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={user.profileImageUrl} />
                      <AvatarFallback>
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {user.firstName} {user.lastName}
                      </p>
                      {user.username && (
                        <p className="text-xs text-muted-foreground truncate">
                          @{user.username}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
