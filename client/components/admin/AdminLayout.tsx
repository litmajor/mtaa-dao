import React, { ReactNode } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import styles from './AdminLayout.module.css';
import {
  LayoutDashboard,
  Users,
  Building,
  FileText,
  DollarSign,
  LogSquare,
  Settings,
  Shield,
  LogOut,
  Menu,
  X,
  Zap,
} from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, title = 'Admin Dashboard' }) => {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [mobileOpen, setMobileOpen] = React.useState(false);

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
    await router.push('/logout');
  };

  const isActive = (href: string) => router.pathname === href;

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
          >
            <X size={24} />
          </button>
        </div>

        <nav className={styles.nav}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <a className={`${styles.navItem} ${isActive(item.href) ? styles.active : ''}`}>
                  <Icon size={20} />
                  <span>{item.label}</span>
                </a>
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <button className={styles.logoutBtn} onClick={handleLogout}>
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
