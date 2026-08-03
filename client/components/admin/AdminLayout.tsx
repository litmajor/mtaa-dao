import React, { ReactNode, useEffect, useState } from 'react';
// @ts-ignore: CSS module without type declarations
import styles from './AdminLayout.module.css';
import {
  LayoutDashboard,
  Users,
  Building,
  FileText,
  DollarSign,
  LogOut,
  Menu,
  X,
  Zap,
  LogSquare,
  Settings,
  Shield,
} from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, title = 'Admin Dashboard' }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState(() => (typeof window !== 'undefined' ? window.location.pathname : '/'));

  useEffect(() => {
    const onPop = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const menuItems = [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { label: 'Users', href: '/admin/users', icon: Users },
    { label: 'DAOs', href: '/admin/daos', icon: Building },
    { label: 'Proposals', href: '/admin/proposals', icon: FileText },
    { label: 'Treasury', href: '/admin/treasury', icon: DollarSign },
    { label: 'Risk & Analytics', href: '/admin/risk', icon: Shield },
    { label: 'Agents & Elders', href: '/admin/agents-elders', icon: Zap },
    { label: 'Audit Logs', href: '/admin/logs', icon: LogSquare },
    { label: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  const handleLogout = async () => {
    window.location.href = '/logout';
  };

  const isActive = (href: string) => currentPath === href;

  return (
    <div className={styles.container}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div 
          className={styles.mobileOverlay}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.mobileOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <h1 className={styles.logo}>Admin</h1>
          <button 
            className={styles.closeMobile}
            onClick={() => setMobileOpen(false)}
            aria-label="Close mobile menu"
            title="Close mobile menu"
          >
            <X size={24} />
          </button>
        </div>

        <nav className={styles.nav}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <a key={item.href} href={item.href} className={`${styles.navItem} ${isActive(item.href) ? styles.active : ''}`}>
                <Icon size={20} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <button className={styles.logoutBtn} onClick={handleLogout} aria-label="Logout" title="Logout">
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={styles.mainContent}>
        {/* Topbar */}
        <header className={styles.topbar}>
          <button 
            className={styles.menuToggle}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle mobile menu"
            title="Toggle mobile menu"
          >
            <Menu size={24} />
          </button>
          <h2 className={styles.pageTitle}>{title}</h2>
          <div className={styles.topbarActions}>
            <span className={styles.username}>Super Admin</span>
          </div>
        </header>

        {/* Content area */}
        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
