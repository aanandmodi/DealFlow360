import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, X, Save, Database, Sparkles, Layers, Check } from 'lucide-react';
import { ApiClient } from '../../api/client';
import { PageHead, Notice, Loading, Empty } from './shared';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/utils';

type Field = { name: string; type: string; readonly: boolean; required: boolean; default: unknown; options: { value: string | number; label: string }[] };
type ConfigData = { fields: Field[]; results: Record<string, any>[]; can_write: boolean };

const resources = [
  ['users', 'Team access'],
  ['products', 'Products'],
  ['customers', 'Customers'],
  ['variants', 'Variants'],
  ['price-lists', 'Price lists'],
  ['prices', 'Tier pricing'],
  ['discounts', 'Discount policy'],
  ['approvals', 'Approval chains'],
  ['warehouses', 'Warehouses'],
  ['stock', 'Inventory'],
  ['plans', 'Recurring plans'],
  ['upsell', 'Cross-sell rules'],
];

const label = (s: string) => s.replaceAll('_', ' ').replace('pct', '%');

export function ConfigPage() {
  const { user } = useAuth();
  const [resource, setResource] = useState('products');
  const [form, setForm] = useState<Record<string, any> | null>(null);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  // Variant Matrix Generator State
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [matrixProductId, setMatrixProductId] = useState<number | ''>('');
  const [matrixAttr1Name, setMatrixAttr1Name] = useState('Memory');
  const [matrixAttr1Values, setMatrixAttr1Values] = useState('16GB:0, 32GB:15000, 64GB:32000');
  const [matrixAttr2Name, setMatrixAttr2Name] = useState('Storage');
  const [matrixAttr2Values, setMatrixAttr2Values] = useState('512GB SSD:0, 1TB SSD:12000, 2TB SSD:24000');
  const [matrixGenerating, setMatrixGenerating] = useState(false);
  const [matrixResult, setMatrixResult] = useState<any>(null);

  const query = useQuery({ queryKey: ['config', resource], queryFn: () => ApiClient.get<ConfigData>(`/config/${resource}/`) });
  const productsQuery = useQuery({ queryKey: ['all-products-config'], queryFn: () => ApiClient.get<any>('/products/') });
  const productsList: any[] = Array.isArray(productsQuery.data) ? productsQuery.data : (productsQuery.data?.results || []);

  const save = useMutation({
    mutationFn: () => form?.id ? ApiClient.patch(`/config/${resource}/${form.id}/`, form) : ApiClient.post(`/config/${resource}/`, form),
    onSuccess: () => { setForm(null); qc.invalidateQueries(); }
  });

  const fields = query.data?.fields || [];
  const rows = (query.data?.results || []).filter(r => Object.values(r).join(' ').toLowerCase().includes(search.toLowerCase()));
  const shown = fields.filter(f => !['description', 'address', 'is_subscription'].includes(f.name)).slice(0, 7);

  // Parse Matrix Pairs
  const parsePairs = (str: string) => {
    return str.split(',').map(s => s.trim()).filter(Boolean).map(item => {
      const parts = item.split(':');
      return { val: parts[0]?.trim() || '', price: parseFloat(parts[1] || '0') || 0 };
    });
  };

  const attr1Pairs = parsePairs(matrixAttr1Values);
  const attr2Pairs = parsePairs(matrixAttr2Values);
  const totalCombinations = attr1Pairs.length * attr2Pairs.length;

  const handleGenerateMatrix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matrixProductId) return;
    setMatrixGenerating(true);
    try {
      const payload = {
        attributes: [
          {
            name: matrixAttr1Name,
            values: attr1Pairs.map(p => p.val),
            price_additions: attr1Pairs.map(p => p.price),
          },
          {
            name: matrixAttr2Name,
            values: attr2Pairs.map(p => p.val),
            price_additions: attr2Pairs.map(p => p.price),
          }
        ]
      };
      const res = await ApiClient.post<any>(`/products/${matrixProductId}/generate-variants-matrix/`, payload);
      setMatrixResult(res);
      qc.invalidateQueries({ queryKey: ['config', resource] });
      setTimeout(() => {
        setShowMatrixModal(false);
        setMatrixResult(null);
      }, 2500);
    } catch (err: any) {
      console.error('Matrix error:', err);
    } finally {
      setMatrixGenerating(false);
    }
  };

  return (
    <div className="workspace-page">
      <PageHead
        eyebrow="CONTROL CENTRE"
        title="Catalog & rules"
        description="Manage the catalog, pricing guardrails, inventory and recurring plans."
      />

      <div className="config-layout">
        <nav className="config-nav" aria-label="Configuration areas">
          {resources
            .filter(([key]) => key !== 'users' || user?.role === 'admin')
            .map(([key, name]) => (
              <button
                key={key}
                className={resource === key ? 'active' : ''}
                onClick={() => { setResource(key); setForm(null); save.reset(); setSearch(''); }}
              >
                {name}
                <span>↗</span>
              </button>
            ))}
        </nav>

        <section className="panel config-content">
          <div className="panel-head">
            <div>
              <div className="eyebrow">WORKSPACE CONFIGURATION</div>
              <h2>{resources.find(r => r[0] === resource)?.[1]}</h2>
            </div>
            {query.data?.can_write && resource !== 'users' && (
              <div className="flex items-center gap-2">
                {(resource === 'variants' || resource === 'products') && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowMatrixModal(true);
                      if (!matrixProductId && productsList.length > 0) {
                        setMatrixProductId(productsList[0].id);
                      }
                    }}
                  >
                    <Sparkles size={15} />
                    <span>Variant Matrix Generator</span>
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    save.reset();
                    setForm(Object.fromEntries(fields.filter(f => !f.readonly).map(f => [f.name, f.default])));
                  }}
                >
                  <Plus size={16} />
                  Add record
                </button>
              </div>
            )}
          </div>

          <div className="table-toolbar">
            <input
              aria-label="Search records"
              placeholder="Search records…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span>{rows.length} records · INR</span>
          </div>

          <Notice error={query.error} />

          {query.isLoading ? (
            <Loading />
          ) : rows.length === 0 ? (
            <Empty />
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    {shown.map(f => (
                      <th key={f.name}>{label(f.name)}</th>
                    ))}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.id}>
                      {shown.map(f => (
                        <td key={f.name}>
                          {f.type === 'checkbox' ? (
                            <span className={`pill ${row[f.name] ? 'pill-green' : ''}`}>
                              {row[f.name] ? 'Yes' : 'No'}
                            </span>
                          ) : (
                            f.options.find(o => String(o.value) === String(row[f.name]))?.label || String(row[f.name] ?? '—')
                          )}
                        </td>
                      ))}
                      <td>
                        {query.data?.can_write && (
                          <button
                            className="icon-button"
                            aria-label={`Edit ${row.name || row.id}`}
                            onClick={() => { setForm({ ...row }); save.reset(); }}
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="panel-foot">
            <Database size={14} />
            Changes are saved to your database and used by the deal engine.
          </div>
        </section>
      </div>

      {/* Standard Record Form Modal */}
      {form && (
        <div className="modal-backdrop">
          <section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="edit-title">
            <div className="panel-head">
              <h2 id="edit-title">{form.id ? 'Edit' : 'Add'} record</h2>
              <button className="icon-button" aria-label="Close editor" onClick={() => setForm(null)}>
                <X />
              </button>
            </div>
            <form onSubmit={e => { e.preventDefault(); save.mutate(); }}>
              <div className="form-grid">
                {fields.filter(f => !f.readonly).map(f => (
                  <label className={f.type === 'checkbox' ? 'check-label' : ''} key={f.name}>
                    <span>{label(f.name)}{f.required ? ' *' : ''}</span>
                    {f.type === 'select' ? (
                      <select
                        required={f.required}
                        value={form[f.name] ?? ''}
                        onChange={e => setForm({ ...form, [f.name]: e.target.value })}
                      >
                        <option value="">Choose…</option>
                        {f.options.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : f.type === 'checkbox' ? (
                      <input
                        type="checkbox"
                        checked={!!form[f.name]}
                        onChange={e => setForm({ ...form, [f.name]: e.target.checked })}
                      />
                    ) : (
                      <input
                        required={f.required}
                        type={f.type}
                        step={f.type === 'number' ? '0.01' : undefined}
                        min={f.type === 'number' ? 0 : undefined}
                        value={form[f.name] ?? ''}
                        onChange={e => setForm({ ...form, [f.name]: e.target.value })}
                      />
                    )}
                  </label>
                ))}
              </div>
              <Notice error={save.error} />
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>
                  Cancel
                </button>
                <button disabled={save.isPending} className="btn btn-primary">
                  <Save size={16} />
                  {save.isPending ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Cartesian Product Variant Matrix Generator Modal */}
      {showMatrixModal && (
        <div className="modal-backdrop">
          <section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="matrix-title" style={{ maxWidth: '640px' }}>
            <div className="panel-head">
              <div className="flex items-center gap-2">
                <Sparkles className="text-blue-600" size={18} />
                <h2 id="matrix-title">Cartesian Variant Matrix Generator</h2>
              </div>
              <button className="icon-button" aria-label="Close matrix generator" onClick={() => setShowMatrixModal(false)}>
                <X />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Quickly generate all multi-attribute variant combinations (e.g. Memory × Storage) with custom price add-ons.
            </p>

            {matrixResult ? (
              <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                <Check className="mx-auto text-emerald-600 h-8 w-8" />
                <h3 className="text-sm font-bold text-emerald-900">
                  Generated {matrixResult.combinations_generated} Variants for {matrixResult.product_name}!
                </h3>
                <p className="text-xs text-emerald-700">All combinations are now active and available in Quotation Builder.</p>
              </div>
            ) : (
              <form onSubmit={handleGenerateMatrix} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Target Base Product *</label>
                  <select
                    required
                    value={matrixProductId}
                    onChange={e => setMatrixProductId(Number(e.target.value))}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="">Select a hardware or software product…</option>
                    {productsList.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.category}) — Base {formatCurrency(Number(p.base_price))}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                    <label className="text-xs font-bold text-slate-800 block">Dimension 1 (e.g. Memory)</label>
                    <input
                      type="text"
                      value={matrixAttr1Name}
                      onChange={e => setMatrixAttr1Name(e.target.value)}
                      placeholder="Attribute Name (e.g. Memory)"
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                      required
                    />
                    <label className="text-[11px] text-slate-500 block">Values & Price Add-ons (Name:ExtraPrice)</label>
                    <input
                      type="text"
                      value={matrixAttr1Values}
                      onChange={e => setMatrixAttr1Values(e.target.value)}
                      placeholder="16GB:0, 32GB:15000, 64GB:32000"
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white font-mono"
                      required
                    />
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                    <label className="text-xs font-bold text-slate-800 block">Dimension 2 (e.g. Storage)</label>
                    <input
                      type="text"
                      value={matrixAttr2Name}
                      onChange={e => setMatrixAttr2Name(e.target.value)}
                      placeholder="Attribute Name (e.g. Storage)"
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                      required
                    />
                    <label className="text-[11px] text-slate-500 block">Values & Price Add-ons (Name:ExtraPrice)</label>
                    <input
                      type="text"
                      value={matrixAttr2Values}
                      onChange={e => setMatrixAttr2Values(e.target.value)}
                      placeholder="512GB SSD:0, 1TB SSD:12000, 2TB SSD:24000"
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white font-mono"
                      required
                    />
                  </div>
                </div>

                {/* Live Combinatorial Matrix Preview */}
                <div className="p-3 rounded-xl border border-blue-100 bg-blue-50/50 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <div className="flex items-center gap-1.5">
                      <Layers size={14} className="text-blue-600" />
                      <span>Matrix Preview ({totalCombinations} Combinations)</span>
                    </div>
                    <span className="text-[10px] text-blue-700 font-mono">Cartesian Product</span>
                  </div>
                  <div className="max-h-32 overflow-y-auto divide-y divide-blue-100 text-[11px] font-mono text-slate-600 pt-1">
                    {attr1Pairs.map(a1 =>
                      attr2Pairs.map(a2 => (
                        <div key={`${a1.val}-${a2.val}`} className="py-1 flex justify-between">
                          <span>{a1.val} / {a2.val}</span>
                          <span className="font-bold text-slate-900">+{formatCurrency(a1.price + a2.price)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowMatrixModal(false)}>
                    Cancel
                  </button>
                  <button disabled={matrixGenerating || !matrixProductId} className="btn btn-primary">
                    <Sparkles size={16} />
                    {matrixGenerating ? 'Generating Matrix…' : `Generate ${totalCombinations} Variants`}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
