import frappe
from frappe import _

@frappe.whitelist()
def get_valuation_rates(item_codes, posting_date, company):
    """
    Fetch latest valuation rates for items based on posting date
    """
    if isinstance(item_codes, str):
        import json
        item_codes = json.loads(item_codes)
    
    if not item_codes:
        return {}
    
    valuation_map = {}
    
    for item_code in item_codes:
        # Get the latest stock ledger entry before or on the posting date
        sle = frappe.db.sql("""
            SELECT valuation_rate
            FROM `tabStock Ledger Entry`
            WHERE item_code = %s
                AND company = %s
                AND posting_date <= %s
                AND valuation_rate > 0
                AND is_cancelled = 0
            ORDER BY posting_date DESC, posting_time DESC, creation DESC
            LIMIT 1
        """, (item_code, company, posting_date), as_dict=1)
        
        if sle:
            valuation_map[item_code] = sle[0].valuation_rate
        else:
            # Fallback to item's valuation rate
            item_valuation = frappe.db.get_value('Item', item_code, 'valuation_rate')
            valuation_map[item_code] = item_valuation or 0
    
    return valuation_map