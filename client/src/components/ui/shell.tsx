import * as React from 'react'
import { SidebarProvider, Sidebar } from './sidebar'

type ShellProps = {
  brand?: React.ReactNode
  primaryNav?: React.ReactNode
  userActions?: React.ReactNode
  children?: React.ReactNode
}

export default function Shell({ brand, primaryNav, userActions, children }: ShellProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen w-full min-w-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-7xl mx-auto p-4 sm:p-6">
          <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex-1 min-w-0">{brand}</div>
            <div>{userActions}</div>
          </header>

          <div className="flex gap-6">
            {primaryNav && (
              <aside className="hidden md:block">
                <Sidebar>{primaryNav}</Sidebar>
              </aside>
            )}

            <main className="flex-1 min-w-0">{children}</main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  )
}

Shell.displayName = 'Shell'
