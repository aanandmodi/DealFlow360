"""
Quotations app views — comprehensive implementation of Person A's Core Deal Engine
with full support for Person C's pipeline/dashboard queries and Person B's integrations.
"""

import uuid
import csv
import io
import itertools
from decimal import Decimal
from django.shortcuts import get_object_or_404
from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from core.permissions import IsInternalUser as IsAuthenticated
from core.access import quote_for, scoped_quotes, editable, require_roles
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import (
    Quotation, QuotationLine, Customer, Product, DiscountTier, ApprovalLog, ProductVariant,
)
from .serializers import (
    QuotationSerializer, QuotationListSerializer, QuotationLineSerializer,
    ApprovalLogSerializer, CustomerSerializer, ProductSerializer,
    DiscountTierSerializer,
)
from .services.risk_score import (
    compute_risk_score, submit_quotation, approve_quotation,
    reject_quotation, return_quotation,
)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def quotation_list(request):
    """
    GET: List quotations with optional filters (status, rep, customer).
    POST: Create a new quotation.
    """
    if request.method == 'GET':
        qs = scoped_quotes(request.user)
        stat = request.query_params.get('status')
        if stat:
            qs = qs.filter(status=stat)
        rep_id = request.query_params.get('rep')
        if rep_id:
            qs = qs.filter(rep_id=rep_id)
        customer_id = request.query_params.get('customer')
        if customer_id:
            qs = qs.filter(customer_id=customer_id)

        user = request.user
        if user.is_authenticated and getattr(user, 'role', None) == 'sales_rep':
            qs = qs.filter(rep=user)

        serializer = QuotationListSerializer(qs, many=True)
        if request.query_params.get('page') or request.query_params.get('paginated') == 'true':
            return Response({
                'count': qs.count(),
                'results': serializer.data,
            })
        return Response(serializer.data)

    elif request.method == 'POST':
        data = request.data
        cust_id = data.get('customer') or data.get('customer_id')
        if not cust_id:
            return Response({'error': 'Customer ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        cust_id = serializers.IntegerField(min_value=1).run_validation(cust_id)
        try:
            customer = Customer.objects.get(id=cust_id)
        except Customer.DoesNotExist:
            return Response({'error': 'Customer not found.'}, status=status.HTTP_404_NOT_FOUND)

        quote_number = f"Q-{uuid.uuid4().hex[:12].upper()}"

        q = Quotation.objects.create(
            quote_number=quote_number,
            customer=customer,
            rep=request.user,
            status=Quotation.Status.DRAFT,
            notes=serializers.CharField(max_length=10000, allow_blank=True).run_validation(data.get('notes', '')),
            payment_terms=serializers.ChoiceField(choices=['Net 30 Days', 'Net 60 Days', 'Due on Receipt']).run_validation(data.get('payment_terms', 'Net 30 Days')),
            portal_token=str(uuid.uuid4()),
        )
        return Response(QuotationSerializer(q).data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def quotation_detail(request, pk):
    """
    GET: Retrieve quotation with all lines and logs.
    PATCH: Update quotation header fields.
    DELETE: Delete quotation (draft only).
    """
    q = quote_for(request, pk, lock=request.method != 'GET')
    if request.method != 'GET':
        editable(q)

    if request.method == 'GET':
        return Response(QuotationSerializer(q).data)

    elif request.method == 'PATCH':
        data = request.data
        if 'valid_until' in data:
            data = dict(data)
            data['valid_until'] = serializers.DateField(allow_null=True).run_validation(data['valid_until'])
        if 'notes' in data:
            q.notes = serializers.CharField(max_length=10000, allow_blank=True).run_validation(data['notes'])
        if 'payment_terms' in data:
            q.payment_terms = serializers.ChoiceField(choices=['Net 30 Days', 'Net 60 Days', 'Due on Receipt']).run_validation(data['payment_terms'])
        if 'valid_until' in data:
            q.valid_until = data['valid_until']
        if 'customer' in data or 'customer_id' in data:
            cid = serializers.IntegerField(min_value=1).run_validation(data.get('customer') or data.get('customer_id'))
            try:
                q.customer = Customer.objects.get(id=cid)
            except Customer.DoesNotExist:
                raise ValidationError('Customer not found.')
        q.save()
        audit_edit(q, request.user)
        return Response(QuotationSerializer(q).data)

    elif request.method == 'DELETE':
        q.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quotation_create(request):
    """Helper create endpoint for Person C compatibility."""
    return quotation_list.cls().post(request)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def quotation_lines(request, pk):
    """
    GET: List line items on a quotation.
    POST: Add a new line item to a quotation.
    """
    q = quote_for(request, pk, lock=request.method != 'GET')

    if request.method == 'GET':
        return Response(QuotationLineSerializer(q.lines.all(), many=True).data)

    elif request.method == 'POST':
        editable(q)
        data = request.data
        prod_id = data.get('product') or data.get('product_id')
        if not prod_id:
            return Response({'error': 'Product ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        product = get_object_or_404(Product, pk=serializers.IntegerField(min_value=1).run_validation(prod_id))
        qty, discount_pct = validated_line(data, product)
        from .models import PriceListItem
        price = PriceListItem.objects.filter(product=product, price_list__tier=q.customer.tier,
                    price_list__currency='INR', price_list__is_active=True).first()
        unit_price = price.price if price else product.base_price
        from billing.models import SubscriptionPlan
        plan = None
        if product.is_subscription:
            if data.get('subscription_plan'):
                plan = get_object_or_404(SubscriptionPlan, pk=serializers.IntegerField(min_value=1).run_validation(data['subscription_plan']), product=product, is_active=True)
                unit_price = plan.price
            else:
                plan = SubscriptionPlan.objects.filter(product=product, is_active=True, cycle='monthly').first()
                if plan is None:
                    raise ValidationError('Select an active subscription plan for this product.')
        elif data.get('subscription_plan'):
            raise ValidationError('Plans can only be attached to recurring products.')
        variant = get_object_or_404(ProductVariant, pk=data['variant'], product=product) if data.get('variant') else None
        if variant:
            unit_price += variant.extra_price

        line = QuotationLine.objects.create(
            quotation=q,
            product=product,
            qty=qty,
            unit_price=unit_price,
            discount_pct=discount_pct,
            is_subscription=product.is_subscription, variant=variant, subscription_plan=plan,
            description=(f'{plan.name} · {plan.cycle}' if plan else f"{variant.attribute}: {variant.value}" if variant else product.description[:300])[:300],
        )
        audit_edit(q, request.user)
        return Response(QuotationLineSerializer(line).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def quotation_line_detail(request, pk, line_id):
    """
    PATCH: Update line item quantity or discount.
    DELETE: Remove line item from quotation.
    """
    q = quote_for(request, pk, lock=request.method != 'GET')
    editable(q)
    line = get_object_or_404(QuotationLine, pk=line_id, quotation=q)

    if request.method == 'PATCH':
        data = request.data
        qty, discount = validated_line(data, line.product, line)
        line.qty, line.discount_pct = qty, discount
        line.save()
        audit_edit(q, request.user)
        return Response(QuotationLineSerializer(line).data)

    elif request.method == 'DELETE':
        line.delete()
        audit_edit(q, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quotation_submit(request, pk):
    """
    Submit quotation: runs blended discount risk score algorithm, sets required approval level.
    """
    q = quote_for(request, pk, lock=request.method != 'GET')
    if not q.lines.exists():
        return Response({'error': 'Cannot submit a quotation with no line items.'}, status=status.HTTP_400_BAD_REQUEST)

    editable(q)
    result = submit_quotation(q, request.user)

    return Response({
        'status': q.status,
        'blended_risk_score': str(result.blended_risk_score),
        'required_approval_level': result.required_approval_level,
        'requires_finance': result.requires_finance,
        'has_any_breach': result.has_any_breach,
        'message': f"Quotation submitted with blended risk score {result.blended_risk_score}%.",
        'line_details': [
            {
                'line_id': d.line_id,
                'product_name': d.product_name,
                'category_name': d.category_name,
                'discount_percent': str(d.discount_percent),
                'ceiling': str(d.ceiling),
                'overage': str(d.overage),
                'line_value': str(d.line_value),
                'policy_status': d.policy_status,
            }
            for d in result.line_details
        ],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quotation_approve(request, pk):
    require_roles(request.user, 'sales_manager', 'finance', 'admin')
    """Advance approval chain."""
    q = quote_for(request, pk, lock=request.method != 'GET')
    reason = request.data.get('reason', '')
    try:
        fully_approved = approve_quotation(q, request.user, reason)
        return Response({
            'status': q.status,
            'fully_approved': fully_approved,
            'manager_approved': q.manager_approved,
            'finance_approved': q.finance_approved,
            'message': 'Quotation approved successfully.',
        })
    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quotation_reject(request, pk):
    require_roles(request.user, 'sales_manager', 'finance', 'admin')
    """Reject quotation."""
    q = quote_for(request, pk, lock=request.method != 'GET')
    reason = request.data.get('reason', '')
    try:
        reject_quotation(q, request.user, reason)
        return Response({'status': q.status, 'message': 'Quotation rejected.'})
    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quotation_return(request, pk):
    require_roles(request.user, 'sales_manager', 'finance', 'admin')
    """Return quotation to rep for revision."""
    q = quote_for(request, pk, lock=request.method != 'GET')
    reason = request.data.get('reason', '')
    try:
        return_quotation(q, request.user, reason)
        return Response({'status': q.status, 'message': 'Quotation returned for revision.'})
    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quotation_confirm(request, pk):
    """Confirm an approved quotation."""
    q = quote_for(request, pk, lock=request.method != 'GET')
    if q.status not in (Quotation.Status.APPROVED, Quotation.Status.CONFIRMED):
        return Response({'error': 'Only approved quotations can be confirmed.'}, status=status.HTTP_400_BAD_REQUEST)
    from billing.services.lifecycle import confirm_order
    confirm_order(q, request.user)
    return Response({'status': q.status, 'message': 'Quotation confirmed.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quotation_transition(request, pk):
    """
    Transition quotation stage directly from the Kanban board.
    Enforces role-based permissions and state machine rules.
    """
    target = request.data.get('target_status')
    if not target:
        return Response({'error': 'Target status is required.'}, status=status.HTTP_400_BAD_REQUEST)

    q = quote_for(request, pk, lock=True)
    curr = q.status
    user_role = getattr(request.user, 'role', 'sales_rep')

    try:
        if target == curr:
            return Response({'status': q.status, 'message': 'Already in this status.'})

        # Locked / Terminal stages cannot transition except to cancelled
        if curr in (Quotation.Status.CONFIRMED, Quotation.Status.FULFILLMENT, Quotation.Status.INVOICED, Quotation.Status.PAID):
            if target != Quotation.Status.CANCELLED:
                return Response({'error': f'Order {q.quote_number} is already confirmed and active. Cancel the quotation to revise.'}, status=status.HTTP_400_BAD_REQUEST)

        if target == Quotation.Status.PENDING_APPROVAL:
            if curr not in (Quotation.Status.DRAFT, Quotation.Status.UNDER_NEGOTIATION, Quotation.Status.SENT):
                return Response({'error': f'Cannot submit quotation from {curr}.'}, status=status.HTTP_400_BAD_REQUEST)
            res = submit_quotation(q, request.user)
            return Response({'status': q.status, 'message': f'Quotation submitted for review (Risk score: {res.blended_risk_score}%).'})

        elif target == Quotation.Status.APPROVED:
            if user_role not in ('sales_manager', 'finance', 'admin'):
                return Response({'error': 'Only Sales Managers, Finance Directors, or Admins can approve deals.'}, status=status.HTTP_403_FORBIDDEN)
            if curr == Quotation.Status.DRAFT:
                submit_quotation(q, request.user)
            if q.status == Quotation.Status.PENDING_APPROVAL:
                approve_quotation(q, request.user, 'Approved via Kanban board action.')
            return Response({'status': q.status, 'message': 'Quotation approved.'})

        elif target == Quotation.Status.SENT:
            if curr not in (Quotation.Status.APPROVED, Quotation.Status.UNDER_NEGOTIATION):
                return Response({'error': 'Quotation must be approved before sending to customer.'}, status=status.HTTP_400_BAD_REQUEST)
            if not q.portal_token:
                from portal.models import PortalToken
                pt = PortalToken.objects.create(email=q.customer.email, quotation=q)
                q.portal_token = str(pt.token)
            q.status = Quotation.Status.SENT
            q.save(update_fields=['status', 'portal_token'])
            ApprovalLog.objects.create(quotation=q, actor=request.user, action='sent', role_required='sales_rep', note='Dispatched to customer via Kanban board.')
            return Response({'status': q.status, 'message': 'Quotation marked as Sent with active portal link.'})

        elif target == Quotation.Status.UNDER_NEGOTIATION:
            q.status = Quotation.Status.UNDER_NEGOTIATION
            q.save(update_fields=['status'])
            ApprovalLog.objects.create(quotation=q, actor=request.user, action='negotiation', role_required='sales_rep', note='Portal negotiation active.')
            return Response({'status': q.status, 'message': 'Quotation marked as Under Negotiation.'})

        elif target == Quotation.Status.CONFIRMED:
            if curr not in (Quotation.Status.APPROVED, Quotation.Status.SENT, Quotation.Status.UNDER_NEGOTIATION):
                return Response({'error': 'Only approved or sent quotes can be confirmed.'}, status=status.HTTP_400_BAD_REQUEST)
            from billing.services.lifecycle import confirm_order
            confirm_order(q, request.user)
            return Response({'status': q.status, 'message': 'Quotation confirmed and converted to Order!'})

        elif target == Quotation.Status.CANCELLED:
            q.status = Quotation.Status.CANCELLED
            q.save(update_fields=['status'])
            ApprovalLog.objects.create(quotation=q, actor=request.user, action='cancelled', role_required=user_role, note='Cancelled via Kanban.')
            return Response({'status': q.status, 'message': 'Quotation cancelled.'})

        elif target == Quotation.Status.DRAFT:
            if curr not in (Quotation.Status.REJECTED, Quotation.Status.PENDING_APPROVAL, Quotation.Status.SENT):
                return Response({'error': f'Cannot reset quotation to draft from {curr}.'}, status=status.HTTP_400_BAD_REQUEST)
            q.status = Quotation.Status.DRAFT
            q.manager_approved = False
            q.finance_approved = False
            q.save(update_fields=['status', 'manager_approved', 'finance_approved'])
            ApprovalLog.objects.create(quotation=q, actor=request.user, action='returned', role_required=user_role, note='Reset to draft for editing.')
            return Response({'status': q.status, 'message': 'Quotation reset to Draft.'})

        return Response({'error': f'Unsupported transition to {target}.'}, status=status.HTTP_400_BAD_REQUEST)

    except (ValueError, ValidationError) as err:
        return Response({'error': str(err)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def customer_import_csv(request):
    """
    Bulk import customers from CSV file or raw CSV text.
    Expected columns: name, email, tier (bronze/silver/gold), phone, company
    """
    csv_file = request.FILES.get('file')
    csv_text = request.data.get('csv_text')

    if not csv_file and not csv_text:
        return Response({'error': 'Please provide either a CSV file or csv_text string.'}, status=status.HTTP_400_BAD_REQUEST)

    if csv_file:
        try:
            content = csv_file.read().decode('utf-8', errors='replace')
        except Exception as e:
            return Response({'error': f'Failed to decode file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
    else:
        content = csv_text

    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames:
        return Response({'error': 'CSV contains no valid headers.'}, status=status.HTTP_400_BAD_REQUEST)

    headers = [h.strip().lower() for h in reader.fieldnames if h]
    if 'name' not in headers:
        return Response({'error': "CSV must contain at least a 'name' column."}, status=status.HTTP_400_BAD_REQUEST)

    created_count = 0
    updated_count = 0
    imported = []

    with transaction.atomic():
        for i, row in enumerate(reader, start=1):
            row_normalized = {k.strip().lower(): v.strip() for k, v in row.items() if k}
            name = row_normalized.get('name')
            if not name:
                continue
            email = row_normalized.get('email', f"{name.lower().replace(' ', '')}@example.com")
            tier_raw = row_normalized.get('tier', 'bronze').lower()
            if tier_raw not in ('gold', 'silver', 'bronze'):
                tier_raw = 'bronze'
            phone = row_normalized.get('phone', '')
            company = row_normalized.get('company', '')

            cust, created = Customer.objects.update_or_create(
                name=name,
                defaults={
                    'email': email,
                    'tier': tier_raw,
                    'phone': phone,
                    'company': company,
                }
            )
            if created:
                created_count += 1
            else:
                updated_count += 1
            imported.append({'id': cust.id, 'name': cust.name, 'email': cust.email, 'tier': cust.tier, 'created': created})

    return Response({
        'success': True,
        'created_count': created_count,
        'updated_count': updated_count,
        'total': created_count + updated_count,
        'imported': imported[:20],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def product_generate_variants_matrix(request, pk):
    """
    Cartesian Product Variant Matrix Generator.
    Accepts:
      attributes: [
        { name: "Memory", values: ["16GB", "32GB"], price_additions: [0, 15000] },
        { name: "Storage", values: ["512GB", "1TB"], price_additions: [0, 12000] }
      ]
    Generates all Cartesian combinations and bulk creates ProductVariant records.
    """
    user_role = getattr(request.user, 'role', '')
    if user_role not in ('admin', 'sales_manager'):
        return Response({'error': 'Only Admins and Sales Managers can generate product variants.'}, status=status.HTTP_403_FORBIDDEN)

    product = get_object_or_404(Product, pk=pk)
    attributes = request.data.get('attributes', [])
    if not attributes or len(attributes) < 1:
        return Response({'error': 'At least one attribute with values is required.'}, status=status.HTTP_400_BAD_REQUEST)

    attr_value_tuples = []
    for a in attributes:
        vals = a.get('values', [])
        prices = a.get('price_additions', [])
        tuples = []
        for idx, val in enumerate(vals):
            price_add = Decimal(str(prices[idx])) if idx < len(prices) else Decimal('0.00')
            tuples.append((val, price_add))
        attr_value_tuples.append(tuples)

    combos = list(itertools.product(*attr_value_tuples))
    created_variants = []

    with transaction.atomic():
        for combo in combos:
            var_name_parts = [str(t[0]) for t in combo]
            var_name = " / ".join(var_name_parts)
            total_extra_price = sum((t[1] for t in combo), Decimal('0.00'))

            variant, created = ProductVariant.objects.update_or_create(
                product=product,
                attribute="Configuration",
                value=var_name,
                defaults={
                    'extra_price': total_extra_price,
                }
            )
            created_variants.append({
                'id': variant.id,
                'attribute': variant.attribute,
                'value': variant.value,
                'extra_price': str(variant.extra_price),
                'created': created,
            })

    return Response({
        'success': True,
        'product_id': product.id,
        'product_name': product.name,
        'combinations_generated': len(created_variants),
        'variants': created_variants,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def quotation_risk_score(request, pk):
    """Get diagnostic risk score breakdown for approval screen."""
    q = quote_for(request, pk, lock=request.method != 'GET')
    result = compute_risk_score(q)
    return Response({
        'quotation_id': q.pk,
        'blended_risk_score': str(result.blended_risk_score),
        'has_any_breach': result.has_any_breach,
        'required_approval_level': result.required_approval_level,
        'requires_finance': result.requires_finance,
        'total_order_value': str(result.total_order_value),
        'total_weighted_overage': str(result.total_weighted_overage),
        'line_details': [
            {
                'line_id': d.line_id,
                'product_name': d.product_name,
                'category_name': d.category_name,
                'discount_percent': str(d.discount_percent),
                'ceiling': str(d.ceiling),
                'overage': str(d.overage),
                'line_value': str(d.line_value),
                'policy_status': d.policy_status,
            }
            for d in result.line_details
        ],
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def quotation_logs(request, pk):
    """List approval audit logs for a quotation."""
    q = quote_for(request, pk, lock=request.method != 'GET')
    logs = q.approval_logs.select_related('actor').all()
    return Response(ApprovalLogSerializer(logs, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def discount_tiers_list(request):
    """List all discount tiers."""
    tiers = DiscountTier.objects.all()
    return Response({
        'count': tiers.count(),
        'results': DiscountTierSerializer(tiers, many=True).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def customer_list(request):
    """List all customers."""
    customers = Customer.objects.all()
    return Response({
        'count': customers.count(),
        'results': CustomerSerializer(customers, many=True).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def product_list(request):
    """List all products with optional category filter."""
    products = Product.objects.filter(is_active=True).prefetch_related('variants')
    cat = request.query_params.get('category')
    if cat:
        products = products.filter(category=cat)
    data = ProductSerializer(products, many=True).data
    if request.query_params.get('customer'):
        from .models import PriceListItem
        customer = get_object_or_404(Customer, pk=request.query_params['customer'])
        overrides = dict(PriceListItem.objects.filter(price_list__tier=customer.tier, price_list__is_active=True,
                        price_list__currency='INR').values_list('product_id', 'price'))
        for item in data:
            if item['id'] in overrides:
                item['base_price'] = str(overrides[item['id']])
    return Response({'count': products.count(), 'results': data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pipeline_summary(request):
    """Pipeline summary for KPI cards."""
    qs = scoped_quotes(request.user)
    total_count = qs.count()

    pipeline = {}
    for s in Quotation.Status:
        items = qs.filter(status=s.value)
        count = items.count()
        total = sum(q.total_amount for q in items) if count > 0 else 0
        pipeline[s.value] = {'count': count, 'total': total}

    active_statuses = ['draft', 'pending_approval', 'approved', 'sent', 'under_negotiation']
    active_qs = qs.filter(status__in=active_statuses)
    active_total = sum(q.total_amount for q in active_qs)

    pending_count = qs.filter(status='pending_approval').count()
    at_risk = qs.filter(blended_risk_score__gt=5).count()

    closed_won_qs = qs.filter(status__in=['confirmed', 'paid', 'invoiced', 'fulfillment'])
    closed_won_total = sum(q.total_amount for q in closed_won_qs)

    return Response({
        'total_quotations': total_count,
        'active_pipeline_value': active_total,
        'active_pipeline_count': active_qs.count(),
        'pending_approvals': pending_count,
        'at_risk_count': at_risk,
        'closed_won_value': closed_won_total,
        'closed_won_count': closed_won_qs.count(),
        'pipeline_by_status': pipeline,
    })


def validated_line(data, product, line=None):
    quantity = data.get('quantity', data.get('qty', line.qty if line else 1))
    discount = data.get('discount_percent', data.get('discount_pct', line.discount_pct if line else 0))
    qty = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01')).run_validation(quantity)
    pct = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=0, max_value=100).run_validation(discount)
    if product.category == 'hardware' and qty != int(qty):
        raise ValidationError('Hardware quantities must be whole units.')
    if not product.is_active:
        raise ValidationError('This product is inactive.')
    return qty, pct


def audit_edit(q, actor):
    result = compute_risk_score(q)
    q.blended_risk_score = result.blended_risk_score
    q.required_approval_level = result.required_approval_level
    q.save(update_fields=['updated_at', 'blended_risk_score', 'required_approval_level'])
    ApprovalLog.objects.create(quotation=q, actor=actor, action='edited', note='Draft line updated.', role_required=actor.role)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def order_discount(request, pk):
    q = quote_for(request, pk, lock=True)
    editable(q)
    pct = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=0, max_value=100).run_validation(request.data.get('discount_percent'))
    q.lines.update(discount_pct=pct)
    audit_edit(q, request.user)
    return Response(QuotationSerializer(q).data)
