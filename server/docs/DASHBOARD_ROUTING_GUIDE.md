/**
 * DASHBOARD ROUTING & INTEGRATION GUIDE
 * 
 * How to integrate the superuser and DAO member dashboards into your app
 */

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                    STEP 1: UPDATE MAIN APP ROUTES                         ║
// ║                   (client/src/app or client/src/pages)                    ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

/**
 * File: client/src/app/layout.tsx (or your route layout)
 * 
 * Add routes for both dashboards
 */

// PSEUDO CODE - Adjust to your routing setup (Next.js App Router vs Pages Router)
/*

// Next.js App Router Structure:
src/app/
├── dashboard/
│   ├── layout.tsx          (shared layout for all dashboards)
│   ├── elders/
│   │   ├── page.tsx        (superuser dashboard - ALL DAOs)
│   │   │   └─ Component: <EldKaizenDashboard />
│   │   │   └─ Shows: All DAOs in grid
│   │   │
│   │   └─ dao/
│   │       └─ [daoId]/
│   │           └─ page.tsx (DAO member dashboard - SINGLE DAO)
│   │               └─ Component: <DAOKaizenDashboard />
│   │               └─ Props: daoId from params
│   │               └─ Shows: Single DAO detail view

// Next.js Pages Router Structure (legacy):
pages/
├── dashboard/
│   ├── elders/
│   │   ├── index.tsx       (superuser dashboard - ALL DAOs)
│   │   └─ Component: <EldKaizenDashboard />
│   │
│   └─ elders/
│       └─ dao/
│           └─ [daoId].tsx  (DAO member dashboard - SINGLE DAO)
│               └─ Component: <DAOKaizenDashboard />

*/

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                    STEP 2: ROUTING EXAMPLES                               ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

/*

SUPERUSER ROUTES:
─────────────────

1. SUPERUSER DASHBOARD (All DAOs)
   Route:     /dashboard/elders
   Component: EldKaizenDashboard.tsx
   Role:      Superuser only
   Shows:     Grid/list of all 10 DAOs with scores
   Calls:     GET /api/elders/kaizen/dashboard

   URL Bar:   http://localhost:3000/dashboard/elders
   Request:   GET /api/elders/kaizen/dashboard
   Auth:      Bearer {superuser_token}
   Response:  { daos: [{daoId, metrics, recommendations}, ...] }


DAO MEMBER ROUTES:
──────────────────

2. DAO MEMBER DASHBOARD (Single DAO)
   Route:     /dashboard/elders/dao/:daoId
   Component: DAOKaizenDashboard.tsx
   Role:      DAO members (must be in daos[] array)
   Shows:     Single DAO detail view (trends, opportunities, stats)
   Calls:     Multiple DAO-scoped endpoints
   
   Examples:
   ├─ http://localhost:3000/dashboard/elders/dao/dao-abc
   │  └─ Fetches: GET /api/elders/kaizen/dao/dao-abc/metrics
   │  └─ Shows: dao-abc dashboard
   │
   ├─ http://localhost:3000/dashboard/elders/dao/dao-xyz
   │  └─ Fetches: GET /api/elders/kaizen/dao/dao-xyz/metrics
   │  └─ Shows: dao-xyz dashboard
   │
   └─ http://localhost:3000/dashboard/elders/dao/dao-unknown
      └─ Fetches: GET /api/elders/kaizen/dao/dao-unknown/metrics
      └─ Auth fails: 403 Forbidden (user not member)
      └─ Shows: Error message "Access denied"

*/

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                    STEP 3: IMPLEMENTATION CODE                            ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

/**
 * Example: Next.js App Router Implementation
 * (Adjust path based on your project structure)
 */

/*

FILE: client/src/app/dashboard/elders/page.tsx
─────────────────────────────────────────────

'use client';

import EldKaizenDashboard from '@/components/EldKaizenDashboard';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SuperuserDashboard() {
  const router = useRouter();

  useEffect(() => {
    // Optional: Verify user is superuser before showing dashboard
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const user = localStorage.getItem('user');
      
      if (!user) {
        router.push('/login');
        return;
      }

      const userData = JSON.parse(user);
      if (userData.role !== 'superuser') {
        router.push('/dashboard'); // Redirect to member dashboard
        return;
      }
    };

    checkAuth();
  }, [router]);

  return <EldKaizenDashboard />;
}


FILE: client/src/app/dashboard/elders/dao/[daoId]/page.tsx
──────────────────────────────────────────────────────────

'use client';

import DAOKaizenDashboard from '@/components/DAOKaizenDashboard';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DAOMemberDashboard() {
  const params = useParams();
  const router = useRouter();
  const daoId = params?.daoId as string;

  useEffect(() => {
    // Optional: Verify user is member of this DAO
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const user = localStorage.getItem('user');
      
      if (!user || !token) {
        router.push('/login');
        return;
      }

      const userData = JSON.parse(user);
      
      // Check if user is member of this DAO
      if (!userData.daos?.includes(daoId)) {
        router.push('/dashboard'); // Redirect to other dashboards
        return;
      }
    };

    checkAuth();
  }, [daoId, router]);

  return daoId ? <DAOKaizenDashboard /> : null;
}

*/

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                    STEP 4: NAVIGATION & ROUTING                           ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

/*

USER JOURNEY: Superuser
───────────────────────

1. User logs in → stored in localStorage:
   {
     id: "charlie-456",
     role: "superuser",
     daos: []
   }

2. Superuser clicks "Performance Dashboard"
   └─ Navigates to: /dashboard/elders
   └─ Loads: EldKaizenDashboard component
   └─ Component calls: GET /api/elders/kaizen/dashboard
   └─ Middleware: authenticateToken ✓, isSuperUser ✓
   └─ Backend returns: All 10 DAOs data
   └─ Display: Grid of all DAOs with health scores

3. Superuser clicks on "DAO ABC" card
   └─ Can navigate to: /dashboard/elders/dao/dao-abc
   └─ Loads: DAOKaizenDashboard component
   └─ Component calls: GET /api/elders/kaizen/dao/dao-abc/metrics
   └─ Middleware: authenticateToken ✓, isDaoMember (might skip for superuser)
   └─ Backend returns: dao-abc specific metrics
   └─ Display: dao-abc detail dashboard


USER JOURNEY: DAO Member (Alice)
─────────────────────────────────

1. User logs in → stored in localStorage:
   {
     id: "alice-123",
     role: "member",
     daos: ["dao-abc", "dao-xyz"]
   }

2. Alice clicks "My DAO Dashboard"
   └─ Navigates to: /dashboard/elders/dao/dao-abc
   └─ Loads: DAOKaizenDashboard component
   └─ Component calls: GET /api/elders/kaizen/dao/dao-abc/metrics
   └─ Middleware: authenticateToken ✓, isDaoMember ✓
   └─ Backend check: req.user.daos.includes("dao-abc") ✓ TRUE
   └─ Backend returns: dao-abc metrics only
   └─ Display: dao-abc detail dashboard

3. Alice tries to access: /dashboard/elders
   └─ Loads: EldKaizenDashboard component
   └─ Component calls: GET /api/elders/kaizen/dashboard
   └─ Middleware: authenticateToken ✓, isSuperUser ✗ FALSE
   └─ Server returns: 403 Forbidden
   └─ Display: "Access denied - Superuser only"

4. Alice tries to access: /dashboard/elders/dao/dao-secret
   └─ Loads: DAOKaizenDashboard component
   └─ Component calls: GET /api/elders/kaizen/dao/dao-secret/metrics
   └─ Middleware: authenticateToken ✓, isDaoMember ✓
   └─ Backend check: req.user.daos.includes("dao-secret") ✗ FALSE
   └─ Server returns: 403 Forbidden "Access denied"
   └─ Display: "Error: Access denied to this DAO"

5. Alice tries to access: /dashboard/elders/dao/dao-xyz
   └─ Loads: DAOKaizenDashboard component
   └─ Component calls: GET /api/elders/kaizen/dao/dao-xyz/metrics
   └─ Middleware: authenticateToken ✓, isDaoMember ✓
   └─ Backend check: req.user.daos.includes("dao-xyz") ✓ TRUE
   └─ Backend returns: dao-xyz metrics
   └─ Display: dao-xyz detail dashboard ✓

*/

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                    STEP 5: NAVIGATION COMPONENT                           ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

/**
 * Example Navigation Component showing both dashboards
 */

/*

FILE: client/src/components/DashboardNav.tsx
──────────────────────────────────────────────

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface User {
  id: string;
  role: string;
  daos: string[];
}

export default function DashboardNav() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  if (!user) return null;

  return (
    <nav className="bg-slate-800 border-b border-slate-700 p-4">
      <div className="flex gap-4">
        {/* Superuser Dashboard */}
        {user.role === 'superuser' && (
          <Link
            href="/dashboard/elders"
            className="px-4 py-2 rounded bg-amber-500 text-white hover:bg-amber-600"
          >
            📊 System Dashboard (All DAOs)
          </Link>
        )}

        {/* DAO Member Dashboards */}
        {user.daos && user.daos.length > 0 && (
          <div className="flex gap-2">
            {user.daos.map(daoId => (
              <Link
                key={daoId}
                href={`/dashboard/elders/dao/${daoId}`}
                className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600"
              >
                📈 {daoId} Dashboard
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

*/

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║                    STEP 6: ERROR HANDLING                                 ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

/*

COMMON ERRORS & SOLUTIONS
──────────────────────────

1. User tries superuser dashboard but is DAO member
   Error:    403 Forbidden
   Reason:   isSuperUser middleware rejects non-superuser
   Display:  "Access denied - Superuser access required"
   Solution: Frontend should check user.role before showing link

2. User tries to access DAO they're not member of
   Error:    403 Forbidden
   Reason:   isDaoMember + daoId check fails
   Display:  "Access denied - Not a member of this DAO"
   Solution: Frontend should verify req.user.daos.includes(daoId)

3. User not authenticated
   Error:    401 Unauthorized
   Reason:   JWT token missing or invalid
   Display:  Redirect to login page
   Solution: Check localStorage for token before making API calls

4. No metrics available for DAO
   Error:    404 Not Found
   Reason:   eldKaizen hasn't collected metrics yet
   Display:  "No metrics available - Waiting for first analysis"
   Solution: Show loading state, retry after ELD-KAIZEN completes analysis

*/

export interface DashboardRoutingGuide {
  superuserRoute: '/dashboard/elders';
  daoMemberRoute: '/dashboard/elders/dao/:daoId';
  roleBasedDisplay: 'Automatic based on JWT user.role';
  dataScoping: 'Server enforces before returning data';
  security: 'Multiple layers: JWT + Role + DAO membership';
}
