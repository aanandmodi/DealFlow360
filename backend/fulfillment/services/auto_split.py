"""
Warehouse auto-split algorithm — Person B.

Given an order's product quantities, choose the fewest warehouses that can
fulfill stock (minimize shipment count), weighted by each warehouse's
shipping_cost_weight. Whatever can't be filled becomes a backorder split.

Algorithm:
  1. For each (product, quantity) in the quotation:
     a. Gather all warehouses with available > 0 for that product.
     b. Sort by shipping_cost_weight ascending (cheapest first).
     c. Greedily allocate from cheapest warehouse first.
     d. Track which warehouses are used across all products to minimize
        total shipment count (prefer warehouses already chosen).
  2. Any remaining unfulfilled quantity → backorder split.
  3. Return suggested splits + a backorder_consolidation_available flag.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from django.db.models import F

from fulfillment.models import StockLevel, FulfillmentSplit, Warehouse


# ---------------------------------------------------------------------------
# Data structures for the suggestion (not yet persisted)
# ---------------------------------------------------------------------------

@dataclass
class SplitSuggestion:
    """A single suggested allocation line."""
    product_id: int
    product_name: str
    warehouse_id: int
    warehouse_name: str
    quantity: int
    is_backorder: bool
    shipping_cost_weight: Decimal = Decimal("1.00")

    @property
    def estimated_cost(self) -> float:
        return self.quantity * float(self.shipping_cost_weight)


@dataclass
class SplitResult:
    """Full result of the auto-split algorithm."""
    suggestions: list[SplitSuggestion] = field(default_factory=list)
    total_shipments: int = 0
    total_estimated_cost: float = 0.0
    has_backorders: bool = False
    backorder_consolidation_available: bool = False

    def to_dict(self) -> dict:
        warehouses_used = set()
        items = []
        for s in self.suggestions:
            if not s.is_backorder:
                warehouses_used.add(s.warehouse_id)
            items.append({
                'product_id': s.product_id,
                'product_name': s.product_name,
                'warehouse_id': s.warehouse_id,
                'warehouse_name': s.warehouse_name,
                'quantity': s.quantity,
                'is_backorder': s.is_backorder,
                'estimated_cost': s.estimated_cost,
            })

        return {
            'splits': items,
            'total_shipments': len(warehouses_used),
            'total_estimated_cost': sum(i['estimated_cost'] for i in items if not i['is_backorder']),
            'has_backorders': self.has_backorders,
            'backorder_consolidation_available': self.backorder_consolidation_available,
        }


# ---------------------------------------------------------------------------
# Core algorithm
# ---------------------------------------------------------------------------

def suggest_split(quotation) -> SplitResult:
    """
    Given a Quotation (with .lines.all()), compute the optimal warehouse split.

    Strategy: for each product, greedily allocate from cheapest available
    warehouse first. Prefer warehouses already selected (to minimize total
    shipment count).

    Returns a SplitResult with suggested allocations (not persisted).
    """
    result = SplitResult()
    warehouses_already_used: set[int] = set()

    # Gather all line items grouped by product
    # NOTE: repo uses 'qty' (DecimalField) not 'quantity'
    lines = quotation.lines.select_related('product').all()
    product_quantities: dict[int, tuple] = {}  # product_id → (product, total_qty)

    for line in lines:
        pid = line.product_id
        qty = int(line.quantity)
        if pid in product_quantities:
            existing_product, existing_qty = product_quantities[pid]
            product_quantities[pid] = (existing_product, existing_qty + qty)
        else:
            product_quantities[pid] = (line.product, qty)

    for product_id, (product, qty_needed) in product_quantities.items():
        remaining = qty_needed

        # Get all stock levels for this product, sorted by shipping cost
        # NOTE: repo uses 'in_stock' and 'reserved' fields
        stock_entries = (
            StockLevel.objects
            .filter(
                product_id=product_id,
                warehouse__is_active=True,
            )
            .select_related('warehouse')
            .order_by('warehouse__shipping_cost_weight')
        )

        # Build a list and prefer warehouses we've already chosen
        available = []
        for sl in stock_entries:
            effective = sl.available  # property: in_stock - reserved
            if effective > 0:
                # Priority: already-used warehouses get a bonus (sort first)
                priority = 0 if sl.warehouse_id in warehouses_already_used else 1
                available.append((priority, float(sl.warehouse.shipping_cost_weight), sl))

        # Sort: prefer already-used warehouses, then by cost
        available.sort(key=lambda x: (x[0], x[1]))

        for _priority, _cost, sl in available:
            if remaining <= 0:
                break

            allocate = min(remaining, sl.available)
            if allocate > 0:
                result.suggestions.append(SplitSuggestion(
                    product_id=product_id,
                    product_name=product.name,
                    warehouse_id=sl.warehouse_id,
                    warehouse_name=sl.warehouse.name,
                    quantity=allocate,
                    is_backorder=False,
                    shipping_cost_weight=sl.warehouse.shipping_cost_weight,
                ))
                warehouses_already_used.add(sl.warehouse_id)
                remaining -= allocate

        # Anything left is a backorder
        if remaining > 0:
            result.has_backorders = True
            # Assign backorder to the first (cheapest) warehouse for tracking
            default_warehouse = (
                Warehouse.objects.filter(is_active=True)
                .order_by('shipping_cost_weight')
                .first()
            )
            if default_warehouse:
                result.suggestions.append(SplitSuggestion(
                    product_id=product_id,
                    product_name=product.name,
                    warehouse_id=default_warehouse.id,
                    warehouse_name=default_warehouse.name,
                    quantity=remaining,
                    is_backorder=True,
                    shipping_cost_weight=default_warehouse.shipping_cost_weight,
                ))

    # Compute summary
    warehouses_used = {s.warehouse_id for s in result.suggestions if not s.is_backorder}
    result.total_shipments = len(warehouses_used)
    result.total_estimated_cost = sum(
        s.estimated_cost for s in result.suggestions if not s.is_backorder
    )

    # Check if any existing backorder splits can now be consolidated
    result.backorder_consolidation_available = _check_backorder_consolidation(quotation)

    return result


def persist_split(quotation, suggestions: list[SplitSuggestion], status: str = 'accepted') -> list[FulfillmentSplit]:
    """
    Persist the suggested (or overridden) split allocations to the database.
    Reserves stock via F-expression for non-backorder items.
    """
    # Clear any existing suggested splits for this quotation
    FulfillmentSplit.objects.filter(quotation=quotation).delete()

    created_splits = []
    for s in suggestions:
        split = FulfillmentSplit.objects.create(
            quotation=quotation,
            product_id=s.product_id,
            warehouse_id=s.warehouse_id,
            qty=s.quantity,
            estimated_cost=Decimal(str(s.estimated_cost)),
            status=status,
        )
        created_splits.append(split)

        # Reserve stock for non-backorder items
        if not s.is_backorder:
            StockLevel.objects.filter(
                warehouse_id=s.warehouse_id,
                product_id=s.product_id,
            ).update(
                reserved=F('reserved') + s.quantity
            )

    return created_splits


def validate_manual_split(quotation, manual_allocations: list[dict]) -> tuple[bool, list[str]]:
    """
    Validate a manual override split against available stock.

    manual_allocations: [
        {'product_id': 1, 'warehouse_id': 1, 'quantity': 50},
        ...
    ]

    Returns (is_valid, list_of_errors).
    """
    errors = []

    # Check total quantities match quotation lines
    lines = quotation.lines.all()
    required_qty: dict[int, int] = {}
    for line in lines:
        required_qty[line.product_id] = required_qty.get(line.product_id, 0) + int(line.quantity)

    allocated_qty: dict[int, int] = {}
    for alloc in manual_allocations:
        pid = alloc['product_id']
        allocated_qty[pid] = allocated_qty.get(pid, 0) + alloc['quantity']

    for pid, needed in required_qty.items():
        allocated = allocated_qty.get(pid, 0)
        if allocated != needed:
            errors.append(
                f"Product {pid}: need {needed} units but allocated {allocated}"
            )

    # Check stock availability for non-backorder items
    for alloc in manual_allocations:
        if alloc.get('is_backorder', False):
            continue
        try:
            sl = StockLevel.objects.get(
                warehouse_id=alloc['warehouse_id'],
                product_id=alloc['product_id'],
            )
            if sl.available < alloc['quantity']:
                errors.append(
                    f"Product {alloc['product_id']} at warehouse "
                    f"{alloc['warehouse_id']}: only {sl.available} "
                    f"available, requested {alloc['quantity']}"
                )
        except StockLevel.DoesNotExist:
            errors.append(
                f"No stock record for product {alloc['product_id']} "
                f"at warehouse {alloc['warehouse_id']}"
            )

    return (len(errors) == 0, errors)


def _check_backorder_consolidation(quotation) -> bool:
    """
    Check if any existing backorder splits for this quotation can now be
    fulfilled (stock has been replenished since the backorder was created).
    """
    backorders = FulfillmentSplit.objects.filter(
        quotation=quotation,
        status__in=['suggested', 'accepted'],
    ).select_related('product')

    for bo in backorders:
        # Check if any warehouse now has enough stock
        total_available = (
            StockLevel.objects
            .filter(product_id=bo.product_id, warehouse__is_active=True)
        )
        total_avail = sum(sl.available for sl in total_available)
        if total_avail >= bo.qty:
            return True

    return False
