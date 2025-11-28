import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Users, UserPlus, UserCheck } from 'lucide-react';
import { useAuth } from '../pages/hooks/useAuth';

interface UserFollowCardProps {
  userId: string;
  userName?: string;
}

export function UserFollowCard({ userId, userName }: UserFollowCardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check if current user is following this user
  const { data: isFollowingData } = useQuery({
    queryKey: ['/api/user-follows', user?.id, userId, 'check'],
    queryFn: async () => {
      if (!user?.id) return false;
      const response = await fetch(`/api/user-follows/${user.id}/is-following/${userId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      const data = await response.json();
      return data.isFollowing;
    },
    enabled: !!user?.id && user?.id !== userId,
  });

  // Get followers count
  const { data: followers = [] } = useQuery({
    queryKey: ['/api/user-follows', userId, 'followers'],
    queryFn: async () => {
      const response = await fetch(`/api/user-follows/${userId}/followers`);
      return response.json();
    },
  });

  // Get following count
  const { data: following = [] } = useQuery({
    queryKey: ['/api/user-follows', userId, 'following'],
    queryFn: async () => {
      const response = await fetch(`/api/user-follows/${userId}/following`);
      return response.json();
    },
  });

  // Follow mutation
  const followMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/user-follows/follow/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to follow');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-follows', user?.id, userId, 'check'] });
    },
  });

  // Unfollow mutation
  const unfollowMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/user-follows/unfollow/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to unfollow');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-follows', user?.id, userId, 'check'] });
    },
  });

  // Don't show follow card for own profile
  if (user?.id === userId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Network
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{followers.length}</div>
              <div className="text-sm text-muted-foreground">Followers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{following.length}</div>
              <div className="text-sm text-muted-foreground">Following</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          {userName || 'User'} Network
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{followers.length}</div>
            <div className="text-sm text-muted-foreground">Followers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{following.length}</div>
            <div className="text-sm text-muted-foreground">Following</div>
          </div>
        </div>

        {user?.id && user?.id !== userId && (
          <Button
            onClick={() => {
              if (isFollowingData) {
                unfollowMutation.mutate();
              } else {
                followMutation.mutate();
              }
            }}
            disabled={followMutation.isPending || unfollowMutation.isPending}
            variant={isFollowingData ? 'outline' : 'default'}
            className="w-full"
            data-testid={isFollowingData ? 'button-unfollow' : 'button-follow'}
          >
            {isFollowingData ? (
              <>
                <UserCheck className="w-4 h-4 mr-2" />
                Following
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Follow
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
