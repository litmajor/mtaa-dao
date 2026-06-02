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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-7xl mx-auto p-6">
          <header className="mb-8 flex items-center justify-between"> 
            <div className="flex-1">{brand}</div>
            <div className="ml-4">{userActions}</div>
          </header>

          <div className="flex gap-6">
            {primaryNav && (
              <aside className="hidden md:block">
                <Sidebar>{primaryNav}</Sidebar>
              </aside>
            )}

            <main className="flex-1">{children}</main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  )
}

Shell.displayName = 'Shell'
