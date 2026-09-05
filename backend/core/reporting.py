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
    if request.query_params.get('export') in ('xlsx','pdf'):
        return report_file(rows, request.query_params['export'])
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



def report_file(rows, kind):
    keys = ['quote_number','customer','rep','status','amount','discount','margin','created']
    headers = ['Quotation','Customer','Representative','Stage','Net INR','Discount INR','Margin %','Created']
    output = BytesIO()
    if kind == 'xlsx':
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment
        from openpyxl.utils import get_column_letter
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = 'Deal performance'
        sheet.append(headers)
        for row in rows:
            sheet.append([safe_cell(row[k]) if isinstance(row[k],str) else row[k] for k in keys])
        for cell in sheet[1]:
            cell.fill = PatternFill('solid',fgColor='245B49')
            cell.font = Font(color='FFFFFF',bold=True)
            cell.alignment = Alignment(vertical='center')
        sheet.row_dimensions[1].height = 28
        for index,width in enumerate([23,34,24,24,20,20,15,18],1):
            sheet.column_dimensions[get_column_letter(index)].width = width
        for row in sheet.iter_rows(min_row=2):
            for cell in row:
                cell.alignment = Alignment(vertical='center')
            for index in (4,5):
                row[index].number_format = '"INR "#,##0.00'
            row[7].number_format = 'dd mmm yyyy'
        sheet.freeze_panes='A2'
        sheet.auto_filter.ref=sheet.dimensions
        workbook.save(output)
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    else:
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib import colors
        from xml.sax.saxutils import escape
        styles=getSampleStyleSheet()
        styles['Normal'].fontSize=8
        styles['Normal'].leading=12
        doc=SimpleDocTemplate(output,pagesize=landscape(A4),leftMargin=32,rightMargin=32,topMargin=32,bottomMargin=32)
        content=[Paragraph('DealFlow360 | Deal performance',styles['Title']),
            Paragraph(f'{len(rows)} quotations | Currency: INR | Generated {timezone.localdate()}',styles['Normal']),Spacer(1,20)]
        data=[headers]
        for row in rows:
            data.append([Paragraph(escape(f'{row[k]:,.2f}' if k in ('amount','discount','margin') else str(row[k])),styles['Normal']) for k in keys])
        table=Table(data,colWidths=[90,150,95,90,100,95,60,85],repeatRows=1)
        table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#245B49')),('TEXTCOLOR',(0,0),(-1,0),colors.white),
            ('FONTSIZE',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),10),
            ('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,-1),.5,colors.HexColor('#E1E6D9'))]))
        content.append(table)
        def footer(canvas, doc):
            canvas.setFont('Helvetica',8)
            canvas.setFillColor(colors.HexColor('#6D7B60'))
            canvas.drawString(32,18,'DealFlow360 - Internal sales report')
            canvas.drawRightString(810,18,f'Page {doc.page}')
        doc.build(content,onFirstPage=footer,onLaterPages=footer)
        content_type='application/pdf'
    response=HttpResponse(output.getvalue(),content_type=content_type)
    response['Content-Disposition']=f'attachment; filename="dealflow-report.{kind}"'
    return response
