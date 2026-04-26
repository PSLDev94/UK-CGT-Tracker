import Link from 'next/link'
import { PieChart } from 'lucide-react'

export function PublicNav() {
  return (
    <nav className="border-b sticky top-0 bg-white/80 backdrop-blur-md z-50 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="bg-blue-600 p-1.5 rounded-lg shadow-sm shadow-blue-200">
              <PieChart className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="text-xl font-bold tracking-tight text-gray-900">
              CGT<span className="text-blue-600">Tracker</span>
            </div>
          </Link>

          <div className="flex gap-1 sm:gap-4 items-center">
            <Link href="/tools/bed-and-breakfast-calculator" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 hidden sm:inline transition-colors">
              Free Tools
            </Link>
            <Link href="/guide" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 hidden sm:inline transition-colors">
              CGT Guide
            </Link>
            <Link href="/pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 hidden sm:inline transition-colors">
              Pricing
            </Link>
            <Link href="/contact" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 hidden sm:inline transition-colors">
              Contact
            </Link>
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 transition-colors">
              Log in
            </Link>
            <Link href="/signup" className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium transition-all shadow-sm hover:shadow active:scale-95">
              Start free trial
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
