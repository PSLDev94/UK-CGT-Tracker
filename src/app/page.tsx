import Link from 'next/link'
import { ArrowRight, CheckCircle, Upload, Calculator, FileText, BookOpen, Shield, Zap, TrendingUp, PieChart, BarChart3, AlertCircle } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 selection:bg-blue-100 selection:text-blue-900">
      {/* Navigation */}
      <nav className="border-b sticky top-0 bg-white/80 backdrop-blur-md z-50 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="bg-blue-600 p-1.5 rounded-lg shadow-sm shadow-blue-200">
                <PieChart className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="text-xl font-bold tracking-tight text-gray-900">
                CGT<span className="text-blue-600">Tracker</span>
              </div>
            </div>

            <div className="flex gap-1 sm:gap-4 items-center">
              <Link href="/guide" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 hidden sm:inline transition-colors">
                CGT Guide
              </Link>
              <Link href="/pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 hidden sm:inline transition-colors">
                Pricing
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

      {/* Premium Hero Section */}
      <section className="relative pt-24 pb-32 overflow-hidden px-4">
        {/* Background Gradients */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-white to-white"></div>
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[600px] opacity-20 bg-gradient-to-br from-blue-200 to-indigo-100 blur-[100px] rounded-full mix-blend-multiply pointer-events-none"></div>
        <div className="absolute top-40 left-0 -translate-x-1/2 w-[600px] h-[600px] opacity-20 bg-gradient-to-tr from-cyan-100 to-blue-200 blur-[100px] rounded-full mix-blend-multiply pointer-events-none"></div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-1.5 rounded-full text-sm font-medium mb-8 shadow-sm">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Built strictly for UK self-directed investors
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 tracking-tight mb-8 max-w-4xl mx-auto leading-[1.1]">
            Calculate your Capital Gains Tax in <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">minutes</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Stop fighting with spreadsheets. Upload your broker CSV and instantly apply HMRC's strict matching rules to prepare your self-assessment.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-6 mb-6">
            <Link href="/signup" className="group bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-blue-700 transition-all flex items-center justify-center shadow-xl shadow-blue-600/20 hover:shadow-blue-600/30">
              Start your free trial 
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="#preview" className="bg-white border border-gray-300 text-gray-700 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-gray-50 transition-all flex items-center justify-center shadow-sm">
              See how it works
            </Link>
          </div>
          
          <p className="text-sm text-gray-500 font-medium">14-day free trial. No credit card required.</p>
        </div>

        {/* Mock Dashboard UI Preview */}
        <div id="preview" className="mt-20 max-w-5xl mx-auto relative z-20 group perspective-1000">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-600/10 to-transparent rounded-2xl blur-xl scale-105 opacity-50 z-0"></div>
          
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden relative z-10 ring-1 ring-black/5 transform transition-transform duration-500 hover:scale-[1.01]">
            {/* Mac-style Window header */}
            <div className="bg-gray-50 border-b px-6 py-4 flex justify-between items-center">
              <div className="flex space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <div className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Tax Year 2024-25 Overview
              </div>
              <div className="w-10"></div> {/* Spacer for symmetry */}
            </div>

            {/* Dashboard Content */}
            <div className="p-8">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
                <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:border-gray-200 transition-colors">
                  <div className="text-sm text-gray-500 mb-1 font-medium">Total Gains</div>
                  <div className="text-2xl font-bold text-green-600">£14,250.00</div>
                </div>
                <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:border-gray-200 transition-colors">
                  <div className="text-sm text-gray-500 mb-1 font-medium">Total Losses</div>
                  <div className="text-2xl font-bold text-red-600">£2,100.00</div>
                </div>
                <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:border-gray-200 transition-colors">
                  <div className="text-sm text-gray-500 mb-1 font-medium">Exemption Used</div>
                  <div className="text-2xl font-bold text-gray-900">£3,000.00</div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mt-3 overflow-hidden">
                    <div className="bg-blue-600 h-2 rounded-full w-full"></div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5 shadow-sm">
                  <div className="text-sm text-blue-800 font-semibold mb-1">Taxable Gain</div>
                  <div className="text-2xl font-extrabold text-blue-900">£9,150.00</div>
                </div>
              </div>

              {/* Transactions Table */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  Matched Disposals
                </h4>
                <div className="overflow-x-auto rounded-lg border border-gray-100 shadow-sm">
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3.5 font-medium">Date</th>
                        <th className="px-4 py-3.5 font-medium">Asset</th>
                        <th className="px-4 py-3.5 font-medium text-right">Proceeds</th>
                        <th className="px-4 py-3.5 font-medium text-right">Allowable Cost</th>
                        <th className="px-4 py-3.5 font-medium text-right">Gain/Loss</th>
                        <th className="px-4 py-3.5 font-medium">Matching Rule</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 bg-white">
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-4 text-gray-600">15 Oct 2024</td>
                        <td className="px-4 py-4 font-semibold text-gray-900">AAPL</td>
                        <td className="px-4 py-4 text-right">£8,500.00</td>
                        <td className="px-4 py-4 text-right text-gray-500">£6,200.00</td>
                        <td className="px-4 py-4 text-right text-green-600 font-bold">+£2,300.00</td>
                        <td className="px-4 py-4"><span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md text-xs font-medium border border-gray-200">Section 104 Pool</span></td>
                      </tr>
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-4 text-gray-600">02 Nov 2024</td>
                        <td className="px-4 py-4 font-semibold text-gray-900">TSLA</td>
                        <td className="px-4 py-4 text-right">£4,100.00</td>
                        <td className="px-4 py-4 text-right text-gray-500">£4,600.00</td>
                        <td className="px-4 py-4 text-right text-red-600 font-bold">-£500.00</td>
                        <td className="px-4 py-4"><span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-medium border border-blue-100">Bed & Breakfast</span></td>
                      </tr>
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-4 text-gray-600">10 Mar 2025</td>
                        <td className="px-4 py-4 font-semibold text-gray-900">LLOY</td>
                        <td className="px-4 py-4 text-right">£1,200.00</td>
                        <td className="px-4 py-4 text-right text-gray-500">£1,150.00</td>
                        <td className="px-4 py-4 text-right text-green-600 font-bold">+£50.00</td>
                        <td className="px-4 py-4"><span className="bg-purple-50 text-purple-700 px-2.5 py-1 rounded-md text-xs font-medium border border-purple-100">Same-Day Rule</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-white px-4 border-t border-gray-100">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Everything you need to report with confidence</h2>
            <p className="text-lg text-gray-600">We've built all the edge cases and strict HMRC parameters into the software so you never have to think about them.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 px-2">
            <div className="bg-gray-50 p-8 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-xl hover:shadow-blue-900/5 transition-all duration-300 relative group overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform translate-x-4 -translate-y-4">
                <Calculator className="w-32 h-32" />
              </div>
              <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center mb-6 shadow-sm border border-gray-100 relative z-10">
                <Calculator className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900 relative z-10">Flawless HMRC Accuracy</h3>
              <p className="text-gray-600 leading-relaxed relative z-10">Automatically applies the complex HMRC share matching algorithm — first Same-Day rule, then 30-Day Bed & Breakfast, and finally Section 104 pools — strictly in order.</p>
            </div>
            
            <div className="bg-gray-50 p-8 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-xl hover:shadow-green-900/5 transition-all duration-300 relative group overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform translate-x-4 -translate-y-4">
                <TrendingUp className="w-32 h-32" />
              </div>
              <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center mb-6 shadow-sm border border-gray-100 relative z-10">
                <TrendingUp className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900 relative z-10">Tax-Loss Harvesting</h3>
              <p className="text-gray-600 leading-relaxed relative z-10">See real-time opportunities to offset gains by safely selling losing positions before the April 5th tax year deadline. Know exactly how much tax you could save.</p>
            </div>
            
            <div className="bg-gray-50 p-8 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-xl hover:shadow-indigo-900/5 transition-all duration-300 relative group overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform translate-x-4 -translate-y-4">
                <FileText className="w-32 h-32" />
              </div>
              <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center mb-6 shadow-sm border border-gray-100 relative z-10">
                <FileText className="w-7 h-7 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900 relative z-10">Ready for SA108</h3>
              <p className="text-gray-600 leading-relaxed relative z-10">Download stunning PDF reports outlining your net position with the exact figures you need to copy into your HMRC Self Assessment form.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-4 bg-slate-900 text-white relative overflow-hidden">
         {/* Background flares */}
         <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-blue-500/20 blur-[120px] rounded-full mix-blend-screen pointer-events-none"></div>
         <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-purple-500/20 blur-[100px] rounded-full mix-blend-screen pointer-events-none"></div>

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">From CSV to PDF in three simple steps</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-12 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-blue-500/0 via-blue-500/50 to-blue-500/0"></div>
            
            <div className="text-center relative">
              <div className="w-24 h-24 bg-slate-800 border border-slate-700 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl relative z-10">
                <Upload className="w-10 h-10" />
                <div className="absolute -top-3 -right-3 w-8 h-8 bg-blue-600 text-white font-bold rounded-full flex items-center justify-center border-4 border-slate-900">1</div>
              </div>
              <h3 className="font-bold text-xl mb-3">Upload your statements</h3>
              <p className="text-slate-400 leading-relaxed">Export your transaction history from Trading 212, Freetrade, HL, or any UK broker and simply drop it in.</p>
            </div>
            
            <div className="text-center relative">
              <div className="w-24 h-24 bg-slate-800 border border-slate-700 text-purple-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl relative z-10">
                <Zap className="w-10 h-10" />
                <div className="absolute -top-3 -right-3 w-8 h-8 bg-purple-600 text-white font-bold rounded-full flex items-center justify-center border-4 border-slate-900">2</div>
              </div>
              <h3 className="font-bold text-xl mb-3">System Detection</h3>
              <p className="text-slate-400 leading-relaxed">Our system automatically parses your broker's CSV format and cross-matches transactions intelligently.</p>
            </div>
            
            <div className="text-center relative">
              <div className="w-24 h-24 bg-slate-800 border border-slate-700 text-green-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl relative z-10">
                <CheckCircle className="w-10 h-10" />
                <div className="absolute -top-3 -right-3 w-8 h-8 bg-green-600 text-white font-bold rounded-full flex items-center justify-center border-4 border-slate-900">3</div>
              </div>
              <h3 className="font-bold text-xl mb-3">Get your forms</h3>
              <p className="text-slate-400 leading-relaxed">Instantly receive a clear dashboard breakdown and your downloadable report, ready for HMRC submission.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust / Security */}
      <section className="py-20 bg-gray-50 px-4 border-b border-gray-200">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-white border border-gray-200 rounded-full flex items-center justify-center mb-6 shadow-sm">
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Bank-level data security</h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg leading-relaxed">
            We never store your raw CSV files — they're processed in memory and immediately discarded. All data is securely encrypted in transit and at rest. We never sell your financial data.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-4 bg-white" id="pricing">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-extrabold mb-6 text-gray-900">Simple, transparent pricing</h2>
          <p className="text-xl text-gray-600 mb-12 max-w-xl mx-auto">Stop paying an accountant £300+ a year just to calculate your gains.</p>
          
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 p-8 sm:p-10 max-w-md mx-auto relative overflow-hidden">
            {/* Decoration */}
            <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            
            <div className="flex justify-center items-center gap-2 mb-2">
              <span className="text-gray-500 font-semibold uppercase tracking-wider text-sm">Annual Plan</span>
            </div>
            <div className="text-6xl font-extrabold text-gray-900 mb-2">£49<span className="text-2xl text-gray-500 font-medium">/year</span></div>
            <p className="text-sm text-gray-500 mb-8 pb-8 border-b border-gray-100">Cancel anytime. Try it free for 14 days.</p>
            
            <ul className="text-left space-y-4 mb-10">
              <li className="flex items-start">
                <CheckCircle className="w-6 h-6 text-green-500 mr-3 flex-shrink-0" /> 
                <span className="text-gray-700">Unlimited transactions</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-6 h-6 text-green-500 mr-3 flex-shrink-0" /> 
                <span className="text-gray-700">All UK brokers supported via universal CSV</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-6 h-6 text-green-500 mr-3 flex-shrink-0" /> 
                <span className="text-gray-700">Automated smart CSV mapping</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-6 h-6 text-green-500 mr-3 flex-shrink-0" /> 
                <span className="text-gray-700">Tax-loss harvesting alert system</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-6 h-6 text-green-500 mr-3 flex-shrink-0" /> 
                <span className="text-gray-700 font-medium">Full SA108 PDF Export</span>
              </li>
            </ul>
            <Link href="/signup" className="block w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 text-center text-lg transition-colors ring-2 ring-transparent ring-offset-2 hover:ring-blue-600 active:scale-95">
              Start your free trial
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 bg-gray-50 px-4 border-t border-gray-200" id="faq">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-extrabold text-center mb-12 text-gray-900">Frequently asked questions</h2>
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-3">How accurate are the calculations?</h3>
              <p className="text-gray-600 leading-relaxed">
                Our engine implements all three HMRC matching rules (same-day, 30-day bed & breakfast, and Section 104 pool) in the strict sequential order required by HMRC. We use highly precise decimal arithmetic to avoid float rounding errors. That said, this tool provides computation for your guidance — we always recommend verifying figures with a qualified tax advisor if you possess complex assets.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Is my data secure?</h3>
              <p className="text-gray-600 leading-relaxed">
                Yes. Raw CSV files are processed completely in memory and never stored permanently on our servers. All finalised transaction data is protected with row-level security — prohibiting anyone but you from accessing it.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Which brokers are supported?</h3>
              <p className="text-gray-600 leading-relaxed">
                Our smart parser can automatically format unstructured data from virtually any UK broker CSV export, including Trading 212, Freetrade, Hargreaves Lansdown, Interactive Investor, AJ Bell, and more. If your broker exports a CSV with transaction details, our engine will recognise it.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-3">What happens if I have capital losses?</h3>
              <p className="text-gray-600 leading-relaxed">
                Losses are natively offset against your gains for the current tax year. If your total losses exceed your allowable gains, the remaining negative balance is clearly separated so you can report them to HMRC and carry them forward to safeguard future wealth.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Does it cover cryptocurrency?</h3>
              <p className="text-gray-600 leading-relaxed">
                Not currently. The platform specifically handles complex equity, stocks, and ETFs. Crypto assets have differing HMRC rules (including upcoming DeFi protocol rulings), so we plan to separate out crypto support in a future module.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-blue-600 text-white text-center px-4 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
        
        <div className="max-w-3xl mx-auto relative z-10">
          <h2 className="text-4xl font-extrabold mb-6 tracking-tight">Ready to take control of your CGT?</h2>
          <p className="text-blue-100 mb-10 text-xl font-medium max-w-2xl mx-auto">Upload your first CSV and instantly generate your exact tax position in under 2 minutes.</p>
          <Link href="/signup" className="inline-flex items-center bg-white text-blue-600 px-10 py-4 rounded-xl text-xl font-bold hover:bg-blue-50 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-blue-900/30">
            Start free trial <ArrowRight className="ml-3 w-6 h-6" />
          </Link>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="border-t py-12 text-center bg-white">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-gray-900">CGTTracker</span>
          </div>
          <p className="text-gray-500 text-sm">&copy; {new Date().getFullYear()} CGT Tracker. Data provided for guidance. Consult a qualified advisor.</p>
          <div className="flex gap-6 text-sm font-medium">
            <Link href="/guide" className="text-gray-500 hover:text-gray-900 transition-colors">Tax Guide</Link>
            <Link href="/pricing" className="text-gray-500 hover:text-gray-900 transition-colors">Pricing</Link>
            <Link href="/login" className="text-gray-500 hover:text-gray-900 transition-colors">Log in</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
