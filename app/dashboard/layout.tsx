/**
 * /app/dashboard/layout.tsx
 * Dashboard layout wrapper with AppLayout component
 * All dashboard pages inherit this layout with sidebar + top nav
 */

import AppLayout from '@/client/components/layout/AppLayout';

export const metadata = {
  title: 'MTAA Protocol - Dashboard',
  description: 'Trading and analytics dashboard',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
