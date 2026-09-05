"""
Cryptographic verification and Indian Rupee financial utilities for DealFlow360.
Provides HMAC-SHA256 digital document signature, tamper detection, and currency words.
"""
import hmac
import hashlib
from decimal import Decimal
from django.conf import settings


def generate_quotation_signature(quote) -> str:
    """
    Computes a deterministic HMAC-SHA256 signature for a quotation.
    Binds the quote number, customer ID, total amount, tax amount, status, and creation timestamp
    with the server secret key to guarantee tamper-proof offline verification.
    """
    secret = settings.SECRET_KEY.encode('utf-8')
    created_iso = quote.created_at.isoformat() if hasattr(quote, 'created_at') and quote.created_at else ''
    total_val = f"{quote.total_amount:.2f}"
    tax_val = f"{quote.tax_amount:.2f}"
    
    payload = f"{quote.quote_number}|{quote.customer_id}|{total_val}|{tax_val}|{quote.status}|{created_iso}"
    sig = hmac.new(secret, payload.encode('utf-8'), hashlib.sha256).hexdigest()
    return sig


def verify_quotation_signature(quote, provided_signature: str) -> bool:
    """Verifies whether the provided signature matches the quotation's live data signature."""
    if not provided_signature:
        return False
    expected = generate_quotation_signature(quote)
    return hmac.compare_digest(expected.lower(), provided_signature.lower())


def amount_to_words_inr(amount) -> str:
    """
    Converts a numerical INR amount into formal Indian numbering currency words.
    Example: 125000 -> "One Lakh Twenty Five Thousand Rupees Only"
    """
    try:
        amt = Decimal(str(amount))
    except Exception:
        return ""
    
    units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"]
    teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    def convert_two_digits(n):
        if n < 10:
            return units[n]
        if n < 20:
            return teens[n - 10]
        return (tens[n // 10] + (" " + units[n % 10] if n % 10 != 0 else "")).strip()

    def convert_three_digits(n):
        res = ""
        if n >= 100:
            res += units[n // 100] + " Hundred "
            n %= 100
        if n > 0:
            res += convert_two_digits(n)
        return res.strip()

    rupees = int(amt)
    paise = int(round((amt - Decimal(rupees)) * 100))

    if rupees == 0 and paise == 0:
        return "Zero Rupees Only"

    crores = rupees // 10000000
    rupees %= 10000000

    lakhs = rupees // 100000
    rupees %= 100000

    thousands = rupees // 1000
    rupees %= 1000

    hundreds = rupees

    words = []
    if crores > 0:
        words.append(convert_three_digits(crores) + " Crore")
    if lakhs > 0:
        words.append(convert_two_digits(lakhs) + " Lakh")
    if thousands > 0:
        words.append(convert_two_digits(thousands) + " Thousand")
    if hundreds > 0:
        words.append(convert_three_digits(hundreds))

    result = " ".join(words).strip() + " Rupees"
    if paise > 0:
        result += f" and {convert_two_digits(paise)} Paise"
    result += " Only"
    return result
