import React, { useState } from "react";
import NotificationPreferences from "../components/NotificationPreferences";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

export default function Settings() {
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
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
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border rounded px-2 py-1"
              />
            </div>
            <button type="submit" className="bg-mtaa-emerald text-white px-4 py-2 rounded font-semibold">Save Profile</button>
          </form>
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
          />
        </div>
        <div>
          <label className="block font-medium mb-1">New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="w-full border rounded px-2 py-1"
          />
        </div>
        <button type="submit" className="bg-mtaa-orange text-white px-4 py-2 rounded font-semibold">Change Password</button>
      </form>
    </div>
  );
}
