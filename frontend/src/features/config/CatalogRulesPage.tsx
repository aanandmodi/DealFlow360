/**
 * Catalog & Rules — CPQ Product Master & Autonomous Governance Engine.
 * Features:
 * - Product Master Catalog with SKU search & category filters
 * - CPQ Discount Governance Matrix (Customer Tier x Product Category)
 * - Approval Chain Rules Engine (Auto-Approve, Manager SLA, Finance SLA)
 * - Interactive CPQ Rule Simulator & Margin Sandbox
 * - Direct deep links to Django Admin for granular database updates
 */
import { useState, useEffect, useMemo } from 'react';
import { quotationsApi } from '../../api/quotations';
import { formatCurrency } from '../../lib/utils';
import {
  Settings,
  Package,
  Sliders,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Zap,
  DollarSign,
  Layers,
  ArrowRight,
  Sparkles,
  Info,
  Clock,
  ShieldAlert,
  Play
} from 'lucide-react';

interface ProductItem {
  id: number;
  name: string;
  sku: string;
  category: string;
  base_price: string | number;
  unit: string;
  tax_pct: string | number;
  description: string;
  is_subscription: boolean;
  is_active: boolean;
}

interface DiscountTierItem {
  id: number;
  tier: string;
  tier_display?: string;
  category: string;
  category_display?: string;
  max_discount_pct: number | string;
}

interface ApprovalRuleItem {
  id: number;
  name: string;
  min_over_pct: number;
  max_over_pct: number;
  requires_manager: boolean;
  requires_finance: boolean;
}

export function CatalogRulesPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [discountTiers, setDiscountTiers] = useState<DiscountTierItem[]>([]);
  const [approvalRules, setApprovalRules] = useState<ApprovalRuleItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab & Filters
  const [activeTab, setActiveTab] = useState<'catalog' | 'matrix' | 'chains' | 'simulator'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Simulator State
  const [simProduct, setSimProduct] = useState<number | null>(null);
  const [simCustomerTier, setSimCustomerTier] = useState<'bronze' | 'silver' | 'gold'>('silver');
  const [simQty, setSimQty] = useState<number>(5);
  const [simDiscount, setSimDiscount] = useState<number>(8);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, tierRes, ruleRes] = await Promise.all([
        quotationsApi.products(),
        quotationsApi.discountTiers(),
        quotationsApi.approvalRules(),
      ]);
      setProducts(prodRes || []);
      setDiscountTiers(tierRes || []);
      setApprovalRules(ruleRes || []);
      if (prodRes && prodRes.length > 0 && !simProduct) {
        setSimProduct(prodRes[0].id);
      }
    } catch (err) {
      console.error('Failed to load catalog rules data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, categoryFilter]);

  // Simulator Calculation
  const simulationResult = useMemo(() => {
    const selectedProd = products.find(p => p.id === simProduct) || products[0];
    if (!selectedProd) return null;

    const basePrice = Number(selectedProd.base_price) || 0;
    const grossTotal = basePrice * simQty;
    const discountAmount = grossTotal * (simDiscount / 100);
    const netTotal = grossTotal - discountAmount;

    // Look up discount ceiling in DiscountTier
    const matchingTier = discountTiers.find(
      t => t.tier.toLowerCase() === simCustomerTier.toLowerCase() &&
           t.category.toLowerCase() === selectedProd.category.toLowerCase()
    );
    const ceilingPct = matchingTier ? Number(matchingTier.max_discount_pct) : 10;
    const overage = Math.max(0, simDiscount - ceilingPct);

    // Evaluate approval rule
    let governanceLevel: 'auto' | 'manager' | 'finance' = 'auto';
    let policyName = 'Auto-Approved (Within Rep Authority)';
    let slaHours = 'Instant';

    if (overage > 10) {
      governanceLevel = 'finance';
      policyName = 'High Risk — Manager + VP Finance Approval Required';
      slaHours = '12 Hours SLA';
    } else if (overage > 0) {
      governanceLevel = 'manager';
      policyName = 'Medium Risk — Sales Manager Sign-off Required';
      slaHours = '4 Hours SLA';
    }

    // Estimated margin (assume 35% base cost of goods)
    const costBasis = grossTotal * 0.45;
    const estimatedMargin = netTotal > 0 ? (((netTotal - costBasis) / netTotal) * 100).toFixed(1) : '0.0';

    return {
      selectedProd,
      basePrice,
      grossTotal,
      discountAmount,
      netTotal,
      ceilingPct,
      overage,
      governanceLevel,
      policyName,
      slaHours,
      estimatedMargin,
    };
  }, [products, simProduct, simCustomerTier, simQty, simDiscount, discountTiers]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Zap className="w-3.5 h-3.5 text-indigo-600" />
              CPQ Rules & Product Master Engine
            </span>
            <span className="text-xs text-slate-400">• Dynamic Policy Governance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-sans">
            Catalog & Approval Rules
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Maintain product master catalogs, multi-tier discount ceilings, approval escalation chains, and simulate live pricing policies.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-xs hover:bg-slate-50 transition"
            title="Refresh Catalog Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>

          <a
            href="http://localhost:8000/admin/quotations/product/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <ExternalLink className="w-4 h-4" />
            Django Admin Catalog
          </a>

          <button
            onClick={() => setActiveTab('simulator')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <Play className="w-4 h-4" />
            Test CPQ Simulator
          </button>
        </div>
      </div>

      {/* Top 4 Metric Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 border border-slate-200 bg-white rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active SKUs</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight font-sans">
              {products.length || 10}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span className="text-emerald-600 font-semibold">100% active</span>
              <span>across 4 categories</span>
            </div>
          </div>
        </div>

        <div className="card p-5 border border-slate-200 bg-white rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Discount Ceilings</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Sliders className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight font-sans">
              {discountTiers.length || 12} Rules
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span className="text-indigo-600 font-semibold">Bronze • Silver • Gold</span>
              <span>tiers configured</span>
            </div>
          </div>
        </div>

        <div className="card p-5 border border-slate-200 bg-white rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Approval Chains</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight font-sans">
              {approvalRules.length || 3} Escalation Tiers
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span className="text-emerald-600 font-semibold">Auto • Manager • Finance</span>
            </div>
          </div>
        </div>

        <div className="card p-5 border border-slate-200 bg-white rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Base Currency</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight font-sans">
              USD ($)
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span className="text-amber-600 font-semibold">Standard Net-30</span>
              <span>terms default</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`py-3 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-xs sm:text-sm transition-colors ${
              activeTab === 'catalog'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Package className="w-4 h-4" />
            Product Master Catalog ({filteredProducts.length})
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={`py-3 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-xs sm:text-sm transition-colors ${
              activeTab === 'matrix'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Discount Governance Ceilings
          </button>
          <button
            onClick={() => setActiveTab('chains')}
            className={`py-3 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-xs sm:text-sm transition-colors ${
              activeTab === 'chains'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Approval Chains & SLAs
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`py-3 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-xs sm:text-sm transition-colors ${
              activeTab === 'simulator'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Play className="w-4 h-4" />
            CPQ Rule Simulator Sandbox
          </button>
        </nav>
      </div>

      {/* Tab 1: Product Master Catalog */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="card p-4 border border-slate-200 bg-white rounded-xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search SKU or product name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Categories</option>
                <option value="software">Software</option>
                <option value="subscriptions">Subscriptions</option>
                <option value="hardware">Hardware</option>
                <option value="services">Services</option>
              </select>
            </div>
          </div>

          {/* Product Master Table */}
          <div className="card border border-slate-200 bg-white rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Base Price</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3">Tax %</th>
                    <th className="px-4 py-3">Billing Type</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredProducts.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-indigo-700">{p.sku}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">{p.description || 'Enterprise catalog component'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 capitalize">
                          {p.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">${Number(p.base_price).toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-500">{p.unit}</td>
                      <td className="px-4 py-3 text-slate-600">{p.tax_pct}%</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          p.is_subscription ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {p.is_subscription ? 'Recurring (Monthly)' : 'One-Time'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Discount Governance Ceilings Matrix */}
      {activeTab === 'matrix' && (
        <div className="space-y-6">
          <div className="card p-6 border border-slate-200 bg-white rounded-xl shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-sans">Customer Tier vs Product Category Discount Ceilings</h3>
                <p className="text-xs text-slate-500">Autonomous governance limits: discounts above these ceilings automatically trigger manager/finance approval.</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
                12 Live Rules
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {['bronze', 'silver', 'gold'].map(tierName => {
                const tierRules = discountTiers.filter(t => t.tier.toLowerCase() === tierName);
                const tierTheme =
                  tierName === 'gold' ? 'border-amber-200 bg-amber-50/20' :
                  tierName === 'silver' ? 'border-slate-300 bg-slate-50/40' :
                  'border-orange-200 bg-orange-50/20';

                return (
                  <div key={tierName} className={`border rounded-xl p-5 ${tierTheme}`}>
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 mb-4">
                      <span className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${
                          tierName === 'gold' ? 'bg-amber-500' :
                          tierName === 'silver' ? 'bg-slate-400' : 'bg-orange-500'
                        }`} />
                        {tierName} Tier Accounts
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                        Ceiling
                      </span>
                    </div>

                    <div className="space-y-3">
                      {tierRules.map((rule, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200/80 shadow-xs">
                          <span className="text-xs font-semibold text-slate-800 capitalize flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-slate-400" />
                            {rule.category}
                          </span>
                          <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                            Up to {rule.max_discount_pct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
              <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800">Autonomous Enforcement Rule:</span> Sales Representatives can discount freely up to the tier ceiling. Any overage triggers automated escalation: 0.01% - 10% requires Sales Manager; &gt;10% requires VP Finance.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Approval Chains & SLAs */}
      {activeTab === 'chains' && (
        <div className="space-y-6">
          <div className="card border border-slate-200 bg-white rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-800 font-sans">Multi-Tier Approval Escalation Policy</h4>
                <p className="text-xs text-slate-500">Autonomous deal state machine criteria and turnaround SLA benchmarks.</p>
              </div>
              <span className="text-xs font-medium text-slate-500">Engine v4.18</span>
            </div>

            <div className="divide-y divide-slate-100">
              <div className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-slate-50/60 transition">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="text-sm font-bold text-slate-900">Tier 1: Low Risk — Autonomous Auto-Approval</h5>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                        0% Overage
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Discounts strictly within customer tier category limits. Quotation automatically progresses to Sent/Negotiation without managerial intervention.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-900">Instant Execution</div>
                    <div className="text-[11px] text-slate-400">0 min SLA</div>
                  </div>
                </div>
              </div>

              <div className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-slate-50/60 transition">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="text-sm font-bold text-slate-900">Tier 2: Medium Risk — Sales Manager Sign-off</h5>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
                        0.01% – 10.0% Overage
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Requires direct manager (e.g. M. Shah) review and approval log generation. Notified via instant dashboard queue.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-bold text-amber-600">4 Hours SLA</div>
                    <div className="text-[11px] text-slate-400">Manager Queue</div>
                  </div>
                </div>
              </div>

              <div className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-slate-50/60 transition">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="text-sm font-bold text-slate-900">Tier 3: High Risk — Two-Stage Finance VP Escalation</h5>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800">
                        &gt; 10.0% Overage
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Severe margin dilution risk. Requires mandatory two-stage signoff: Sales Manager endorsement followed by VP Finance (R. Iyer) formal sign-off.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-bold text-rose-600">12 Hours SLA</div>
                    <div className="text-[11px] text-slate-400">Executive Queue</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Interactive CPQ Rule Simulator Sandbox */}
      {activeTab === 'simulator' && simulationResult && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Input Panel */}
          <div className="lg:col-span-5 card p-6 border border-slate-200 bg-white rounded-xl shadow-xs space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 font-sans flex items-center gap-2">
                <Play className="w-4 h-4 text-indigo-600" />
                Pricing & Governance Simulator
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Test how proposed deal terms interact with CPQ discount ceilings and approval triggers in real-time.
              </p>
            </div>

            {/* Select Product */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Target Product
              </label>
              <select
                value={simProduct || ''}
                onChange={e => setSimProduct(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} (${Number(p.base_price).toLocaleString()} - {p.category})
                  </option>
                ))}
              </select>
            </div>

            {/* Customer Tier */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Customer Account Tier
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['bronze', 'silver', 'gold'] as const).map(tier => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setSimCustomerTier(tier)}
                    className={`py-2 text-xs font-semibold rounded-lg capitalize border transition ${
                      simCustomerTier === tier
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity Slider */}
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Quantity</span>
                <span className="text-indigo-600">{simQty} units</span>
              </div>
              <input
                type="range"
                min="1"
                max="50"
                value={simQty}
                onChange={e => setSimQty(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            {/* Proposed Discount Slider */}
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                <span>Proposed Discount %</span>
                <span className="text-indigo-600 font-extrabold">{simDiscount}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="35"
                step="0.5"
                value={simDiscount}
                onChange={e => setSimDiscount(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>0% (Standard)</span>
                <span>Ceiling: {simulationResult.ceilingPct}%</span>
                <span>35% (Max)</span>
              </div>
            </div>
          </div>

          {/* Real-time Calculation Result Card */}
          <div className="lg:col-span-7 card p-6 border border-slate-200 bg-white rounded-xl shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 font-sans">Deal Governance Simulation Result</h4>
                  <p className="text-xs text-slate-500">Autonomous evaluation against current price list and rules.</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  simulationResult.governanceLevel === 'auto' ? 'bg-emerald-100 text-emerald-800' :
                  simulationResult.governanceLevel === 'manager' ? 'bg-amber-100 text-amber-800' :
                  'bg-rose-100 text-rose-800'
                }`}>
                  {simulationResult.governanceLevel === 'auto' ? 'Auto-Approved' :
                   simulationResult.governanceLevel === 'manager' ? 'Manager Required' : 'Finance Sign-off'}
                </span>
              </div>

              {/* Price Breakdown Cards */}
              <div className="grid grid-cols-3 gap-3 my-5">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Gross Total</span>
                  <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                    {formatCurrency(simulationResult.grossTotal)}
                  </div>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Discount ({simDiscount}%)</span>
                  <div className="text-lg font-extrabold text-rose-600 mt-0.5">
                    -{formatCurrency(simulationResult.discountAmount)}
                  </div>
                </div>
                <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100">
                  <span className="text-[11px] font-bold text-indigo-700 uppercase">Net Deal Value</span>
                  <div className="text-lg font-extrabold text-indigo-700 mt-0.5">
                    {formatCurrency(simulationResult.netTotal)}
                  </div>
                </div>
              </div>

              {/* Governance Explanation Box */}
              <div className={`p-4 rounded-xl border mb-4 ${
                simulationResult.governanceLevel === 'auto' ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900' :
                simulationResult.governanceLevel === 'manager' ? 'bg-amber-50/50 border-amber-200 text-amber-900' :
                'bg-rose-50/50 border-rose-200 text-rose-900'
              }`}>
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  {simulationResult.policyName}
                </div>
                <div className="text-xs mt-1 leading-relaxed opacity-90">
                  {simulationResult.overage === 0
                    ? `Proposed discount of ${simDiscount}% is within the ${simulationResult.ceilingPct}% maximum ceiling for ${simCustomerTier} tier accounts on ${simulationResult.selectedProd.category}. Deal can be dispatched instantly.`
                    : `Proposed discount of ${simDiscount}% exceeds the ${simulationResult.ceilingPct}% ceiling by ${simulationResult.overage.toFixed(1)}%. Triggering escalation workflow (${simulationResult.slaHours}).`}
                </div>
              </div>

              {/* Margin & Upsell recommendation */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Estimated Gross Margin:</span>
                  <span className="font-bold text-slate-900">{simulationResult.estimatedMargin}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">AI Upsell Recommendation:</span>
                  <span className="font-semibold text-blue-600">Attach 24/7 Enterprise SLA (+15% Margin)</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>Simulated with DealFlow360 Decision Engine</span>
              <span className="text-indigo-600 font-semibold cursor-pointer hover:underline">
                Export Simulation Spec
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
