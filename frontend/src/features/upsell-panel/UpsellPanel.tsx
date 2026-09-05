/**
 * Upsell Panel — B5: Embeddable Upsell & Cross-sell Recommendation Card.
 *
 * Renders inside Person A's QuotationBuilderPage to surface margin-accretive
 * co-purchase and upsell recommendations.
 */
import { useState, useEffect } from 'react';
import { getUpsellSuggestions, UpsellSuggestion } from '../../api/billing';
import { formatCurrency } from '../../lib/utils';
import { Sparkles, Plus, X, ArrowUpRight, TrendingUp, Check } from 'lucide-react';

interface UpsellPanelProps {
  quotationId: number;
  onAddProduct?: (productId: number, basePrice: string) => void;
}

export function UpsellPanel({ quotationId, onAddProduct }: UpsellPanelProps) {
  const [suggestions, setSuggestions] = useState<UpsellSuggestion[]>([]);
  const [dismissedIds, setDismissedIds] = useState<number[]>([]);
  const [addedIds, setAddedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!quotationId) return;
    setLoading(true);
    getUpsellSuggestions(quotationId)
      .then((res) => {
        setSuggestions(res.suggestions || []);
      })
      .catch((err) => {
        console.warn('Upsell suggestions unavailable:', err);
        setSuggestions([]);
      })
      .finally(() => setLoading(false));
  }, [quotationId]);

  const visibleSuggestions = suggestions.filter(
    (s) => !dismissedIds.includes(s.id)
  );

  const handleDismiss = (id: number) => {
    setDismissedIds((prev) => [...prev, id]);
  };

  const handleAdd = (suggestion: UpsellSuggestion) => {
    setAddedIds((prev) => [...prev, suggestion.id]);
    if (onAddProduct) {
      onAddProduct(
        suggestion.suggested_product.id,
        suggestion.suggested_product.base_price
      );
    }
  };

  if (loading) {
    return (
      <div className="card bg-blue-50/50 border-blue-200/60 p-4 animate-fade-in">
        <div className="flex items-center gap-2 text-xs text-blue-600">
          <Sparkles className="w-3.5 h-3.5 animate-spin" />
          <span>Evaluating margin-optimizing upsell opportunities...</span>
        </div>
      </div>
    );
  }

  if (visibleSuggestions.length === 0) {
    return null;
  }

  return (
    <div className="card bg-gradient-to-r from-blue-50/60 via-indigo-50/30 to-purple-50/40 border border-blue-200/70 p-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900">
                Smart Deal Maximizer &bull; Upsell Engine
              </h4>
              <span className="badge badge-info text-[10px] py-0 h-4">B5 Shared</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Margin-accretive pairings and premium add-ons tailored for this cart configuration.
            </p>
          </div>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          {visibleSuggestions.length} recommendation{visibleSuggestions.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Suggestion Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {visibleSuggestions.map((item) => {
          const isAdded = addedIds.includes(item.id);
          const marginDelta = parseFloat(item.margin_delta || '0');

          return (
            <div
              key={item.id}
              className="bg-white/95 rounded border border-slate-200/80 p-3 flex flex-col justify-between shadow-xs hover:border-blue-300 transition"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-slate-900">
                      {item.suggested_product.name}
                    </span>
                    {item.is_promoted && (
                      <span className="badge badge-warning text-[9px] py-0 h-4">
                        ⭐ Promoted
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDismiss(item.id)}
                    className="text-slate-300 hover:text-slate-500 p-0.5 rounded transition"
                    title="Dismiss recommendation"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] uppercase font-semibold text-slate-500 px-1.5 py-0.5 bg-slate-100 rounded">
                    {item.suggested_product.category || 'Add-on'}
                  </span>
                  <span className="text-xs font-mono font-medium text-slate-700">
                    {formatCurrency(parseFloat(item.suggested_product.base_price))}
                  </span>
                  {marginDelta > 0 && (
                    <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded gap-0.5">
                      <TrendingUp className="w-2.5 h-2.5" />
                      +{marginDelta}% Margin Delta
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Adds high-margin services to base quote
                </span>
                <button
                  onClick={() => handleAdd(item)}
                  disabled={isAdded}
                  className={`btn btn-sm ${
                    isAdded ? 'btn-secondary text-emerald-600' : 'btn-primary'
                  } gap-1 text-[11px]`}
                >
                  {isAdded ? (
                    <>
                      <Check className="w-3 h-3" /> Added
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3" /> Add to Quote
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
