"""
Warehouse auto-split algorithm — Person B.

Given an order's product quantities, choose the fewest warehouses that can
fulfill stock (minimize shipment count), weighted by each warehouse's
shipping_cost_weight. Whatever can't be filled becomes a backorder split.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from django.db.models import F
from django.db import transaction
from rest_framework.exceptions import ValidationError

from fulfillment.models import StockLevel, FulfillmentSplit, Warehouse


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


def suggest_split(quotation) -> SplitResult:
    result = SplitResult()
    warehouses_already_used: set[int] = set()

    lines = quotation.lines.select_related('product').filter(product__category='hardware')
    product_quantities: dict[int, tuple] = {}

    for line in lines:
        pid = line.product_id
        qty = int(line.qty)
        if pid in product_quantities:
            existing_product, existing_qty = product_quantities[pid]
            product_quantities[pid] = (existing_product, existing_qty + qty)
        else:
            product_quantities[pid] = (line.product, qty)

    for product_id, (product, qty_needed) in product_quantities.items():
        remaining = qty_needed

        stock_entries = (
            StockLevel.objects
            .filter(product_id=product_id, warehouse__is_active=True)
            .select_related('warehouse')
            .order_by('warehouse__shipping_cost_weight')
        )

        available = []
        for sl in stock_entries:
            effective = sl.available
            if effective > 0:
                priority = 0 if sl.warehouse_id in warehouses_already_used else 1
                available.append((priority, float(sl.warehouse.shipping_cost_weight), sl))

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

        if remaining > 0:
            result.has_backorders = True
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

    warehouses_used = {s.warehouse_id for s in result.suggestions if not s.is_backorder}
    result.total_shipments = len(warehouses_used)
    result.total_estimated_cost = sum(
        s.estimated_cost for s in result.suggestions if not s.is_backorder
    )

    result.backorder_consolidation_available = _check_backorder_consolidation(quotation)

    return result


@transaction.atomic
def persist_split(quotation, suggestions: list[SplitSuggestion], status: str = 'accepted') -> list[FulfillmentSplit]:
    if quotation.status not in ('confirmed', 'fulfillment', 'invoiced', 'paid'):
        raise ValidationError('Customer confirmation is required before reserving stock.')
    existing = list(FulfillmentSplit.objects.filter(quotation=quotation))
    if existing:
        return existing
    list(StockLevel.objects.select_for_update().filter(
        product_id__in=[s.product_id for s in suggestions]).order_by('pk'))
    allocations = [dict(product_id=s.product_id, warehouse_id=s.warehouse_id,
                        quantity=s.quantity, is_backorder=s.is_backorder) for s in suggestions]
    valid, errors = validate_manual_split(quotation, allocations)
    if not valid:
        raise ValidationError(errors)
    created_splits = []
    for s in suggestions:
        if not s.is_backorder:
            updated = StockLevel.objects.filter(warehouse_id=s.warehouse_id, product_id=s.product_id,
                in_stock__gte=F('reserved') + s.quantity).update(reserved=F('reserved') + s.quantity)
            if not updated:
                raise ValidationError('Inventory changed. Refresh the allocation.')
        created_splits.append(FulfillmentSplit.objects.create(quotation=quotation,
            product_id=s.product_id, warehouse_id=s.warehouse_id, qty=s.quantity,
            estimated_cost=Decimal(str(s.estimated_cost)) if not s.is_backorder else 0,
            is_backorder=s.is_backorder, status=status))
    if quotation.status == 'confirmed':
        quotation.status = 'fulfillment'
        quotation.save()
    return created_splits


def validate_manual_split(quotation, manual_allocations: list[dict]) -> tuple[bool, list[str]]:
    errors = []

    lines = quotation.lines.filter(product__category='hardware')
    required_qty: dict[int, int] = {}
    for line in lines:
        required_qty[line.product_id] = required_qty.get(line.product_id, 0) + int(line.qty)

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

    if set(allocated_qty) - set(required_qty):
        errors.append('Allocation contains a product outside the hardware order.')
    totals = {}
    for alloc in manual_allocations:
        if alloc['quantity'] <= 0:
            errors.append('Quantities must be positive.')
        if not Warehouse.objects.filter(pk=alloc['warehouse_id'], is_active=True).exists():
            errors.append('Warehouse is inactive or missing.')
        if not alloc.get('is_backorder', False):
            key = (alloc['product_id'], alloc['warehouse_id'])
            totals[key] = totals.get(key, 0) + alloc['quantity']
    for (pid, wid), qty in totals.items():
        stock = StockLevel.objects.filter(product_id=pid, warehouse_id=wid).first()
        if not stock or stock.available < qty:
            errors.append('Combined allocations exceed available inventory.')
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
    backorders = FulfillmentSplit.objects.filter(
        quotation=quotation,
        is_backorder=True,
    ).select_related('product')

    for bo in backorders:
        total_available = (
            StockLevel.objects
            .filter(product_id=bo.product_id, warehouse__is_active=True)
        )
        total_avail = sum(sl.available for sl in total_available)
        if total_avail >= bo.qty:
            return True

    return False
