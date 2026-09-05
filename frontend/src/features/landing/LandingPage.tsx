import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Zap,
  Package,
  ShieldCheck,
  Shield,
  Layers,
  Lock,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [logoError, setLogoError] = useState(false);
  const [footerLogoError, setFooterLogoError] = useState(false);

  const logoUrl =
    'https://lh3.googleusercontent.com/aida/AEtjO1XFPdfQa2aBc4NtynrmT-LMYFZoefvm0pJCGk3BGoQ_AdtKbBAsGbW6SG78UI5b9ulaJEa7aU5junkLpAGtj8X7m12nUs2Q_ZW_sg5yx1ON_Aeo4vU9nVauqJIYF-9UECgzJapye1bgPHaUNZfPgGxa-8bRXrtPIwX0mpZSq_dD9kxprPHgR089wo0BwyO-UHP0IQDjWlPHieunNIetcaZANJqa54P5lN55OORu9eiAwryiOPZUhIovGwRz';

  return (
    <div className="bg-[#fafbfc] text-slate-900 antialiased selection:bg-blue-100 selection:text-blue-700 min-h-screen font-sans">
      {/* ==================== HEADER NAVIGATION ==================== */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link className="flex items-center gap-2 transition hover:opacity-90" to="/">
            {!logoError ? (
              <img
                alt="DealFlow360"
                className="h-8 w-auto object-contain"
                src={logoUrl}
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="flex items-center gap-2 font-bold text-slate-900 text-lg tracking-tight">
                <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
                  <Layers size={18} />
                </span>
                <span>
                  DealFlow<span className="text-blue-600 font-extrabold">360</span>
                </span>
              </div>
            )}
          </Link>

          {/* Clean Navigation Links */}
          <nav className="hidden md:flex items-center gap-8">
            <a className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors" href="#features">
              Features
            </a>
            <a className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors" href="#how-it-works">
              How It Works
            </a>
            <a className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors" href="#solutions">
              Solutions
            </a>
          </nav>

          {/* Auth CTAs */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow transition-all inline-flex items-center gap-1.5"
                to="/dashboard"
              >
                Go to Workspace
                <ArrowRight size={15} />
              </Link>
            ) : (
              <>
                <Link
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-950 hover:bg-slate-100/70 rounded-lg transition-colors"
                  to="/login"
                >
                  Log In
                </Link>
                <Link
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow transition-all inline-flex items-center gap-1"
                  to="/login"
                >
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ==================== HERO SECTION ==================== */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">
        {/* Subtle gradient backdrop */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(37,99,235,0.08),rgba(255,255,255,0))]"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left: Copy & Actions */}
            <div className="lg:col-span-7 flex flex-col items-start text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold mb-6">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                Next-Generation RevOps &amp; CPQ
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1] mb-6">
                Smarter Quote-to-Cash. <br className="hidden sm:inline" />
                <span className="text-blue-600">Zero Revenue Leakage.</span>
              </h1>

              <p className="text-lg text-slate-600 max-w-xl font-normal leading-relaxed mb-8">
                DealFlow360 automates approvals, prevents margin erosion, and coordinates fulfillment across your sales operations.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <Link
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 text-white font-medium shadow-sm hover:bg-blue-700 hover:shadow-md transition-all text-sm group"
                  to="/login"
                >
                  Start Free Trial
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>

                <Link
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 hover:border-slate-300 transition-all text-sm"
                  to="/login"
                >
                  Sign In
                </Link>
              </div>

              {/* Social Proof micro-strip */}
              <div className="mt-10 pt-8 border-t border-slate-200/80 flex items-center gap-6 text-xs text-slate-500 font-medium">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>14-Day Trial</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>No Credit Card</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Instant Setup</span>
                </div>
              </div>
            </div>

            {/* Right: Sleek, Polished, Minimalist UI Preview Card */}
            <div className="lg:col-span-5 w-full">
              <div className="relative mx-auto max-w-md w-full">
                {/* Glow card */}
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-2xl blur-xl opacity-70 pointer-events-none"></div>

                <div className="relative bg-white rounded-2xl border border-slate-200/90 shadow-xl overflow-hidden">
                  {/* Card Top Header */}
                  <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                      <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                        Quote #Q-9402
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Approved
                    </span>
                  </div>

                  <div className="p-6 space-y-5">
                    {/* Customer Overview */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs font-medium text-slate-400">Customer</div>
                        <div className="text-base font-semibold text-slate-900 mt-0.5">Zenith Global Corp</div>
                        <div className="text-xs text-slate-500 mt-0.5">Enterprise Cloud Tier</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-medium text-slate-400">Total Value</div>
                        <div className="text-lg font-bold text-slate-900 mt-0.5">$220,800</div>
                        <div className="text-xs text-slate-500 mt-0.5">Net-30 Terms</div>
                      </div>
                    </div>

                    {/* Minimal Metrics Row */}
                    <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <div className="text-xs text-slate-500 font-medium">Blended Margin</div>
                        <div className="text-xl font-bold text-slate-900 mt-0.5">32.4%</div>
                        <div className="text-[11px] text-emerald-600 font-medium mt-0.5 flex items-center gap-0.5">
                          <TrendingUp size={13} />
                          +4.2% over target
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 font-medium">Validation Status</div>
                        <div className="text-sm font-semibold text-slate-900 mt-1 flex items-center gap-1">
                          <Zap size={15} className="text-blue-600 fill-blue-600" />
                          Auto-Approved
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">Policy Tier 1 Verified</div>
                      </div>
                    </div>

                    {/* Warehouse Allocation Preview */}
                    <div>
                      <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-2">
                        <span>Fulfillment Split</span>
                        <span className="text-slate-400">2 Regional Hubs</span>
                      </div>
                      <div className="space-y-2">
                        <div className="p-2.5 rounded-lg border border-slate-100 bg-white flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <Package size={14} className="text-blue-600" />
                            <span className="font-medium text-slate-800">North Hub (140 units)</span>
                          </div>
                          <span className="font-semibold text-slate-700">70%</span>
                        </div>
                        <div className="p-2.5 rounded-lg border border-slate-100 bg-white flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <Package size={14} className="text-cyan-600" />
                            <span className="font-medium text-slate-800">West Hub (60 units)</span>
                          </div>
                          <span className="font-semibold text-slate-700">30%</span>
                        </div>
                      </div>
                    </div>

                    {/* Audit Hash Indicator */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <div className="flex items-center gap-1">
                        <ShieldCheck size={14} className="text-emerald-600" />
                        <span>Audit Hash Verified</span>
                      </div>
                      <span className="font-mono text-slate-400">#8f92a10d</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== CORE FEATURES SECTION ==================== */}
      <section className="py-20 bg-white border-y border-slate-100" id="features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">Platform Capabilities</h2>
            <p className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              Everything required to safeguard your deal margins.
            </p>
            <p className="text-base text-slate-600 mt-4 leading-relaxed">
              Clean, purpose-built tools that streamline quotation workflows and protect company bottom-line profitability.
            </p>
          </div>

          {/* 4 Core Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl border border-slate-200/80 bg-[#fafbfc] hover:bg-white hover:shadow-lg hover:border-slate-300 transition-all duration-200 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                  <Shield size={24} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Smart Margin Protection</h3>
                <p className="text-sm text-slate-600 leading-relaxed font-normal">
                  Prevent unauthorized discounting automatically with intelligent approval policies tailored to account tiers.
                </p>
              </div>
              <a
                href="#solutions"
                className="mt-6 pt-4 border-t border-slate-100 flex items-center text-xs font-semibold text-blue-600 group-hover:gap-1.5 transition-all"
              >
                <span>Learn more</span>
                <ChevronRight size={14} />
              </a>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl border border-slate-200/80 bg-[#fafbfc] hover:bg-white hover:shadow-lg hover:border-slate-300 transition-all duration-200 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                  <Zap size={24} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Instant Automated Approvals</h3>
                <p className="text-sm text-slate-600 leading-relaxed font-normal">
                  Fast-track low-risk deals through self-governing workflows so your revenue teams never wait on routine signoffs.
                </p>
              </div>
              <a
                href="#solutions"
                className="mt-6 pt-4 border-t border-slate-100 flex items-center text-xs font-semibold text-emerald-600 group-hover:gap-1.5 transition-all"
              >
                <span>Learn more</span>
                <ChevronRight size={14} />
              </a>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl border border-slate-200/80 bg-[#fafbfc] hover:bg-white hover:shadow-lg hover:border-slate-300 transition-all duration-200 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-cyan-50 border border-cyan-100 text-cyan-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                  <RefreshCw size={24} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Unified Inventory &amp; Billing</h3>
                <p className="text-sm text-slate-600 leading-relaxed font-normal">
                  Seamlessly connect quotes to regional warehouse fulfillment allocations and recurring invoice schedules.
                </p>
              </div>
              <a
                href="#solutions"
                className="mt-6 pt-4 border-t border-slate-100 flex items-center text-xs font-semibold text-cyan-600 group-hover:gap-1.5 transition-all"
              >
                <span>Learn more</span>
                <ChevronRight size={14} />
              </a>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl border border-slate-200/80 bg-[#fafbfc] hover:bg-white hover:shadow-lg hover:border-slate-300 transition-all duration-200 flex flex-col justify-between group">
              <div>
                <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                  <Lock size={24} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Cryptographic Audit Trail</h3>
                <p className="text-sm text-slate-600 leading-relaxed font-normal">
                  Every signed contract is tamper-proof and cryptographically verified from original quote to final cash settlement.
                </p>
              </div>
              <a
                href="#solutions"
                className="mt-6 pt-4 border-t border-slate-100 flex items-center text-xs font-semibold text-purple-600 group-hover:gap-1.5 transition-all"
              >
                <span>Learn more</span>
                <ChevronRight size={14} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== HOW IT WORKS TIMELINE ==================== */}
      <section className="py-20 bg-[#fafbfc]" id="how-it-works">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">Simple Workflow</h2>
            <p className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              How DealFlow360 Works
            </p>
            <p className="text-base text-slate-600 mt-3">
              A seamless three-step cycle designed to accelerate closure without friction.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-sm relative flex flex-col">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm mb-6 shadow-sm">
                1
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Draft &amp; Price</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Sales teams configure proposals with live margin feedback, customer discount allowances, and recommended accessories.
              </p>
              <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400 font-medium">
                Real-time margin visibility
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-sm relative flex flex-col">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm mb-6 shadow-sm">
                2
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Auto-Validate</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                The platform scores deal risk instantly. In-policy deals are automatically approved while exceptions route to managers.
              </p>
              <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400 font-medium">
                Sub-second SLA resolution
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-sm relative flex flex-col">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm mb-6 shadow-sm">
                3
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Close &amp; Fulfill</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Clients review and sign via secure magic links. Stock partitions to regional hubs and billing synchronizes instantly.
              </p>
              <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400 font-medium">
                Zero fulfillment blindspots
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== SOLUTIONS / INTERACTIVE DEMO SANDBOX ==================== */}
      <section className="py-20 bg-white border-t border-slate-100" id="solutions">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">Enterprise Solutions</h2>
            <p className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              Role-Based Operational Workspaces
            </p>
            <p className="text-base text-slate-600 mt-3 leading-relaxed">
              Purpose-built environments tailored to each stakeholder across the quote-to-cash lifecycle.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              {
                role: 'Administrator',
                title: 'RevOps Architect',
                badge: 'Full Access',
                desc: 'Manage policy tiers, global inventory, and system audit logs.'
              },
              {
                role: 'Account Exec',
                title: 'Sales Representative',
                badge: 'CPQ & Quotes',
                desc: 'Configure multi-tier quotations, bundle add-ons, and track approvals.'
              },
              {
                role: 'Sales Manager',
                title: 'Regional Director',
                badge: 'Approval Authority',
                desc: 'Review high-discount exceptions and accelerate deal turnaround.'
              },
              {
                role: 'VP Finance',
                title: 'Financial Controller',
                badge: 'Ledger & Margin',
                desc: 'Govern 15%+ risk overrides, credit terms, and cash collection.'
              },
              {
                role: 'Warehouse Lead',
                title: 'Supply Chain Ops',
                badge: 'Hub Routing',
                desc: 'Manage multi-location stock allocations and delivery dispatches.'
              }
            ].map((persona) => (
              <div
                key={persona.role}
                className="p-5 rounded-2xl border border-slate-200/80 bg-[#fafbfc] hover:bg-white hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      {persona.badge}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-base">{persona.role}</h4>
                  <div className="text-xs font-medium text-slate-500 mb-2.5">{persona.title}</div>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">{persona.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== MINIMALIST CTA BANNER ==================== */}
      <section className="py-20 bg-white" id="signup">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-b from-blue-600 to-blue-700 p-10 sm:p-14 text-center text-white shadow-xl relative overflow-hidden">
            {/* Ambient circle */}
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4 text-white">
              Ready to streamline your sales operations?
            </h2>

            <p className="text-blue-100 max-w-xl mx-auto text-base sm:text-lg mb-8 leading-relaxed">
              Join high-growth revenue organizations using DealFlow360 to eliminate margin leakage and accelerate deal velocity.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl !bg-white hover:!bg-blue-50 transition-all shadow-md inline-flex items-center justify-center font-bold text-sm"
                style={{ backgroundColor: '#ffffff', color: '#004ac6' }}
                to="/login"
              >
                <span style={{ color: '#004ac6' }} className="font-bold text-blue-700">
                  Get Started Free
                </span>
              </Link>
              <Link
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl !bg-blue-700/90 border border-blue-400/40 text-white font-semibold text-sm hover:!bg-blue-800 transition-all inline-flex items-center justify-center shadow-sm"
                style={{ color: '#ffffff' }}
                to="/login"
              >
                Sign In to Account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== CLEAN PROFESSIONAL FOOTER ==================== */}
      <footer className="bg-white border-t border-slate-200/80 text-slate-600 text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo & Brand statement */}
            <div className="flex items-center gap-3">
              {!footerLogoError ? (
                <img
                  alt="DealFlow360"
                  className="h-7 w-auto object-contain"
                  src={logoUrl}
                  onError={() => setFooterLogoError(true)}
                />
              ) : (
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm tracking-tight">
                  <span className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white">
                    <Layers size={14} />
                  </span>
                  <span>DealFlow360</span>
                </div>
              )}
              <span className="text-xs text-slate-400">| Quote-to-Cash Automation Platform</span>
            </div>

            {/* Links */}
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <a className="hover:text-slate-900 transition-colors" href="#features">
                Features
              </a>
              <a className="hover:text-slate-900 transition-colors" href="#how-it-works">
                How It Works
              </a>
              <Link className="hover:text-slate-900 transition-colors" to="/login">
                Log In
              </Link>
              <Link className="text-blue-600 font-semibold hover:text-blue-700 transition-colors" to="/login">
                Sign Up
              </Link>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
            <div>© 2025 DealFlow360 Systems, Inc. All rights reserved.</div>
            <div className="flex items-center gap-6">
              <a className="hover:text-slate-600 transition-colors" href="#privacy">
                Privacy Policy
              </a>
              <a className="hover:text-slate-600 transition-colors" href="#terms">
                Terms of Service
              </a>
              <a className="hover:text-slate-600 transition-colors" href="#security">
                Security
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
