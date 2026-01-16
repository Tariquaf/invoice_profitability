import frappe
from frappe import _
from frappe.utils import flt

@frappe.whitelist()
def get_valuation_rates(item_codes, posting_date, company):
    """
    Fetch the *last purchase price* for items based on posting_date.
    Fallbacks:
      1) Purchase Invoice Item.rate (most recent on or before posting_date)
      2) Purchase Receipt Item.rate (most recent on or before posting_date)
      3) Stock Ledger Entry.valuation_rate (most recent on or before posting_date)
      4) Item.valuation_rate (Item master fallback)
    """
    if isinstance(item_codes, str):
        import json
        item_codes = json.loads(item_codes)

    if not item_codes:
        return {}

    valuation_map = {}

    for item_code in item_codes:
        if not item_code:
            continue

        rate = None

        # 1) Most recent Purchase Invoice Item.rate
        pi = frappe.db.sql("""
            SELECT pii.rate
            FROM `tabPurchase Invoice Item` pii
            JOIN `tabPurchase Invoice` pi ON pii.parent = pi.name
            WHERE pii.item_code = %s
              AND pi.company = %s
              AND pi.posting_date <= %s
              AND pi.docstatus = 1
            ORDER BY pi.posting_date DESC, pi.posting_time DESC, pi.creation DESC
            LIMIT 1
        """, (item_code, company, posting_date), as_dict=1)

        if pi and pi[0].get('rate') is not None:
            rate = flt(pi[0].rate)

        # 2) If not found, try Purchase Receipt Item.rate
        if rate is None:
            pr = frappe.db.sql("""
                SELECT pri.rate
                FROM `tabPurchase Receipt Item` pri
                JOIN `tabPurchase Receipt` pr ON pri.parent = pr.name
                WHERE pri.item_code = %s
                  AND pr.company = %s
                  AND pr.posting_date <= %s
                  AND pr.docstatus = 1
                ORDER BY pr.posting_date DESC, pr.posting_time DESC, pr.creation DESC
                LIMIT 1
            """, (item_code, company, posting_date), as_dict=1)

            if pr and pr[0].get('rate') is not None:
                rate = flt(pr[0].rate)

        # 3) Fallback to Stock Ledger Entry.valuation_rate (most recent before date)
        if rate is None:
            sle = frappe.db.sql("""
                SELECT valuation_rate
                FROM `tabStock Ledger Entry`
                WHERE item_code = %s
                  AND company = %s
                  AND posting_date <= %s
                  AND valuation_rate IS NOT NULL
                  AND valuation_rate > 0
                  AND is_cancelled = 0
                ORDER BY posting_date DESC, posting_time DESC, creation DESC
                LIMIT 1
            """, (item_code, company, posting_date), as_dict=1)

            if sle and sle[0].get('valuation_rate') is not None:
                rate = flt(sle[0].valuation_rate)

        # 4) Final fallback: Item master valuation_rate (if any)
        if rate is None:
            item_valuation = frappe.db.get_value('Item', item_code, 'valuation_rate')
            if item_valuation:
                rate = flt(item_valuation)
            else:
                rate = 0.0

        valuation_map[item_code] = rate

    return valuation_map
