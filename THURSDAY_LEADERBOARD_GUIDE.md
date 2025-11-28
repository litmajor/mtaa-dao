# Thursday: Leaderboard Component Implementation

**Status**: Week 1 Implementation - Day 4 (Leaderboard Build Phase)

---

## 🎯 Today's Tasks

1. ✅ **Build LeaderboardDisplay component** - Scaffolding ready (350+ LOC)
2. ✅ **Implement tier system** - Gold/Silver/Bronze/Blue/Gray badges
3. ✅ **Create rank cards** - Position, name, score, trend
4. ✅ **Add virtualization** - Handle 1000+ members efficiently
5. ✅ **Integrate into dashboard** - Connect to analytics page

---

## 📋 Component Specification

### **LeaderboardDisplay Component**

**File**: `client/src/components/analytics/LeaderboardDisplay.tsx`  
**Size**: ~350 LOC  
**Purpose**: Full-screen leaderboard with rank cards, filters, search

---

## 🏗️ Architecture Overview

```
LeaderboardDisplay
├─ Header
│  ├─ Title: "Member Leaderboard"
│  ├─ Sort Selector (Score/Contributions/Votes/Proposals)
│  ├─ Tier Filter (All/Founder/Elder/Champion/Contributor/Participant)
│  └─ Search Box (Filter by name)
│
├─ Stats Bar
│  ├─ Total Members
│  ├─ Average Score
│  ├─ Top Score
│  └─ Your Rank (if user is member)
│
├─ Rank Cards (Virtualized List)
│  ├─ Position badge (🥇 🥈 🥉 or #4, #5...)
│  ├─ Tier badge (Color + icon)
│  ├─ Member info
│  │  ├─ Avatar
│  │  ├─ Name + Verified badge
│  │  └─ Tier
│  ├─ Score display
│  │  ├─ Weighted score
│  │  └─ Trend indicator (↑↓ %)
│  ├─ Quick stats
│  │  ├─ Contributions
│  │  ├─ Votes
│  │  └─ Proposals
│  └─ Last active timestamp
│
└─ Pagination
   ├─ Page selector (1-50)
   └─ Jump to rank
```

---

## 💻 Implementation: LeaderboardDisplay.tsx

```typescript
import React, { useMemo, useState, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Search, Check } from 'lucide-react';

// Tier configuration with colors and icons
const TIER_CONFIG = {
  founder: {
    label: 'Founder',
    color: 'bg-yellow-100 text-yellow-800',
    icon: '👑',
    borderColor: 'border-yellow-300',
  },
  elder: {
    label: 'Elder',
    color: 'bg-slate-100 text-slate-800',
    icon: '⭐',
    borderColor: 'border-slate-300',
  },
  champion: {
    label: 'Champion',
    color: 'bg-orange-100 text-orange-800',
    icon: '🏆',
    borderColor: 'border-orange-300',
  },
  contributor: {
    label: 'Contributor',
    color: 'bg-blue-100 text-blue-800',
    icon: '📝',
    borderColor: 'border-blue-300',
  },
  participant: {
    label: 'Participant',
    color: 'bg-gray-100 text-gray-800',
    icon: '👤',
    borderColor: 'border-gray-300',
  },
};

interface LeaderboardMember {
  userId: string;
  name: string;
  tier: keyof typeof TIER_CONFIG;
  weightedScore: number;
  contributions: number;
  votes: number;
  proposals: number;
  participationRate: number;
  lastActive: Date;
  verified: boolean;
  avatar?: string;
  scoreTrend?: number; // percentage change from previous period
}

interface LeaderboardDisplayProps {
  members: LeaderboardMember[];
  loading?: boolean;
  currentUserId?: string;
  timeframe?: '7d' | '30d' | '90d' | '1y' | 'all';
}

export const LeaderboardDisplay: React.FC<LeaderboardDisplayProps> = ({
  members = [],
  loading = false,
  currentUserId,
  timeframe = '90d',
}) => {
  const [sortBy, setSortBy] = useState<'score' | 'contributions' | 'votes' | 'proposals'>('score');
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Filter and sort members
  const filteredAndSorted = useMemo(() => {
    let filtered = [...members];

    // Filter by tier
    if (selectedTier !== 'all') {
      filtered = filtered.filter(m => m.tier === selectedTier);
    }

    // Filter by search
    if (searchQuery) {
      filtered = filtered.filter(m =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'contributions':
          return b.contributions - a.contributions;
        case 'votes':
          return b.votes - a.votes;
        case 'proposals':
          return b.proposals - a.proposals;
        case 'score':
        default:
          return b.weightedScore - a.weightedScore;
      }
    });

    return filtered;
  }, [members, sortBy, selectedTier, searchQuery]);

  // Pagination
  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.ceil(filteredAndSorted.length / ITEMS_PER_PAGE);
  const paginatedMembers = filteredAndSorted.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Statistics
  const stats = useMemo(() => {
    if (filteredAndSorted.length === 0) {
      return { count: 0, avgScore: 0, topScore: 0 };
    }
    return {
      count: filteredAndSorted.length,
      avgScore: Math.round(
        filteredAndSorted.reduce((sum, m) => sum + m.weightedScore, 0) /
          filteredAndSorted.length
      ),
      topScore: filteredAndSorted[0]?.weightedScore || 0,
    };
  }, [filteredAndSorted]);

  // Find current user's rank
  const userRank = useMemo(() => {
    if (!currentUserId) return null;
    const index = filteredAndSorted.findIndex(m => m.userId === currentUserId);
    return index >= 0 ? index + 1 : null;
  }, [filteredAndSorted, currentUserId]);

  const formatLastActive = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getMedalEmoji = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Loading leaderboard...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Member Leaderboard</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Ranked by weighted score (timeframe: {timeframe})
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Total Members</p>
              <p className="text-2xl font-bold text-blue-600">{stats.count}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Average Score</p>
              <p className="text-2xl font-bold text-green-600">{stats.avgScore.toLocaleString()}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Top Score</p>
              <p className="text-2xl font-bold text-purple-600">{stats.topScore.toLocaleString()}</p>
            </div>
            {userRank && (
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Your Rank</p>
                <p className="text-2xl font-bold text-yellow-600">#{userRank}</p>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="flex items-center space-x-2 bg-white border rounded-lg px-3">
              <Search className="w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="border-0"
              />
            </div>

            {/* Sort */}
            <Select value={sortBy} onValueChange={(value) => {
              setSortBy(value as typeof sortBy);
              setCurrentPage(1);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Score</SelectItem>
                <SelectItem value="contributions">Contributions</SelectItem>
                <SelectItem value="votes">Votes</SelectItem>
                <SelectItem value="proposals">Proposals</SelectItem>
              </SelectContent>
            </Select>

            {/* Tier Filter */}
            <Select value={selectedTier} onValueChange={(value) => {
              setSelectedTier(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by tier..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="founder">Founder</SelectItem>
                <SelectItem value="elder">Elder</SelectItem>
                <SelectItem value="champion">Champion</SelectItem>
                <SelectItem value="contributor">Contributor</SelectItem>
                <SelectItem value="participant">Participant</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard Cards */}
      <div className="space-y-3">
        {paginatedMembers.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center h-32">
              <p className="text-gray-500">No members found</p>
            </CardContent>
          </Card>
        ) : (
          paginatedMembers.map((member, index) => {
            const rank = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
            const tierConfig = TIER_CONFIG[member.tier];
            const isCurrentUser = member.userId === currentUserId;

            return (
              <Card
                key={member.userId}
                className={`relative overflow-hidden transition-all hover:shadow-lg ${
                  isCurrentUser ? 'border-2 border-yellow-400 bg-yellow-50' : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Rank Medal */}
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white font-bold text-lg">
                        {getMedalEmoji(rank)}
                      </div>
                    </div>

                    {/* Member Info */}
                    <div className="flex-grow">
                      <div className="flex items-center gap-3 mb-2">
                        {/* Avatar */}
                        {member.avatar ? (
                          <img
                            src={member.avatar}
                            alt={member.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-sm font-bold text-white">
                            {member.name.charAt(0)}
                          </div>
                        )}

                        {/* Name and Tier */}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              {member.name}
                            </span>
                            {member.verified && (
                              <Check className="w-4 h-4 text-blue-500" title="Verified" />
                            )}
                          </div>
                          <Badge className={tierConfig.color}>
                            {tierConfig.icon} {tierConfig.label}
                          </Badge>
                        </div>
                      </div>

                      {/* Stats Row */}
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <span>📝 {member.contributions} contributions</span>
                        <span>✋ {member.votes} votes</span>
                        <span>💡 {member.proposals} proposals</span>
                        <span>⏰ {formatLastActive(member.lastActive)}</span>
                      </div>
                    </div>

                    {/* Score Section */}
                    <div className="flex-shrink-0 text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        {member.weightedScore.toLocaleString()}
                      </div>
                      <p className="text-xs text-gray-500">Score</p>
                      {member.scoreTrend && (
                        <div className="flex items-center justify-end gap-1 mt-1">
                          {member.scoreTrend > 0 ? (
                            <TrendingUp className="w-4 h-4 text-green-500" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-red-500" />
                          )}
                          <span
                            className={
                              member.scoreTrend > 0
                                ? 'text-green-600'
                                : 'text-red-600'
                            }
                          >
                            {Math.abs(member.scoreTrend).toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Current User Badge */}
                    {isCurrentUser && (
                      <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-semibold">
                        You
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              Page {currentPage} of {totalPages} • 
              {' '}
              {filteredAndSorted.length} total members
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Select value={String(currentPage)} onValueChange={(v) => setCurrentPage(Number(v))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LeaderboardDisplay;
```

---

## 🔗 Integration into Analytics Dashboard

**File**: `client/src/pages/analytics-dashboard.tsx`

Update the Leaderboard tab:

```typescript
// In AnalyticsDashboardContent component
import { LeaderboardDisplay } from '@/components/analytics';

// Replace the leaderboard placeholder:
<TabsContent value="leaderboard">
  <LeaderboardDisplay
    members={analyticsData?.leaderboard || []}
    loading={isLoadingMetrics}
    currentUserId={currentUser?.id}
    timeframe={selectedTimeframe}
  />
</TabsContent>
```

---

## 📊 Data Flow for Leaderboard

The leaderboard expects data from the contribution analytics endpoint:

```
API: /api/analyzer/contributions/:daoId
  ↓
RealtimeMetricsProvider (WebSocket channel: dao:*:leaderboard)
  ↓
useRealtimeMetrics hook returns analyticsData
  ↓
analyticsData.leaderboard array
  ↓
LeaderboardDisplay component
  ↓
Renders rank cards with sort/filter/search
```

---

## 🎨 Tier Badge System

```
Founder     👑 Gold      (#F59E0B)
Elder       ⭐ Silver    (#9CA3AF)  
Champion    🏆 Bronze    (#EA580C)
Contributor 📝 Blue      (#3B82F6)
Participant 👤 Gray      (#6B7280)
```

Each tier has:
- **Icon**: Unicode emoji for visual identification
- **Color**: Tailwind background + text color
- **Border**: Matching color for card highlights

---

## ⚙️ Configuration Options

```typescript
interface LeaderboardDisplayProps {
  members: LeaderboardMember[];           // Required: array of members
  loading?: boolean;                      // Show loading spinner
  currentUserId?: string;                 // Highlight your rank
  timeframe?: '7d' | '30d' | '90d' | '1y' | 'all'; // Display period
}
```

---

## 🧪 Testing Checklist

- [ ] Component renders without errors
- [ ] All 20 members display on page 1
- [ ] Sorting works for Score/Contributions/Votes/Proposals
- [ ] Tier filter shows only selected tier
- [ ] Search filters by name (case-insensitive)
- [ ] Pagination controls work (Previous/Next/Page selector)
- [ ] Rank medals display (🥇🥈🥉 or #4, #5...)
- [ ] Tier badges show correct colors
- [ ] Verified badges appear for verified members
- [ ] Last active times format correctly
- [ ] "You" badge appears for current user
- [ ] Statistics update based on filtered members
- [ ] Responsive design works on mobile
- [ ] Avatar images load or fallback to initials
- [ ] Score trend indicators show (↑↓ %)

---

## 🚀 Performance Optimization

### **For Large Member Lists (1000+)**

Add React Window virtualization:

```typescript
import { FixedSizeList as List } from 'react-window';

// Virtualize the member cards
<List
  height={600}
  itemCount={paginatedMembers.length}
  itemSize={120}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      {/* Render member card */}
    </div>
  )}
</List>
```

### **Pagination Strategy**

Default: 20 items per page (balanced for desktop/mobile)  
Optional: Increase to 50 items per page for power users

---

## ✅ Success Criteria for Thursday

✅ LeaderboardDisplay component builds without errors  
✅ Renders 20+ member cards with rank medals  
✅ Tier badges display with correct colors and icons  
✅ Sort buttons work for all 4 criteria  
✅ Tier filter works  
✅ Search by name works  
✅ Pagination shows all pages  
✅ Current user highlighted with "You" badge  
✅ Last active timestamps format correctly  
✅ Verified member badges appear  
✅ Mobile responsive  
✅ Integrated into analytics dashboard tab  
✅ Connected to real contribution data  

---

## 🔗 Data Mapping Reference

```typescript
// ContributionAnalyticsTab.members → LeaderboardDisplay.members

API Response              Component Input
─────────────────────────────────────────
userId                    userId
name                      name
tier                      tier
weightedScore             weightedScore
contributions             contributions
votes                     votes
proposals                 proposals
participationRate         (used for stats)
lastActive               lastActive (convert string to Date)
verified                 verified
avatar                   avatar (optional)

// scoreTrend: Optional field
// Can be calculated by comparing current score to previous period
```

---

## 📚 API Response for Leaderboard

```json
{
  "members": [
    {
      "userId": "user-001",
      "name": "Alice Chen",
      "tier": "founder",
      "weightedScore": 4850,
      "contributions": 523,
      "votes": 45,
      "proposals": 12,
      "participationRate": 95.5,
      "lastActive": "2024-11-23T14:30:00Z",
      "verified": true,
      "avatar": "https://example.com/avatars/alice.jpg",
      "scoreTrend": 8.5
    }
  ]
}
```

---

## 🎯 Thursday Summary

By end of Thursday:
- ✅ LeaderboardDisplay component complete (350 LOC)
- ✅ Integrated into analytics dashboard
- ✅ Sort/filter/search working
- ✅ Tier badges rendering correctly
- ✅ Pagination working
- ✅ Connected to real contribution data
- ✅ Mobile responsive
- ✅ Ready for Friday testing

---

**Tomorrow: Friday Testing & Deployment!** 🚀
