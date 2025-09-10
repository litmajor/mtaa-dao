import React, { useState } from "react";
import NotificationPreferences from "../components/NotificationPreferences";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { useTheme } from "../components/theme-provider";
import { Moon, Sun, Monitor, Eye, Volume2, Keyboard } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { Switch } from "../components/ui/switch";

export default function Settings() {
  // Delete account state
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDeleteAccount() {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/account/delete', { method: 'DELETE' });
      if (res.ok) {
        // Optionally redirect or show success message
        window.location.href = '/goodbye';
      } else {
        const data = await res.json();
        setDeleteError(data.error || 'Failed to delete account');
      }
    } catch (err) {
      setDeleteError('Network error');
    } finally {
      setDeleteLoading(false);
    }
  }
  const { theme, toggleTheme } = useTheme();

  // Mock state for user profile
  const [name, setName] = useState("Jane Doe");
  const [email, setEmail] = useState("jane@example.com");
  const [notifications, setNotifications] = useState(true);
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Accessibility state
  const [highContrast, setHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState("normal");
  const [announcements, setAnnouncements] = useState(false);
  const [preferences, setPreferences] = useState({
    reducedMotion: false,
    screenReader: false,
  });

  const handleHighContrastToggle = (checked: boolean) => {
    setHighContrast(checked);
    // Apply high contrast styles here
  };

  const handleFontSizeChange = (value: string) => {
    setFontSize(value);
    // Apply font size styles here
  };

  const handleThemeChange = (newTheme: string) => {
    // This would typically call a function from your theme context to update the theme
    // For now, we'll just log it and simulate the change
    console.log("Theme changed to:", newTheme);
    // Example: setTheme(newTheme); // If setTheme is available in your context
  };

  // Determine the actual theme being displayed (useful if 'system' is selected)
  const actualTheme = theme === 'system' ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;


  function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    alert("Profile updated");
  }

  function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    alert("Password changed");
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="accessibility">Accessibility</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="delete">Delete Account</TabsTrigger>
        <TabsContent value="delete" className="space-y-6">
          <div className="p-4 border rounded-lg bg-red-50">
            <h2 className="text-xl font-bold mb-2 text-red-700">Delete Account</h2>
            <p className="text-sm text-red-600 mb-4">
              Warning: This action is irreversible. All your data will be permanently deleted.
            </p>
            {!deleteConfirm ? (
              <Button
                variant="destructive"
                onClick={() => setDeleteConfirm(true)}
                className="bg-red-600 text-white px-4 py-2 rounded font-semibold"
              >
                Delete My Account
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-red-700 font-semibold">Are you sure? This cannot be undone.</p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={deleteLoading}
                    className="bg-red-600 text-white px-4 py-2 rounded font-semibold"
                  >
                    {deleteLoading ? 'Deleting...' : 'Yes, Delete My Account'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteConfirm(false)}
                  >
                    Cancel
                  </Button>
                </div>
                {deleteError && <p className="text-red-500 mt-2">{deleteError}</p>}
              </div>
            )}
          </div>
        </TabsContent>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          {/* Profile Section */}
          <form onSubmit={handleProfileSave} className="space-y-6">
            <div>
              <label className="block font-medium mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border rounded px-2 py-1"
                placeholder="Enter your name"
                title="Name"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border rounded px-2 py-1"
                placeholder="Enter your email"
                title="Email"
              />
            </div>
            <button type="submit" className="bg-mtaa-emerald text-white px-4 py-2 rounded font-semibold">Save Profile</button>
          </form>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-4">Appearance Settings</h2>

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

            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">Current Theme: {theme === 'dark' ? 'Dark' : 'Light'} Mode</h3>
              <p className="text-sm text-muted-foreground">
                Your theme preference is automatically saved and will persist across sessions.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationPreferences />
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          {/* Password Section */}
          <form onSubmit={handlePasswordSave} className="space-y-6">
            <h2 className="text-xl font-bold mb-2">Change Password</h2>
            <div>
              <label className="block font-medium mb-1">Current Password</label>
              <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border rounded px-2 py-1"
            placeholder="Current password"
            title="Current Password"
          />
        </div>
        <div>
          <label className="block font-medium mb-1">New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="w-full border rounded px-2 py-1"
            placeholder="New password"
            title="New Password"
          />
        </div>
        <button type="submit" className="bg-mtaa-orange text-white px-4 py-2 rounded font-semibold">Change Password</button>
      </form>
        </TabsContent>

        <TabsContent value="accessibility" className="space-y-6">
          <div className="space-y-6">
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
                    onCheckedChange={handleHighContrastToggle}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="font-size">Font Size</Label>
                  <Select value={fontSize} onValueChange={handleFontSizeChange}>
                    <SelectTrigger id="font-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                      <SelectItem value="larger">Larger</SelectItem>
                    </SelectContent>
                  </Select>
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
              <CardContent className="space-y-4">
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Keyboard className="h-5 w-5" />
                  Interaction Settings
                </CardTitle>
                <CardDescription>
                  Customize how you interact with the interface
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Motion:</span> {preferences.reducedMotion ? 'Reduced' : 'Normal'}
                  </div>
                  <div>
                    <span className="font-medium">Input:</span> {preferences.screenReader ? 'Screen Reader' : 'Standard'}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  These settings are automatically detected from your system preferences.
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}