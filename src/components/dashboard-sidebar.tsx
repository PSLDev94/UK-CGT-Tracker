'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calculator, Upload, LogOut, Settings, FileText, TrendingDown, Menu, X, MessageSquare } from 'lucide-react'

interface DashboardSidebarProps {
  userEmail: string
}

export function DashboardSidebar({ userEmail }: DashboardSidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  // Close sidebar on parameter or route change (helpful on mobile)
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  const navLinks = [
    { name: 'Tax Overview', href: '/dashboard', icon: Calculator },
    { name: 'Upload CSV', href: '/dashboard/upload', icon: Upload },
    { name: 'Tax-Loss Harvesting', href: '/dashboard/tax-loss-harvesting', icon: TrendingDown },
    { name: 'Reports', href: '/dashboard/reports', icon: FileText },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
    { name: 'Contact Us', href: '/dashboard/contact', icon: MessageSquare },
  ]

  return (
    <>
      {/* Mobile Top App Bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200 sticky top-0 z-20 shrink-0">
        <Link href="/" className="text-xl font-bold text-gray-900">CGT Tracker</Link>
        <button 
          onClick={() => setIsOpen(true)} 
          className="p-2 -mr-2 text-gray-600 hover:bg-gray-100 rounded-md"
          aria-label="Open sidebar menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/50 z-30 md:hidden transition-opacity" 
          onClick={() => setIsOpen(false)} 
        />
      )}

      {/* Sidebar Panel */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out flex flex-col
        md:relative md:w-64 md:translate-x-0 md:z-10 bg-white
        ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gray-900">CGT Tracker</Link>
          <button 
            onClick={() => setIsOpen(false)} 
            className="md:hidden p-2 -mr-2 text-gray-500 hover:bg-gray-100 rounded-md"
            aria-label="Close sidebar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navLinks.map((link) => {
            const Icon = link.icon
            // Exact match for dashboard home, prefix match for others
            const isActive = link.href === '/dashboard' 
              ? pathname === '/dashboard' 
              : pathname?.startsWith(link.href)

            return (
              <Link 
                key={link.name}
                href={link.href} 
                className={`flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                  isActive 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                {link.name}
              </Link>
            )
          })}
        </nav>
        
        <div className="p-4 border-t border-gray-100 mt-auto bg-gray-50 md:bg-white">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider px-4 mb-2">Signed in as</div>
          <div className="text-sm font-medium text-gray-900 px-4 mb-4 break-all">{userEmail}</div>
          <form action="/api/auth/logout" method="POST">
             <button type="submit" className="flex w-full items-center px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors">
               <LogOut className="w-5 h-5 mr-3 text-red-500" />
               Sign out
             </button>
          </form>
        </div>
      </div>
    </>
  )
}
