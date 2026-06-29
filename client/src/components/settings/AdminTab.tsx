import React from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Users, Database, Activity, ArrowRight } from 'lucide-react';

export function AdminTab() {
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="bg-red-950/20 border-red-500/30 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-red-400 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" /> Administrator Controls
          </CardTitle>
          <CardDescription className="text-red-300/70">
            You are viewing this tab because your account has admin privileges.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-black/40 border border-red-500/20 p-4 rounded-xl text-center">
              <Users className="w-6 h-6 text-red-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">1,204</div>
              <div className="text-sm text-gray-400">Total Users</div>
            </div>
            <div className="bg-black/40 border border-red-500/20 p-4 rounded-xl text-center">
              <Database className="w-6 h-6 text-red-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">45</div>
              <div className="text-sm text-gray-400">Active DAOs</div>
            </div>
            <div className="bg-black/40 border border-red-500/20 p-4 rounded-xl text-center">
              <Activity className="w-6 h-6 text-red-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">99.9%</div>
              <div className="text-sm text-gray-400">System Uptime</div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-red-500/20">
            <Button 
              className="w-full justify-between bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30"
              onClick={() => setLocation('/admin/system-settings')}
            >
              Open Full System Settings
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button 
              className="w-full justify-between bg-black/40 hover:bg-white/5 text-gray-300 border border-white/10"
              onClick={() => setLocation('/admin/users')}
            >
              Manage Users
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button 
              className="w-full justify-between bg-black/40 hover:bg-white/5 text-gray-300 border border-white/10"
              onClick={() => setLocation('/admin/audit')}
            >
              View Audit Logs
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
