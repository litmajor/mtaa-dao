import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Shield, AlertTriangle, CheckCircle, XCircle, Loader2, LogOut, Monitor, Smartphone, Tablet, Laptop } from 'lucide-react';

interface Session {
  id: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  createdAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export default function SecurityAudit() {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch security audit report
  const { data: auditReport, isLoading: auditLoading } = useQuery({
    queryKey: ['/api/admin/security/audit'],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/admin/security/audit', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to fetch audit report');
      return res.json();
    },
    staleTime: 1 * 60 * 1000,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Fetch active sessions
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['/api/admin/security/sessions'],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/admin/security/sessions', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to fetch sessions');
      return res.json();
    },
    staleTime: 1 * 60 * 1000,
    refetchInterval: 30000,
  });

  // Revoke session mutation
  const revokeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/admin/security/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to revoke session');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/security/sessions'] });
      toast({
        title: 'Success',
        description: 'Session revoked successfully',
      });
      setSelectedSession(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getDeviceIcon = (userAgent: string | null) => {
    if (!userAgent) return <Monitor className="w-4 h-4" />;
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return <Smartphone className="w-4 h-4" />;
    }
    if (ua.includes('tablet') || ua.includes('ipad')) {
      return <Tablet className="w-4 h-4" />;
    }
    return <Laptop className="w-4 h-4" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-purple-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Security Audit</h1>
          <p className="text-white/70">Monitor security metrics and active sessions</p>
        </div>

        {/* Security Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/10 border-white/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-sm">Failed Logins</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {auditReport?.security.failedLoginAttempts || 0}
                  </p>
                </div>
                <div className="p-3 bg-red-500/20 rounded-full">
                  <XCircle className="w-6 h-6 text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 border-white/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-sm">Admin Users</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {auditReport?.security.adminUserCount || 0}
                  </p>
                </div>
                <div className="p-3 bg-purple-500/20 rounded-full">
                  <Shield className="w-6 h-6 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 border-white/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-sm">Banned Users</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {auditReport?.security.bannedUserCount || 0}
                  </p>
                </div>
                <div className="p-3 bg-yellow-500/20 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 border-white/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-sm">Active Sessions</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {auditReport?.security.activeSessionCount || 0}
                  </p>
                </div>
                <div className="p-3 bg-green-500/20 rounded-full">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Security Recommendations */}
        {auditReport?.recommendations && auditReport.recommendations.length > 0 && (
          <Card className="mb-8 bg-yellow-500/10 border-yellow-500/30">
            <CardHeader>
              <CardTitle className="text-yellow-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Security Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {auditReport.recommendations.map((rec: string, index: number) => (
                  <li key={index} className="text-yellow-300 flex items-start gap-2">
                    <span className="text-yellow-400 mt-1">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Active Sessions */}
        <Card className="bg-white/10 border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Active Sessions</CardTitle>
            <CardDescription className="text-white/70">
              Monitor and manage active user sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sessionsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-white">User</TableHead>
                    <TableHead className="text-white">Device</TableHead>
                    <TableHead className="text-white">IP Address</TableHead>
                    <TableHead className="text-white">Created</TableHead>
                    <TableHead className="text-white">Expires</TableHead>
                    <TableHead className="text-white">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessionsData?.sessions?.map((session: Session) => (
                    <TableRow key={session.id} className="border-white/10">
                      <TableCell>
                        <div>
                          <div className="font-semibold text-white">
                            {session.userName || 'Anonymous'}
                          </div>
                          <div className="text-sm text-white/60">{session.userEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-white/80">
                          {getDeviceIcon(session.userAgent)}
                          <span className="text-sm">
                            {session.userAgent?.substring(0, 30) || 'Unknown'}...
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-white/80 font-mono text-sm">
                        {session.ipAddress || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-white/80 text-sm">
                        {formatDate(session.createdAt)}
                      </TableCell>
                      <TableCell className="text-white/80 text-sm">
                        {formatDate(session.expiresAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                          onClick={() => setSelectedSession(session)}
                        >
                          <LogOut className="w-4 h-4 mr-1" />
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Revoke Session Dialog */}
        <AlertDialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
          <AlertDialogContent className="bg-gray-900 border-white/20">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">Revoke Session</AlertDialogTitle>
              <AlertDialogDescription className="text-white/70">
                Are you sure you want to revoke this session for {selectedSession?.userEmail}?
                The user will be immediately logged out.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedSession && revokeMutation.mutate(selectedSession.id)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Revoke Session
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Audit Report Info */}
        <Card className="mt-6 bg-white/10 border-white/20">
          <CardHeader>
            <CardTitle className="text-white text-sm">Audit Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-white/70">
              <p>Last audit: {auditReport?.timestamp ? formatDate(auditReport.timestamp) : 'N/A'}</p>
              <p className="mt-2 text-white/50">
                Auto-refreshes every 30 seconds
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

