import React, { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";


export default function SettingsFeatures() {
  // Avatar upload state
  const [avatar, setAvatar] = useState<string | null>(null);
  // Social linking
  const [googleLinked, setGoogleLinked] = useState(false);
  const [telegramLinked, setTelegramLinked] = useState(false);
  // Wallet management
  const [wallet, setWallet] = useState<string>("");
  // Theme preference
  const [theme, setTheme] = useState("system");
  // Language
  const [language, setLanguage] = useState("en");
  // Sessions
  const [sessions, setSessions] = useState<any[]>([]);
  // Loading state
  const [loading, setLoading] = useState(false);

  // Fetch all settings on mount
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const profile = await apiGet("/api/user/profile");
        setAvatar(profile.profileImageUrl || null);
        const social = await apiGet("/api/user/social");
        setGoogleLinked(!!social.google);
        setTelegramLinked(!!social.telegram);
        const walletRes = await apiGet("/api/user/wallet");
        setWallet(walletRes.address || "");
        const settings = await apiGet("/api/user/settings");
        setTheme(settings.theme || "system");
        setLanguage(settings.language || "en");
        const sessionList = await apiGet("/api/user/sessions");
        setSessions(sessionList);
      } catch (e) {
        // handle error
        console.error("Failed to load settings:", e);
        alert("Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      //Implement avatar upload
      setAvatar(URL.createObjectURL(e.target.files[0]));
      // Example: await apiPost("/api/user/avatar", { file: e.target.files[0] });
      await apiPost("/api/user/avatar", { file: e.target.files[0] });
    }
  }

  async function handleSocialLink(type: "google" | "telegram") {
    // Toggle link/unlink
    const newState = type === "google" ? !googleLinked : !telegramLinked;
    if (type === "google") setGoogleLinked(newState);
    if (type === "telegram") setTelegramLinked(newState);
    // Example: await apiPost("/api/user/social", { [type + "Id"]: newState ? "linked" : null })
    await apiPost("/api/user/social", { [type + "Id"]: newState ? "linked" : null });
  }

  async function handleWalletUpdate() {
    await apiPost("/api/user/wallet", { walletAddress: wallet });
    alert("Wallet updated successfully");
  }

  async function handleThemeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setTheme(e.target.value);
    await apiPut("/api/user/settings", { theme: e.target.value });
    alert("Theme updated successfully");
  }

  async function handleLanguageChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setLanguage(e.target.value);
    await apiPut("/api/user/settings", { language: e.target.value });
    alert("Language updated successfully");
  }

  async function handleRevokeSession(sessionId: string) {
    await apiDelete(`/api/user/sessions/${sessionId}`);
    setSessions(sessions.filter(s => s.id !== sessionId));
    alert("Session revoked successfully");
    // Optionally refresh the session list
    const UpdatedSessions = await apiGet("/api/user/sessions");
    setSessions(UpdatedSessions);

  }

  async function handleDeleteAccount() {
    if (window.confirm("Are you sure you want to delete your account? This cannot be undone.")) {
      await apiDelete("/api/user");
      window.location.href = "/";
      alert("Account deleted successfully");
    }
  }

  return (
    <div className="space-y-10">
      {/* Avatar Upload */}
      <section>
        <h2 className="text-lg font-bold mb-2">Profile Picture</h2>
        <div className="flex items-center gap-4">
          <img
            src={avatar || "/default-avatar.png"}
            alt="avatar"
            className="w-16 h-16 rounded-full border"
          />
          <label htmlFor="avatar-upload" className="sr-only">Upload profile picture</label>
          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            title="Upload profile picture"
          />
        </div>
      </section>
      {/* Social Linking */}
      <section>
        <h2 className="text-lg font-bold mb-2">Social Accounts</h2>
        <div className="flex gap-4">
          <button
            className={`px-4 py-2 rounded ${googleLinked ? "bg-green-500 text-white" : "bg-gray-200"}`}
            onClick={() => handleSocialLink("google")}
          >
            {googleLinked ? "Unlink Google" : "Link Google"}
          </button>
          <button
            className={`px-4 py-2 rounded ${telegramLinked ? "bg-green-500 text-white" : "bg-gray-200"}`}
            onClick={() => handleSocialLink("telegram")}
          >
            {telegramLinked ? "Unlink Telegram" : "Link Telegram"}
          </button>
        </div>
      </section>
      {/* Wallet Management */}
      <section>
        <h2 className="text-lg font-bold mb-2">Wallet</h2>
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={wallet}
            onChange={e => setWallet(e.target.value)}
            className="font-mono bg-gray-100 px-2 py-1 rounded border"
            placeholder="Wallet address"
          />
          <button className="bg-blue-500 text-white px-3 py-1 rounded" onClick={handleWalletUpdate}>Update</button>
        </div>
      </section>
      {/* Theme Preference */}
      <section>
        <h2 className="text-lg font-bold mb-2">Theme</h2>
        <label htmlFor="theme-select" className="sr-only">Select theme</label>
        <select
          id="theme-select"
          value={theme}
          onChange={handleThemeChange}
          className="border rounded px-2 py-1"
          title="Select theme"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </section>
      {/* Language Selection */}
      <section>
        <h2 className="text-lg font-bold mb-2">Language</h2>
        <label htmlFor="language-select" className="sr-only">Select language</label>
        <select
          id="language-select"
          value={language}
          onChange={handleLanguageChange}
          className="border rounded px-2 py-1"
          title="Select language"
        >
          <option value="en">English</option>
          <option value="fr">French</option>
          <option value="sw">Swahili</option>
        </select>
      </section>
      {/* Session Management */}
      <section>
        <h2 className="text-lg font-bold mb-2">Active Sessions</h2>
        <ul className="space-y-2">
          {sessions.map(s => (
            <li key={s.id} className="flex items-center gap-2">
              <span>{s.device}</span>
              {s.active && <span className="text-green-500">(Active)</span>}
              <button className="bg-red-500 text-white px-2 py-1 rounded text-xs" onClick={() => handleRevokeSession(s.id)}>Revoke</button>
            </li>
          ))}
        </ul>
      </section>
      {/* Account Deletion */}
      <section>
        <h2 className="text-lg font-bold mb-2 text-red-600">Danger Zone</h2>
        <button className="bg-red-700 text-white px-4 py-2 rounded" onClick={handleDeleteAccount}>Delete Account</button>
      </section>
    </div>
  );
}

