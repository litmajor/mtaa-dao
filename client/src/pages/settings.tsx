import React, { useState } from "react";
import NotificationPreferences from "../components/NotificationPreferences";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { useTheme } from "../components/theme-provider";
import { Moon, Sun } from "lucide-react";

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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
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
            
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <h3 className="font-medium">Theme</h3>
                <p className="text-sm text-muted-foreground">
                  Switch between light and dark mode
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleTheme}
                className="flex items-center gap-2"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4" />
                    Light
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4" />
                    Dark
                  </>
                )}
              </Button>
            </div>

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
      </Tabs>
    </div>
  );
}