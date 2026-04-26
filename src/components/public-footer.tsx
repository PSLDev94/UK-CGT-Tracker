import Link from 'next/link'
import { PieChart } from 'lucide-react'

export function PublicFooter() {
  return (
    <footer className="border-t py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="bg-blue-600 p-1.5 rounded-lg shadow-sm shadow-blue-200">
                <PieChart className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-gray-900 text-lg">CGT<span className="text-blue-600">Tracker</span></span>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed">
              Automated UK Capital Gains Tax calculator for self-directed investors. HMRC-compliant SA108 reports.
            </p>
          </div>

          {/* Guides */}
          <div>
            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Tax Guides</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/guide" className="text-gray-500 hover:text-gray-900 transition-colors">CGT Guide Overview</Link></li>
              <li><Link href="/guide/section-104-pool" className="text-gray-500 hover:text-gray-900 transition-colors">Section 104 Pool</Link></li>
              <li><Link href="/guide/bed-and-breakfast-rule" className="text-gray-500 hover:text-gray-900 transition-colors">Bed &amp; Breakfast Rule</Link></li>
              <li><Link href="/guide/cgt-rates-2025-26" className="text-gray-500 hover:text-gray-900 transition-colors">CGT Rates 2025-26</Link></li>
              <li><Link href="/guide/sa108-how-to-fill-in" className="text-gray-500 hover:text-gray-900 transition-colors">How to Fill in SA108</Link></li>
            </ul>
          </div>

          {/* Free Tools */}
          <div>
            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Free Tools</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/tools/bed-and-breakfast-calculator" className="text-gray-500 hover:text-gray-900 transition-colors">B&amp;B Rule Calculator</Link></li>
              <li><Link href="/tools/section-104-calculator" className="text-gray-500 hover:text-gray-900 transition-colors">Section 104 Calculator</Link></li>
              <li><Link href="/tools/cgt-allowance-checker" className="text-gray-500 hover:text-gray-900 transition-colors">CGT Allowance Checker</Link></li>
            </ul>
            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mt-6 mb-4">Brokers</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/guide/trading-212-cgt" className="text-gray-500 hover:text-gray-900 transition-colors">Trading 212 CGT</Link></li>
              <li><Link href="/guide/hargreaves-lansdown-cgt" className="text-gray-500 hover:text-gray-900 transition-colors">Hargreaves Lansdown CGT</Link></li>
              <li><Link href="/guide/freetrade-cgt" className="text-gray-500 hover:text-gray-900 transition-colors">Freetrade CGT</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Company</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/pricing" className="text-gray-500 hover:text-gray-900 transition-colors">Pricing</Link></li>
              <li><Link href="/contact" className="text-gray-500 hover:text-gray-900 transition-colors">Contact Us</Link></li>
              <li><Link href="/login" className="text-gray-500 hover:text-gray-900 transition-colors">Log In</Link></li>
              <li><Link href="/signup" className="text-gray-500 hover:text-gray-900 transition-colors">Start Free Trial</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-gray-400 text-xs">&copy; {new Date().getFullYear()} CGT Tracker. Data provided for guidance only. Consult a qualified tax advisor.</p>
          <p className="text-gray-400 text-xs">Built for UK self-directed investors</p>
        </div>
      </div>
    </footer>
  )
}
