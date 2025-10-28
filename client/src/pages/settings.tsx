import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import NotificationPreferences from "../components/NotificationPreferences";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { useTheme } from "../components/theme-provider";
import { 
  Moon, Sun, Monitor, Eye, Volume2, Keyboard, Shield, Download, 
  Trash2, AlertTriangle, Key, Smartphone, Lock, Globe, Database,
  LogOut, Clock, CheckCircle, XCircle, Loader2, UserX 
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { useAuth } from "./hooks/useAuth";

interface Session {
  id: string;
  deviceName: string;
  location: string;
  lastActive: string;
  current: boolean;
}

export default function Settings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  // Profile state
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [email, setEmail] = useState(user?.email || "");

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Security state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);

  // Privacy state
  const [profileVisibility, setProfileVisibility] = useState("public");
  const [activityVisibility, setActivityVisibility] = useState("members");
  const [dataSharing, setDataSharing] = useState(false);

  // Account actions
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [disableConfirm, setDisableConfirm] = useState(false);
  const [disableLoading, setDisableLoading] = useState(false);

  // Accessibility state
  const [highContrast, setHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState("normal");
  const [announcements, setAnnouncements] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Fetch active sessions
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ["/api/account/sessions"],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const response = await fetch("/api/account/sessions", {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch sessions");
      }
      
      return response.json();
    },
  });

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; email: string }) => {
      const token = localStorage.getItem('accessToken');
      const response = await fetch("/api/profile/update", {
        method: "PUT",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update profile");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      alert("Profile updated successfully!");
    },
    onError: (error: Error) => {
      alert(error.message);
    },
  });

  // Password update mutation
  const updatePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const token = localStorage.getItem('accessToken');
      const response = await fetch("/api/account/password", {
        method: "PUT",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update password");
      }
      
      return response.json();
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      alert("Password updated successfully!");
    },
    onError: (error: Error) => {
      alert(error.message);
    },
  });

  // Data export mutation
  const exportDataMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('accessToken');
      const response = await fetch("/api/account/export", {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error("Failed to export data");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mtaa-dao-data-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      alert("Data exported successfully!");
    },
    onError: () => {
      alert("Failed to export data");
    },
  });

  // Revoke session mutation
  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/account/sessions/${sessionId}`, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error("Failed to revoke session");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/sessions"] });
      alert("Session revoked successfully!");
    },
  });

  function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    updateProfileMutation.mutate({ firstName, lastName, email });
  }

  function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    
    if (newPassword.length < 8) {
      alert("Password must be at least 8 characters long!");
      return;
    }
    
    updatePasswordMutation.mutate({ currentPassword, newPassword });
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true);
    setDeleteError(null);
    
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ password: deletePassword }),
      });
      
      if (response.ok) {
        localStorage.clear();
        navigate('/goodbye');
      } else {
        const data = await response.json();
        setDeleteError(data.message || 'Failed to delete account');
      }
    } catch (err) {
      setDeleteError('Network error');
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleDisableAccount() {
    setDisableLoading(true);
    
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/account/disable', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (response.ok) {
        alert("Account disabled successfully. You can reactivate it by logging in.");
        logout();
      } else {
        alert("Failed to disable account");
      }
    } catch (err) {
      alert("Network error");
    } finally {
      setDisableLoading(false);
    }
  }

  async function handleToggle2FA() {
    setTwoFactorLoading(true);
    
    try {
      const token = localStorage.getItem('accessToken');
      const endpoint = twoFactorEnabled ? '/api/account/2fa/disable' : '/api/account/2fa/enable';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        if (!twoFactorEnabled && data.qrCode) {
          // Show QR code for setup
          alert("Scan the QR code with your authenticator app (feature in progress)");
        }
        setTwoFactorEnabled(!twoFactorEnabled);
      } else {
        alert("Failed to update 2FA settings");
      }
    } catch (err) {
      alert("Network error");
    } finally {
      setTwoFactorLoading(false);
    }
  }

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme as "light" | "dark" | "system");
  };

  const actualTheme = theme === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') 
    : theme;

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-7">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="accessibility">Accessibility</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="Enter your first name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      placeholder="Enter your last name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Enter your email"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={updateProfileMutation.isPending}
                  className="w-full"
                >
                  {updateProfileMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Profile"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription>Update your password regularly to keep your account secure</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSave} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={updatePasswordMutation.isPending}
                  className="w-full"
                >
                  {updatePasswordMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Change Password"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Two-Factor Authentication
              </CardTitle>
              <CardDescription>Add an extra layer of security to your account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">2FA Status</p>
                  <p className="text-sm text-muted-foreground">
                    {twoFactorEnabled ? "Enabled" : "Disabled"}
                  </p>
                </div>
                <Button
                  onClick={handleToggle2FA}
                  disabled={twoFactorLoading}
                  variant={twoFactorEnabled ? "destructive" : "default"}
                >
                  {twoFactorLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {twoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Active Sessions
              </CardTitle>
              <CardDescription>Manage your active sessions across devices</CardDescription>
            </CardHeader>
            <CardContent>
              {sessionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No active sessions</p>
              ) : (
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            {session.deviceName}
                            {session.current && (
                              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                Current
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {session.location} · Last active: {new Date(session.lastActive).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {!session.current && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => revokeSessionMutation.mutate(session.id)}
                          disabled={revokeSessionMutation.isPending}
                        >
                          <LogOut className="h-4 w-4 mr-1" />
                          Revoke
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Privacy Settings
              </CardTitle>
              <CardDescription>Control your data and visibility preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="profileVisibility">Profile Visibility</Label>
                  <Select value={profileVisibility} onValueChange={setProfileVisibility}>
                    <SelectTrigger id="profileVisibility">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="members">Members Only</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="activityVisibility">Activity Visibility</Label>
                  <Select value={activityVisibility} onValueChange={setActivityVisibility}>
                    <SelectTrigger id="activityVisibility">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Everyone</SelectItem>
                      <SelectItem value="members">Members Only</SelectItem>
                      <SelectItem value="private">Only Me</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="dataSharing">Data Sharing for Analytics</Label>
                    <p className="text-sm text-muted-foreground">
                      Help us improve by sharing anonymized usage data
                    </p>
                  </div>
                  <Switch
                    id="dataSharing"
                    checked={dataSharing}
                    onCheckedChange={setDataSharing}
                  />
                </div>
              </div>

              <Button className="w-full">Save Privacy Settings</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Management
              </CardTitle>
              <CardDescription>Download or delete your data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Export Your Data</p>
                    <p className="text-sm text-muted-foreground">
                      Download a copy of your data in JSON format
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => exportDataMutation.mutate()}
                    disabled={exportDataMutation.isPending}
                  >
                    {exportDataMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Export
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {actualTheme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                Theme Preferences
              </CardTitle>
              <CardDescription>
                Choose your preferred theme or follow system preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant={theme === "light" ? "default" : "outline"}
                  onClick={() => handleThemeChange("light")}
                  className="flex flex-col gap-2 h-auto p-4"
                >
                  <Sun className="h-5 w-5" />
                  Light
                </Button>
                <Button
                  variant={theme === "dark" ? "default" : "outline"}
                  onClick={() => handleThemeChange("dark")}
                  className="flex flex-col gap-2 h-auto p-4"
                >
                  <Moon className="h-5 w-5" />
                  Dark
                </Button>
                <Button
                  variant={theme === "system" ? "default" : "outline"}
                  onClick={() => handleThemeChange("system")}
                  className="flex flex-col gap-2 h-auto p-4"
                >
                  <Monitor className="h-5 w-5" />
                  System
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                Current theme: <span className="font-medium capitalize">{actualTheme}</span>
                {theme === "system" && " (following system preference)"}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <NotificationPreferences />
        </TabsContent>

        {/* Accessibility Tab */}
        <TabsContent value="accessibility" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Visual Settings
              </CardTitle>
              <CardDescription>
                Adjust visual settings for better readability
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="high-contrast">High Contrast</Label>
                  <p className="text-sm text-muted-foreground">
                    Increase contrast for better visibility
                  </p>
                </div>
                <Switch
                  id="high-contrast"
                  checked={highContrast}
                  onCheckedChange={setHighContrast}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="font-size">Font Size</Label>
                <Select value={fontSize} onValueChange={setFontSize}>
                  <SelectTrigger id="font-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                    <SelectItem value="larger">Extra Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="reducedMotion">Reduced Motion</Label>
                  <p className="text-sm text-muted-foreground">
                    Minimize animations and transitions
                  </p>
                </div>
                <Switch
                  id="reducedMotion"
                  checked={reducedMotion}
                  onCheckedChange={setReducedMotion}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                Audio Settings
              </CardTitle>
              <CardDescription>
                Configure audio feedback and announcements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="announcements">Screen Reader Announcements</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable announcements for screen readers
                  </p>
                </div>
                <Switch
                  id="announcements"
                  checked={announcements}
                  onCheckedChange={setAnnouncements}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6">
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                <UserX className="h-5 w-5" />
                Disable Account
              </CardTitle>
              <CardDescription className="text-orange-600 dark:text-orange-500">
                Temporarily disable your account. You can reactivate it by logging in again.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!disableConfirm ? (
                <Button
                  variant="outline"
                  className="border-orange-500 text-orange-700 hover:bg-orange-100"
                  onClick={() => setDisableConfirm(true)}
                >
                  <UserX className="mr-2 h-4 w-4" />
                  Disable Account
                </Button>
              ) : (
                <div className="space-y-4">
                  <p className="text-orange-700 dark:text-orange-400 font-semibold">
                    Are you sure you want to disable your account?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={handleDisableAccount}
                      disabled={disableLoading}
                    >
                      {disableLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Yes, Disable Account
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setDisableConfirm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
                Delete Account
              </CardTitle>
              <CardDescription className="text-red-600 dark:text-red-500">
                Warning: This action is irreversible. All your data will be permanently deleted.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!deleteConfirm ? (
                <Button
                  variant="destructive"
                  onClick={() => setDeleteConfirm(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete My Account
                </Button>
              ) : (
                <div className="space-y-4">
                  <p className="text-red-700 dark:text-red-400 font-semibold">
                    This cannot be undone. Please enter your password to confirm.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="deletePassword">Password</Label>
                    <Input
                      id="deletePassword"
                      type="password"
                      value={deletePassword}
                      onChange={e => setDeletePassword(e.target.value)}
                      placeholder="Enter your password"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={handleDeleteAccount}
                      disabled={deleteLoading || !deletePassword}
                    >
                      {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Yes, Delete My Account
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDeleteConfirm(false);
                        setDeletePassword("");
                        setDeleteError(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                  {deleteError && (
                    <p className="text-red-600 dark:text-red-400 text-sm">{deleteError}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
