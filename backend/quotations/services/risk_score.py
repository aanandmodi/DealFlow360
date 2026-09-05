"""
Blended Discount Risk Score Algorithm — the signature mechanic of DealFlow360.

How it works:
1. For each line: get the discount ceiling for that product's category + customer's tier.
   Falls back to the tier-level ceiling if no category-specific ceiling exists.
2. Compute per-line overage = max(0, discount_percent - ceiling).
3. ANY single line breach triggers approval (even if order-level average looks fine).
4. Compute weighted overage: sum(overage * line_value) / total_order_value.
   This catches margin leakage where no single line is badly over, but many lines are each a little over.
5. Map the score to required_approval_level via ApprovalChain thresholds.
6. Log computed score in the ApprovalLog for audit.
"""

from decimal import Decimal
from typing import NamedTuple

from quotations.models import (
    DiscountTier, CategoryDiscountCeiling, ApprovalChain,
    Quotation, ApprovalLog,
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
    line_details: list  # List[LineRiskDetail]
    total_order_value: Decimal
    total_weighted_overage: Decimal


def get_ceiling_for_line(product_category_id: int, customer_tier: str) -> Decimal:
    """
    Get the discount ceiling for a product category + customer tier.
    Falls back to tier-level ceiling if no category-specific ceiling.
    """
    # Try category-specific ceiling first
    try:
        tier = DiscountTier.objects.get(tier_key=customer_tier)
        ceiling = CategoryDiscountCeiling.objects.get(
            category_id=product_category_id,
            discount_tier=tier,
        )
        return ceiling.max_discount_percent
    except (DiscountTier.DoesNotExist, CategoryDiscountCeiling.DoesNotExist):
        pass

    # Fallback to tier-level ceiling
    try:
        tier = DiscountTier.objects.get(tier_key=customer_tier)
        return tier.max_discount_percent
    except DiscountTier.DoesNotExist:
        return Decimal('0')  # No tier configured = no discount allowed


def compute_risk_score(quotation: Quotation) -> RiskScoreResult:
    """
    Compute the blended discount risk score for a quotation.
    Returns a RiskScoreResult with full breakdown.
    """
    lines = quotation.lines.select_related('product__category').all()
    customer_tier = quotation.customer.tier

    line_details = []
    total_weighted_overage = Decimal('0')
    total_order_value = Decimal('0')
    has_any_breach = False

    for line in lines:
        ceiling = get_ceiling_for_line(
            product_category_id=line.product.category_id,
            customer_tier=customer_tier,
        )
        overage = max(Decimal('0'), line.discount_percent - ceiling)
        line_value = line.gross_total  # unit_price * quantity (before discount)

        if overage > 0:
            has_any_breach = True

        total_weighted_overage += overage * line_value
        total_order_value += line_value

        line_details.append(LineRiskDetail(
            line_id=line.pk,
            product_name=line.product.name,
            category_name=line.product.category.name,
            discount_percent=line.discount_percent,
            ceiling=ceiling,
            overage=overage,
            line_value=line_value,
            policy_status='over_limit' if overage > 0 else 'ok',
        ))

    # Compute blended risk score (weighted by line value)
    if total_order_value > 0:
        blended_risk_score = (total_weighted_overage / total_order_value).quantize(Decimal('0.0001'))
    else:
        blended_risk_score = Decimal('0')

    # Determine required approval level from ApprovalChain
    required_approval_level = Quotation.ApprovalLevel.NONE
    requires_finance = False

    if has_any_breach or blended_risk_score > 0:
        # Find the matching approval chain entry
        chain = ApprovalChain.objects.filter(
            is_active=True,
            min_overage_threshold__lte=blended_risk_score,
            max_overage_threshold__gt=blended_risk_score,
        ).first()

        if chain:
            if chain.requires_finance:
                required_approval_level = Quotation.ApprovalLevel.MANAGER_FINANCE
                requires_finance = True
            else:
                required_approval_level = Quotation.ApprovalLevel.MANAGER
        else:
            # Any breach = at minimum Manager approval
            required_approval_level = Quotation.ApprovalLevel.MANAGER

            # High score = Manager + Finance
            if blended_risk_score > Decimal('5'):
                required_approval_level = Quotation.ApprovalLevel.MANAGER_FINANCE
                requires_finance = True

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
    Submit a quotation: compute risk score, update status, log the action.
    Returns the risk score result.
    """
    result = compute_risk_score(quotation)

    # Update quotation with computed values
    quotation.blended_risk_score = result.blended_risk_score
    quotation.required_approval_level = result.required_approval_level
    quotation.manager_approved = False
    quotation.finance_approved = False

    if result.required_approval_level == Quotation.ApprovalLevel.NONE:
        quotation.status = Quotation.Status.APPROVED
    else:
        quotation.status = Quotation.Status.PENDING_APPROVAL

    quotation.save()

    # Log the submission
    ApprovalLog.objects.create(
        quotation=quotation,
        actor=actor,
        action=ApprovalLog.Action.SUBMITTED,
        role_at_action=actor.role,
        blended_risk_score_at_action=result.blended_risk_score,
        reason=f"Submitted with blended risk score {result.blended_risk_score}. "
               f"Approval level: {result.required_approval_level}.",
    )

    return result


def approve_quotation(quotation: Quotation, actor, reason: str = '') -> bool:
    """
    Approve a quotation at the current approval stage.
    Returns True if fully approved, False if more approvals needed.
    """
    if quotation.status != Quotation.Status.PENDING_APPROVAL:
        raise ValueError(f"Cannot approve quotation in status: {quotation.status}")

    if actor.role == 'sales_manager' and not quotation.manager_approved:
        quotation.manager_approved = True
        ApprovalLog.objects.create(
            quotation=quotation,
            actor=actor,
            action=ApprovalLog.Action.APPROVED,
            role_at_action=actor.role,
            blended_risk_score_at_action=quotation.blended_risk_score,
            reason=reason or 'Approved by Sales Manager',
        )

        if quotation.required_approval_level == Quotation.ApprovalLevel.MANAGER:
            quotation.status = Quotation.Status.APPROVED
            quotation.save()
            return True
        else:
            quotation.save()
            return False  # Still needs Finance approval

    elif actor.role == 'finance' and quotation.manager_approved:
        quotation.finance_approved = True
        quotation.status = Quotation.Status.APPROVED
        quotation.save()

        ApprovalLog.objects.create(
            quotation=quotation,
            actor=actor,
            action=ApprovalLog.Action.APPROVED,
            role_at_action=actor.role,
            blended_risk_score_at_action=quotation.blended_risk_score,
            reason=reason or 'Approved by Finance',
        )
        return True

    elif actor.role == 'admin':
        # Admin can approve at any stage
        quotation.manager_approved = True
        quotation.finance_approved = True
        quotation.status = Quotation.Status.APPROVED
        quotation.save()

        ApprovalLog.objects.create(
            quotation=quotation,
            actor=actor,
            action=ApprovalLog.Action.APPROVED,
            role_at_action=actor.role,
            blended_risk_score_at_action=quotation.blended_risk_score,
            reason=reason or 'Approved by Admin (override)',
        )
        return True

    else:
        raise ValueError(
            f"User {actor.username} (role: {actor.role}) cannot approve at this stage. "
            f"Manager approved: {quotation.manager_approved}"
        )


def reject_quotation(quotation: Quotation, actor, reason: str = '') -> None:
    """Reject a quotation."""
    if quotation.status != Quotation.Status.PENDING_APPROVAL:
        raise ValueError(f"Cannot reject quotation in status: {quotation.status}")

    quotation.status = Quotation.Status.REJECTED
    quotation.save()

    ApprovalLog.objects.create(
        quotation=quotation,
        actor=actor,
        action=ApprovalLog.Action.REJECTED,
        role_at_action=actor.role,
        blended_risk_score_at_action=quotation.blended_risk_score,
        reason=reason or 'Rejected',
    )


def return_quotation(quotation: Quotation, actor, reason: str = '') -> None:
    """Return a quotation for revision (back to Draft)."""
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
        role_at_action=actor.role,
        blended_risk_score_at_action=quotation.blended_risk_score,
        reason=reason or 'Returned for revision',
    )
