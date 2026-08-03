import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Info, AlertTriangle, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  priority: number;
  linkUrl?: string | null;
  linkText?: string | null;
  createdAt: string;
}

const STORAGE_KEY = 'mtaa_dismissed_announcements';

export default function AnnouncementsBanner() {
  const [visibleAnnouncements, setVisibleAnnouncements] = useState<Set<string>>(new Set());
  const [dismissedLocally, setDismissedLocally] = useState<Set<string>>(() => {
    // Load dismissed announcements from localStorage for non-auth users
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const queryClient = useQueryClient();

  // Fetch announcements
  const { data, isLoading } = useQuery({
    queryKey: ['/api/announcements'],
    queryFn: async () => {
      const res = await fetch('/api/announcements', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch announcements');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Mark as viewed mutation (only for authenticated users)
  const viewMutation = useMutation({
    mutationFn: async (announcementId: string) => {
      const res = await fetch(`/api/announcements/${announcementId}/view`, {
        method: 'POST',
        credentials: 'include',
      });
      // Don't throw on 401 - just means user isn't logged in
      if (!res.ok && res.status !== 401) throw new Error('Failed to mark as viewed');
      return res.json();
    },
  });

  // Dismiss mutation
  const dismissMutation = useMutation({
    mutationFn: async (announcementId: string) => {
      const res = await fetch(`/api/announcements/${announcementId}/dismiss`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to dismiss');
      return res.json();
    },
    onSuccess: (_, announcementId) => {
      // Save to localStorage for non-auth users
      setDismissedLocally(prev => {
        const updated = new Set(prev).add(announcementId);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([...updated]));
        } catch (e) {
          console.error('Failed to save dismissed announcements to localStorage:', e);
        }
        return updated;
      });
      
      // Remove from visible announcements
      setVisibleAnnouncements(prev => {
        const updated = new Set(prev);
        updated.delete(announcementId);
        return updated;
      });
      
      // Invalidate query to refetch
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'] });
    },
  });

  // Mark announcements as viewed when they appear
  useEffect(() => {
    if (data?.announcements && data.announcements.length > 0) {
      data.announcements.forEach((announcement: Announcement) => {
        if (!visibleAnnouncements.has(announcement.id)) {
          setVisibleAnnouncements(prev => new Set(prev).add(announcement.id));
          viewMutation.mutate(announcement.id);
        }
      });
    }
  }, [data]);

  const handleDismiss = (announcementId: string) => {
    dismissMutation.mutate(announcementId);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'info':
        return <Info className="w-5 h-5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" />;
      case 'error':
        return <AlertCircle className="w-5 h-5" />;
      case 'success':
        return <CheckCircle className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getStyles = (type: string) => {
    switch (type) {
      case 'info':
        return 'bg-blue-500/20 border-blue-500/50 text-blue-100';
      case 'warning':
        return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-100';
      case 'error':
        return 'bg-red-500/20 border-red-500/50 text-red-100';
      case 'success':
        return 'bg-green-500/20 border-green-500/50 text-green-100';
      default:
        return 'bg-blue-500/20 border-blue-500/50 text-blue-100';
    }
  };

  const getLinkStyles = (type: string) => {
    switch (type) {
      case 'info':
        return 'text-blue-300 hover:text-blue-200';
      case 'warning':
        return 'text-yellow-300 hover:text-yellow-200';
      case 'error':
        return 'text-red-300 hover:text-red-200';
      case 'success':
        return 'text-green-300 hover:text-green-200';
      default:
        return 'text-blue-300 hover:text-blue-200';
    }
  };

  if (isLoading || !data?.announcements || data.announcements.length === 0) {
    return null;
  }

  // Filter out dismissed announcements (both from server and localStorage)
  const activeAnnouncements = data.announcements.filter((a: Announcement) => 
    visibleAnnouncements.has(a.id) && !dismissedLocally.has(a.id)
  );

  if (activeAnnouncements.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 space-y-2 p-2">
      {activeAnnouncements.map((announcement: Announcement) => (
        <div
          key={announcement.id}
          className={`border rounded-lg p-4 flex items-start gap-3 shadow-lg backdrop-blur-sm ${getStyles(announcement.type)}`}
        >
          <div className="flex-shrink-0 mt-0.5">
            {getIcon(announcement.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm mb-1">{announcement.title}</h3>
            <p className="text-sm opacity-90">{announcement.message}</p>
            
            {announcement.linkUrl && announcement.linkText && (
              <a
                href={announcement.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 mt-2 text-sm font-semibold ${getLinkStyles(announcement.type)}`}
              >
                {announcement.linkText}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          <button
            onClick={() => handleDismiss(announcement.id)}
            className="flex-shrink-0 p-1 hover:bg-white/20 rounded transition-colors"
            aria-label="Dismiss announcement"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ))}
    </div>
  );
}

