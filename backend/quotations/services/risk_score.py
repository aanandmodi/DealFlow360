"""
Blended Discount Risk Score Algorithm & Approval State Engine — Person A.
"""

from decimal import Decimal
from typing import NamedTuple, List
from quotations.models import (
    DiscountTier, ApprovalChainRule, Quotation, QuotationLine, ApprovalLog,
)


class LineRiskDetail(NamedTuple):
    """Risk detail for a single quotation line."""
    line_id: int
    product_name: str
    category_name: str
    discount_percent: Decimal
    ceiling: Decimal
    overage: Decimal
    line_value: Decimal
    policy_status: str  # 'ok', 'over_limit'


class RiskScoreResult(NamedTuple):
    """Full risk score computation result."""
    blended_risk_score: Decimal
    has_any_breach: bool
    required_approval_level: str
    requires_finance: bool
    line_details: List[LineRiskDetail]
    total_order_value: Decimal
    total_weighted_overage: Decimal


def get_ceiling_for_line(category: str, customer_tier: str) -> Decimal:
    """
    Get discount ceiling for a product category and customer tier.
    """
    try:
        dt = DiscountTier.objects.filter(tier=customer_tier, category=category).first()
        if dt:
            return Decimal(str(dt.max_discount_pct))
    except Exception:
        pass

    fallback_map = {
        'gold': {'hardware': Decimal('15'), 'services': Decimal('10'), 'subscriptions': Decimal('15'), 'software': Decimal('20')},
        'silver': {'hardware': Decimal('10'), 'services': Decimal('7'), 'subscriptions': Decimal('10'), 'software': Decimal('15')},
        'bronze': {'hardware': Decimal('5'), 'services': Decimal('3'), 'subscriptions': Decimal('5'), 'software': Decimal('10')},
    }
    return fallback_map.get(customer_tier, {}).get(category, Decimal('5'))


def compute_risk_score(quotation: Quotation) -> RiskScoreResult:
    """
    Compute blended discount risk score for a quotation.
    """
    lines = quotation.lines.select_related('product').all()
    customer_tier = quotation.customer.tier.lower() if quotation.customer else 'bronze'

    line_details: List[LineRiskDetail] = []
    total_weighted_overage = Decimal('0')
    total_order_value = Decimal('0')
    has_any_breach = False

    for line in lines:
        category = str(line.product.category).lower() if line.product else 'hardware'
        ceiling = get_ceiling_for_line(category=category, customer_tier=customer_tier)
        discount = Decimal(str(line.discount_pct))
        overage = max(Decimal('0'), discount - ceiling)
        line_value = Decimal(str(line.qty * line.unit_price))

        if overage > 0:
            has_any_breach = True

        total_weighted_overage += overage * line_value
        total_order_value += line_value

        line_details.append(LineRiskDetail(
            line_id=line.pk,
            product_name=line.product.name if line.product else 'Unknown',
            category_name=line.product.get_category_display() if hasattr(line.product, 'get_category_display') else category.title(),
            discount_percent=discount,
            ceiling=ceiling,
            overage=overage,
            line_value=line_value,
            policy_status='over_limit' if overage > 0 else 'ok',
        ))

    if total_order_value > 0:
        blended_risk_score = (total_weighted_overage / total_order_value).quantize(Decimal('0.01'))
    else:
        blended_risk_score = Decimal('0')

    required_approval_level = Quotation.ApprovalLevel.NONE
    requires_finance = False

    if has_any_breach or blended_risk_score > Decimal('0'):
        rule = ApprovalChainRule.objects.filter(
            min_over_pct__lte=blended_risk_score,
            max_over_pct__gte=blended_risk_score,
        ).first()

        if rule:
            if rule.requires_finance:
                required_approval_level = Quotation.ApprovalLevel.MANAGER_FINANCE
                requires_finance = True
            elif rule.requires_manager:
                required_approval_level = Quotation.ApprovalLevel.MANAGER
            else:
                required_approval_level = Quotation.ApprovalLevel.NONE
        else:
            if blended_risk_score >= Decimal('5') or any(d.overage >= Decimal('5') for d in line_details):
                required_approval_level = Quotation.ApprovalLevel.MANAGER_FINANCE
                requires_finance = True
            else:
                required_approval_level = Quotation.ApprovalLevel.MANAGER

    return RiskScoreResult(
        blended_risk_score=blended_risk_score,
        has_any_breach=has_any_breach,
        required_approval_level=required_approval_level,
        requires_finance=requires_finance,
        line_details=line_details,
        total_order_value=total_order_value,
        total_weighted_overage=total_weighted_overage,
    )


def submit_quotation(quotation: Quotation, actor) -> RiskScoreResult:
    """
    Submit quotation: compute risk score, update status, and log.
    """
    result = compute_risk_score(quotation)

    quotation.blended_risk_score = result.blended_risk_score
    quotation.required_approval_level = result.required_approval_level
    quotation.manager_approved = False
    quotation.finance_approved = False

    if result.required_approval_level == Quotation.ApprovalLevel.NONE:
        quotation.status = Quotation.Status.APPROVED
    else:
        quotation.status = Quotation.Status.PENDING_APPROVAL

    quotation.save()

    ApprovalLog.objects.create(
        quotation=quotation,
        actor=actor,
        action=ApprovalLog.Action.SUBMITTED,
        role_required='sales_manager' if result.required_approval_level != Quotation.ApprovalLevel.NONE else 'none',
        blended_risk_score_at_action=result.blended_risk_score,
        note=f"Submitted with blended risk score {result.blended_risk_score}%. Required level: {result.required_approval_level}.",
    )

    return result


def approve_quotation(quotation: Quotation, actor, reason: str = '') -> bool:
    """
    Advance approval chain.
    """
    if quotation.status != Quotation.Status.PENDING_APPROVAL:
        raise ValueError(f"Cannot approve quotation in status: {quotation.status}")

    user_role = getattr(actor, 'role', 'sales_rep')

    if user_role in ('sales_manager', 'admin') and not quotation.manager_approved:
        quotation.manager_approved = True
        ApprovalLog.objects.create(
            quotation=quotation,
            actor=actor,
            action=ApprovalLog.Action.APPROVED,
            role_required='sales_manager',
            blended_risk_score_at_action=quotation.blended_risk_score,
            note=reason or 'Approved by Sales Manager',
        )
        if quotation.required_approval_level != Quotation.ApprovalLevel.MANAGER_FINANCE:
            quotation.status = Quotation.Status.APPROVED
            quotation.save()
            return True
        else:
            quotation.save()
            return False

    elif user_role in ('finance', 'admin') and (quotation.manager_approved or user_role == 'admin'):
        quotation.finance_approved = True
        quotation.manager_approved = True
        quotation.status = Quotation.Status.APPROVED
        quotation.save()
        ApprovalLog.objects.create(
            quotation=quotation,
            actor=actor,
            action=ApprovalLog.Action.APPROVED,
            role_required='finance',
            blended_risk_score_at_action=quotation.blended_risk_score,
            note=reason or 'Approved by Finance Director',
        )
        return True

    elif user_role == 'admin':
        quotation.manager_approved = True
        quotation.finance_approved = True
        quotation.status = Quotation.Status.APPROVED
        quotation.save()
        ApprovalLog.objects.create(
            quotation=quotation,
            actor=actor,
            action=ApprovalLog.Action.APPROVED,
            role_required='admin',
            blended_risk_score_at_action=quotation.blended_risk_score,
            note=reason or 'Approved by Admin override',
        )
        return True
    else:
        raise ValueError(f"User {actor.username} ({user_role}) cannot approve at this stage.")


def reject_quotation(quotation: Quotation, actor, reason: str = ''):
    """
    Reject a quotation.
    """
    if quotation.status != Quotation.Status.PENDING_APPROVAL:
        raise ValueError(f"Cannot reject quotation in status: {quotation.status}")

    quotation.status = Quotation.Status.REJECTED
    quotation.save()

    ApprovalLog.objects.create(
        quotation=quotation,
        actor=actor,
        action=ApprovalLog.Action.REJECTED,
        role_required=getattr(actor, 'role', 'sales_manager'),
        blended_risk_score_at_action=quotation.blended_risk_score,
        note=reason or 'Rejected by reviewer',
    )


def return_quotation(quotation: Quotation, actor, reason: str = ''):
    """
    Return quotation to rep for revision.
    """
    if quotation.status != Quotation.Status.PENDING_APPROVAL:
        raise ValueError(f"Cannot return quotation in status: {quotation.status}")

    quotation.status = Quotation.Status.DRAFT
    quotation.manager_approved = False
    quotation.finance_approved = False
    quotation.save()

    ApprovalLog.objects.create(
        quotation=quotation,
        actor=actor,
        action=ApprovalLog.Action.RETURNED,
        role_required=getattr(actor, 'role', 'sales_manager'),
        blended_risk_score_at_action=quotation.blended_risk_score,
        note=reason or 'Returned to rep for revision',
    )
