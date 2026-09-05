"""
DealFlow360 — Smart Bulk Importer Module.
Handles pre-flight validation, inventory stock checks, discount compliance,
and atomic creation of multi-line quotations in bulk.
"""
import io
import csv
import uuid
from decimal import Decimal
from typing import Dict, List, Any, Tuple
from django.db import transaction
from django.utils import timezone
from .models import (
    Customer,
    Product,
    ProductVariant,
    Quotation,
    QuotationLine,
    DiscountTier,
    PriceListItem,
    ApprovalLog,
)

try:
    from fulfillment.models import StockLevel
except ImportError:
    StockLevel = None


def parse_csv_content(csv_text: str) -> List[Dict[str, str]]:
    """Parse CSV text into normalized list of row dictionaries."""
    f = io.StringIO(csv_text.strip())
    reader = csv.DictReader(f)
    rows = []
    for r in reader:
        # Normalize header keys (strip whitespace, lowercase, replace spaces/dashes with underscore)
        clean_row = {}
        for k, v in r.items():
            if k is not None:
                norm_key = k.strip().lower().replace(' ', '_').replace('-', '_')
                clean_row[norm_key] = v.strip() if v else ''
        if any(clean_row.values()):  # Skip completely empty rows
            rows.append(clean_row)
    return rows


def validate_single_row(row: Dict[str, Any], index: int) -> Dict[str, Any]:
    """
    Validates a single row against database catalogs:
    - Checks Customer existence / auto-creation
    - Matches Product by SKU or Name
    - Checks live stock availability
    - Validates quantity & unit price
    - Calculates discount compliance & approval tier requirements
    """
    warnings: List[str] = []
    errors: List[str] = []
    status_tag = 'VALID'

    customer_name = row.get('customer_name') or row.get('customer') or row.get('client') or ''
    customer_email = row.get('customer_email') or row.get('email') or ''
    sku = row.get('sku') or row.get('product_sku') or ''
    product_name = row.get('product_name') or row.get('product') or row.get('item') or ''
    raw_qty = row.get('quantity') or row.get('qty') or '1'
    raw_price = row.get('unit_price') or row.get('price') or ''
    raw_discount = row.get('discount_pct') or row.get('discount') or row.get('discount_%') or row.get('discount_percent') or '0'
    payment_terms = row.get('payment_terms') or 'Net 30 Days'
    notes = row.get('notes') or ''

    # 1. Parse numeric quantity
    try:
        qty = Decimal(str(raw_qty).replace(',', '').strip())
        if qty <= 0:
            errors.append('Quantity must be greater than 0.')
    except Exception:
        qty = Decimal('1')
        errors.append(f"Invalid quantity: '{raw_qty}'.")

    # 2. Parse numeric discount
    try:
        clean_discount = str(raw_discount).replace('%', '').strip()
        discount_pct = Decimal(clean_discount) if clean_discount else Decimal('0')
        if discount_pct < 0 or discount_pct > 100:
            errors.append('Discount must be between 0% and 100%.')
    except Exception:
        discount_pct = Decimal('0')
        errors.append(f"Invalid discount percentage: '{raw_discount}'.")

    # 3. Match Customer
    matched_customer = None
    if customer_email:
        matched_customer = Customer.objects.filter(email__iexact=customer_email).first()
    if not matched_customer and customer_name:
        matched_customer = Customer.objects.filter(name__iexact=customer_name).first()

    if not matched_customer:
        if customer_name or customer_email:
            warnings.append(f"New customer '{customer_name or customer_email}' will be auto-registered as Bronze tier.")
            customer_tier = 'bronze'
            resolved_customer_display = f"{customer_name or customer_email} (New Bronze)"
        else:
            errors.append('Customer name or email is required.')
            customer_tier = 'bronze'
            resolved_customer_display = 'Missing Customer'
    else:
        customer_tier = matched_customer.tier
        resolved_customer_display = f"{matched_customer.name} ({matched_customer.get_tier_display()})"

    # 4. Match Product
    matched_product = None
    if sku:
        matched_product = Product.objects.filter(sku__iexact=sku).first()
    if not matched_product and product_name:
        matched_product = Product.objects.filter(name__iexact=product_name).first()
        if not matched_product:
            # Try contains match
            matched_product = Product.objects.filter(name__icontains=product_name).first()

    resolved_sku = sku
    resolved_product_name = product_name
    unit_price = Decimal('0')
    stock_available = None
    requires_approval = False

    if not matched_product:
        errors.append(f"Product not found for SKU: '{sku}' / Name: '{product_name}'.")
    else:
        resolved_sku = matched_product.sku or 'NO-SKU'
        resolved_product_name = matched_product.name
        
        # Check Price
        if raw_price:
            try:
                unit_price = Decimal(str(raw_price).replace('$', '').replace('₹', '').replace(',', '').strip())
                if unit_price < 0:
                    errors.append('Unit price cannot be negative.')
            except Exception:
                unit_price = matched_product.base_price
                warnings.append(f"Invalid price '{raw_price}', using catalog base price.")
        else:
            # Lookup price list or base price
            price_override = PriceListItem.objects.filter(
                product=matched_product,
                price_list__tier=customer_tier,
                price_list__currency='INR',
                price_list__is_active=True
            ).first()
            unit_price = price_override.price if price_override else matched_product.base_price

        # Check Stock availability from fulfillment
        if StockLevel:
            stocks = StockLevel.objects.filter(product=matched_product)
            total_available = sum(s.available for s in stocks)
            stock_available = total_available
            if total_available <= 0:
                warnings.append(f"Out of stock: 0 units currently available in warehouses.")
            elif total_available < qty:
                warnings.append(f"Low stock: Only {total_available} units available (Requested: {qty}).")

        # Check Discount compliance ceiling
        dt = DiscountTier.objects.filter(tier=customer_tier, category=matched_product.category).first()
        max_allowed = Decimal(str(dt.max_discount_pct)) if dt else Decimal('15')
        if discount_pct > max_allowed:
            requires_approval = True
            warnings.append(f"Discount {discount_pct}% exceeds {customer_tier.capitalize()} limit ({max_allowed}%). Requires Manager Approval.")

    # Calculate line total
    discount_amount = (unit_price * qty * (discount_pct / Decimal('100'))).quantize(Decimal('0.01'))
    line_total = ((unit_price * qty) - discount_amount).quantize(Decimal('0.01'))

    if errors:
        status_tag = 'ERROR'
    elif warnings:
        status_tag = 'WARNING'
    else:
        status_tag = 'VALID'

    # Detect subscription
    raw_sub = row.get('is_subscription') or row.get('subscription') or ''
    if raw_sub:
        is_sub = str(raw_sub).strip().lower() in ('true', '1', 'yes')
    else:
        is_sub = (matched_product.category == 'subscriptions') if matched_product else False

    return {
        'row_index': index,
        'status': status_tag,
        'customer_name': customer_name,
        'customer_email': customer_email,
        'resolved_customer': resolved_customer_display,
        'customer_id': matched_customer.id if matched_customer else None,
        'sku': resolved_sku,
        'product_name': resolved_product_name,
        'product_id': matched_product.id if matched_product else None,
        'quantity': float(qty),
        'unit_price': float(unit_price),
        'discount_pct': float(discount_pct),
        'is_subscription': is_sub,
        'line_total': float(line_total),
        'stock_available': stock_available,
        'payment_terms': payment_terms,
        'notes': notes,
        'requires_approval': requires_approval,
        'warnings': warnings,
        'errors': errors,
    }


def validate_bulk_payload(raw_data: Any, rep_user=None) -> Dict[str, Any]:
    """
    Takes raw CSV string or list of row dicts and performs full pre-flight validation.
    """
    if isinstance(raw_data, str):
        rows = parse_csv_content(raw_data)
    elif isinstance(raw_data, list):
        rows = raw_data
    else:
        return {'success': False, 'error': 'Invalid payload. Expected CSV text or JSON array.'}

    if not rows:
        return {'success': False, 'error': 'No data rows found to import.'}

    validated_rows = []
    valid_count = 0
    warning_count = 0
    error_count = 0
    total_value = Decimal('0')

    for idx, row in enumerate(rows, start=1):
        v_row = validate_single_row(row, idx)
        validated_rows.append(v_row)
        if v_row['status'] == 'VALID':
            valid_count += 1
        elif v_row['status'] == 'WARNING':
            warning_count += 1
        else:
            error_count += 1
        
        if v_row['status'] != 'ERROR':
            total_value += Decimal(str(v_row['line_total']))

    return {
        'success': True,
        'total_rows': len(rows),
        'valid_count': valid_count,
        'warning_count': warning_count,
        'error_count': error_count,
        'total_value': float(total_value),
        'rows': validated_rows,
    }


@transaction.atomic
def commit_bulk_import(validated_rows: List[Dict[str, Any]], rep_user, target_quotation_id: int = None) -> Dict[str, Any]:
    """
    Atomically creates Quotations and QuotationLines from validated rows.
    If target_quotation_id is given, inserts all lines into that specific quotation.
    Otherwise, groups rows by customer and creates separate Quotations.
    """
    created_quotations = []
    created_lines_count = 0

    # Filter out rows with ERROR status
    executable_rows = [r for r in validated_rows if r.get('status') != 'ERROR']
    if not executable_rows:
        return {'success': False, 'error': 'No valid rows available to import.'}

    if target_quotation_id:
        # Append lines to existing quotation
        try:
            quotation = Quotation.objects.select_for_update().get(id=target_quotation_id)
        except Quotation.DoesNotExist:
            return {'success': False, 'error': f'Target quotation ID {target_quotation_id} not found.'}

        for r in executable_rows:
            product = Product.objects.get(id=r['product_id'])
            QuotationLine.objects.create(
                quotation=quotation,
                product=product,
                qty=Decimal(str(r['quantity'])),
                unit_price=Decimal(str(r['unit_price'])),
                discount_pct=Decimal(str(r['discount_pct'])),
                is_subscription=r.get('is_subscription', product.category == 'subscriptions'),
                description=r.get('notes', ''),
            )
            created_lines_count += 1

        quotation.save()
        ApprovalLog.objects.create(
            quotation=quotation,
            actor=rep_user,
            action=ApprovalLog.Action.SUBMITTED if quotation.status == Quotation.Status.PENDING_APPROVAL else ApprovalLog.Action.SUBMITTED,
            note=f"Bulk imported {created_lines_count} line items.",
            role_required=getattr(rep_user, 'role', 'sales_rep'),
        )
        created_quotations.append({
            'id': quotation.id,
            'quote_number': quotation.quote_number,
            'customer_name': quotation.customer.name,
            'total': float(quotation.total_amount),
            'line_count': created_lines_count,
            'status': quotation.status,
        })

    else:
        # Group rows by Customer
        grouped_by_customer: Dict[str, List[Dict[str, Any]]] = {}
        for r in executable_rows:
            cust_key = r.get('customer_name') or r.get('customer_email') or 'Unknown Customer'
            if cust_key not in grouped_by_customer:
                grouped_by_customer[cust_key] = []
            grouped_by_customer[cust_key].append(r)

        for cust_name, items in grouped_by_customer.items():
            first_item = items[0]
            cust_id = first_item.get('customer_id')
            if cust_id:
                customer = Customer.objects.get(id=cust_id)
            else:
                # Auto-create Customer
                email = first_item.get('customer_email') or f"contact@{cust_name.lower().replace(' ', '')}.com"
                customer = Customer.objects.create(
                    name=cust_name,
                    email=email,
                    tier=Customer.Tier.BRONZE,
                )

            # Generate new quotation
            quote_number = f"Q-{uuid.uuid4().hex[:8].upper()}"
            has_approval_warning = any(item.get('requires_approval') for item in items)
            req_approval = Quotation.ApprovalLevel.MANAGER if has_approval_warning else Quotation.ApprovalLevel.NONE

            quotation = Quotation.objects.create(
                quote_number=quote_number,
                customer=customer,
                rep=rep_user,
                status=Quotation.Status.DRAFT,
                required_approval_level=req_approval,
                payment_terms=first_item.get('payment_terms') or 'Net 30 Days',
                notes=first_item.get('notes') or f"Bulk created on {timezone.now().strftime('%Y-%m-%d')}",
                portal_token=str(uuid.uuid4()),
            )

            # Create line items
            for item in items:
                product = Product.objects.get(id=item['product_id'])
                QuotationLine.objects.create(
                    quotation=quotation,
                    product=product,
                    qty=Decimal(str(item['quantity'])),
                    unit_price=Decimal(str(item['unit_price'])),
                    discount_pct=Decimal(str(item['discount_pct'])),
                    is_subscription=item.get('is_subscription', product.category == 'subscriptions'),
                    description=item.get('notes', ''),
                )
                created_lines_count += 1

            quotation.save()
            ApprovalLog.objects.create(
                quotation=quotation,
                actor=rep_user,
                action=ApprovalLog.Action.SUBMITTED if quotation.status == Quotation.Status.PENDING_APPROVAL else ApprovalLog.Action.SUBMITTED,
                note=f"Bulk imported quotation with {len(items)} line items.",
                role_required=getattr(rep_user, 'role', 'sales_rep'),
            )
            
            created_quotations.append({
                'id': quotation.id,
                'quote_number': quotation.quote_number,
                'customer_name': customer.name,
                'total': float(quotation.total_amount),
                'line_count': len(items),
                'status': quotation.status,
                'required_approval': quotation.get_required_approval_level_display(),
            })

    return {
        'success': True,
        'message': f"Successfully created {len(created_quotations)} quotation(s) with {created_lines_count} line item(s).",
        'quotations': created_quotations,
        'total_lines': created_lines_count,
    }


def generate_csv_template() -> str:
    """Returns sample CSV template content with popular products and customer examples."""
    # Fetch sample active products
    sample_products = Product.objects.filter(is_active=True)[:4]
    
    sample_customers = list(Customer.objects.all()[:4])
    sample_products = list(Product.objects.filter(is_active=True)[:6])

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'customer_name',
        'customer_email',
        'sku',
        'product_name',
        'quantity',
        'unit_price',
        'discount_pct',
        'payment_terms',
        'notes',
    ])

    if sample_products:
        for idx, p in enumerate(sample_products):
            cust = sample_customers[idx % len(sample_customers)] if sample_customers else None
            cust_name = cust.name if cust else 'Aravali Healthcare'
            cust_email = cust.email if cust and cust.email else 'contact@enterprise.com'
            writer.writerow([
                cust_name,
                cust_email,
                p.sku or 'IN-LAP14',
                p.name,
                '4',
                str(p.base_price),
                '8',
                'Net 30 Days',
                'Enterprise quarterly order',
            ])
    else:
        writer.writerow([
            'Aravali Healthcare',
            'orders@aravalihealthcare.com',
            'IN-LAP14',
            'BusinessBook Pro 14',
            '4',
            '84900',
            '8',
            'Net 30 Days',
            'Hospital clinic workstations',
        ])

    return output.getvalue()
