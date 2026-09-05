import csv
from io import StringIO, BytesIO
from decimal import Decimal
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from core.permissions import IsInternalUser
from core.access import scoped_quotes, quote_for, require_roles
from quotations.models import ApprovalLog


def report_quotes(request):
    qs = scoped_quotes(request.user)
    for key, lookup in [('from', 'created_at__date__gte'), ('to', 'created_at__date__lte')]:
        if request.query_params.get(key):
            value = serializers.DateField().run_validation(request.query_params[key])
            qs = qs.filter(**{lookup: value})
    for key, lookup in [('rep', 'rep_id'), ('status', 'status'), ('category', 'lines__product__category')]:
        if request.query_params.get(key):
            qs = qs.filter(**{lookup: request.query_params[key]})
    return qs.distinct()


def safe_cell(value):
    text = str(value)
    return "'" + text if text.lstrip().startswith(('=', '+', '-', '@', '\t', '\r')) else text


@api_view(['GET'])
@permission_classes([IsInternalUser])
def reports(request):
    quotes = list(report_quotes(request))
    rows = [{'id': q.id, 'quote_number': q.quote_number, 'customer': q.customer.name,
             'rep': q.rep.get_full_name() if q.rep else 'Unassigned', 'status': q.status,
             'amount': q.total_amount, 'discount': q.total_discount, 'margin': q.margin_pct,
             'created': q.created_at.date()} for q in quotes]
    if request.query_params.get('export') == 'csv':
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(['Quotation', 'Customer', 'Rep', 'Status', 'Net amount (INR)', 'Discount (INR)', 'Margin %', 'Created'])
        for row in rows:
            writer.writerow([safe_cell(row[k]) for k in ['quote_number','customer','rep','status','amount','discount','margin','created']])
        response = HttpResponse('\ufeff' + output.getvalue(), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="dealflow-report.csv"'
        return response
    stages = {}
    for row in rows:
        stages[row['status']] = stages.get(row['status'], 0) + 1
    won = [r for r in rows if r['status'] in ('confirmed', 'fulfillment', 'invoiced', 'paid')]
    closed = len(won) + sum(1 for r in rows if r['status'] in ('rejected', 'cancelled'))
    return Response({'rows': rows, 'stages': stages, 'currency': 'INR', 'summary': {
        'count': len(rows), 'pipeline': sum((r['amount'] for r in rows if r['status'] in ('draft','pending_approval','approved','sent','under_negotiation')), Decimal(0)),
        'bookings': sum((r['amount'] for r in won), Decimal(0)),
        'win_rate': round(len(won) / closed * 100, 1) if closed else 0,
        'discount': sum((r['discount'] for r in rows), Decimal(0)),
        'margin': round(sum(r['margin'] for r in rows) / len(rows), 1) if rows else 0}})


@api_view(['GET'])
@permission_classes([IsInternalUser])
def quotation_pdf(request, pk):
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors
    from xml.sax.saxutils import escape
    q = quote_for(request, pk)
    output = BytesIO()
    doc = SimpleDocTemplate(output, rightMargin=40, leftMargin=40)
    styles = getSampleStyleSheet()
    content = [Paragraph('DealFlow360 | Quotation', styles['Title']), Spacer(1, 16),
        Paragraph(escape(f'{q.quote_number} · {q.customer.name}'), styles['Heading2']),
        Paragraph(escape(f'Status: {q.get_status_display()} | Currency: INR | {q.payment_terms}'), styles['Normal']), Spacer(1, 20)]
    rows = [['Product', 'Qty', 'Unit INR', 'Discount', 'Net INR']]
    for line in q.lines.select_related('product'):
        rows.append([Paragraph(escape(line.product.name), styles['Normal']), str(line.qty), f'{line.unit_price:,.2f}', f'{line.discount_pct}%', f'{line.line_total:,.2f}'])
    table = Table(rows, colWidths=[195, 45, 80, 60, 100], repeatRows=1)
    table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#124E46')),('TEXTCOLOR',(0,0),(-1,0),colors.white),
        ('BOTTOMPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,-1),12),('VALIGN',(0,0),(-1,-1),'TOP'),
        ('LINEBELOW',(0,0),(-1,-1),0.5,colors.HexColor('#DFE5E0'))]))
    content.extend([table, Spacer(1,20), Paragraph(f'Net: INR {q.total_amount:,.2f}<br/>Tax: INR {q.tax_amount:,.2f}<br/><b>Total: INR {q.total_amount + q.tax_amount:,.2f}</b>', styles['Normal'])])
    doc.build(content)
    response = HttpResponse(output.getvalue(), content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{q.quote_number}.pdf"'
    return response


@api_view(['POST'])
@permission_classes([IsInternalUser])
def nudge(request, pk):
    require_roles(request.user, 'sales_manager', 'finance', 'admin')
    q = quote_for(request, pk, lock=True)
    note = serializers.CharField(max_length=1000).run_validation(request.data.get('reason', 'Manager requested an update on this deal.'))
    ApprovalLog.objects.create(quotation=q, actor=request.user, action='escalated', note=note, role_required='sales_rep')
    return Response({'message': 'Escalation recorded in the deal activity trail.'})
