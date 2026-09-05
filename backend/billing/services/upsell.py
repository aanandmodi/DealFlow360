"""
Upsell/Cross-sell suggestion service — Person B.

Ranks UpsellRule matches for products in the cart by (is_promoted first,
then margin_delta descending), filtering out anything below min_margin_pct.

Adapted to repo field names: UpsellRule.product (not source_product),
UpsellRule.min_margin_pct (not min_margin_threshold).
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass
class UpsellSuggestionResult:
    """A single upsell/cross-sell suggestion."""
    rule_id: int
    suggested_product_id: int
    suggested_product_name: str
    suggested_product_category: str
    suggested_product_price: Decimal
    margin_delta: Decimal
    is_promoted: bool

    def to_dict(self) -> dict:
        return {
            'id': self.rule_id,
            'suggested_product': {
                'id': self.suggested_product_id,
                'name': self.suggested_product_name,
                'category': self.suggested_product_category,
                'base_price': str(self.suggested_product_price),
            },
            'margin_delta': str(self.margin_delta),
            'is_promoted': self.is_promoted,
        }


def get_upsell_suggestions(quotation) -> list[UpsellSuggestionResult]:
    """
    Given a Quotation, find and rank upsell suggestions.

    1. Get all products currently in the cart
    2. Find UpsellRules where product (source) is in the cart
    3. Filter out suggested products already in the cart
    4. Filter by min_margin_pct
    5. Sort: promoted first, then by margin_delta descending
    """
    from billing.models import UpsellRule

    # Get products in cart
    cart_product_ids = set(
        quotation.lines.values_list('product_id', flat=True)
    )

    if not cart_product_ids:
        return []

    # Find matching upsell rules
    # NOTE: repo uses 'product' not 'source_product' for the source FK
    rules = (
        UpsellRule.objects
        .filter(product_id__in=cart_product_ids)
        .select_related('suggested_product')
    )

    suggestions = []
    already_suggested = set()

    for rule in rules:
        suggested = rule.suggested_product

        # Skip if suggested product is already in cart
        if suggested.id in cart_product_ids:
            continue

        # Skip duplicates
        if suggested.id in already_suggested:
            continue

        # Calculate margin delta (simplified: suggested price - threshold)
        margin_delta = suggested.base_price * Decimal('0.35')  # ~35% margin assumed

        # Filter by minimum margin threshold
        # NOTE: repo uses 'min_margin_pct' not 'min_margin_threshold'
        if margin_delta < rule.min_margin_pct:
            continue

        already_suggested.add(suggested.id)
        suggestions.append(UpsellSuggestionResult(
            rule_id=rule.id,
            suggested_product_id=suggested.id,
            suggested_product_name=suggested.name,
            suggested_product_category=suggested.category.name,
            suggested_product_price=suggested.base_price,
            margin_delta=margin_delta.quantize(Decimal('0.01')),
            is_promoted=rule.is_promoted,
        ))

    # Sort: promoted first, then by margin_delta descending
    suggestions.sort(key=lambda s: (-int(s.is_promoted), -s.margin_delta))

    return suggestions
