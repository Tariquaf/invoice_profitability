import frappe
from frappe.utils import flt, nowdate

@frappe.whitelist()
def get_item_valuation_rate(item_code, posting_date=None, company=None):
    """
    Get the valuation rate for an item on a specific date
    This is called from the frontend JavaScript to get accurate historical rates
    """
    if not posting_date:
        posting_date = nowdate()
    
    if not company:
        company = frappe.defaults.get_user_default("company")
    
    try:
        # Get from stock ledger to calculate weighted average cost
        result = frappe.db.sql("""
            SELECT 
                SUM(actual_qty) as total_qty,
                SUM(stock_value_difference) as total_value
            FROM `tabStock Ledger Entry`
            WHERE 
                item_code = %s
                AND posting_date <= %s
                AND company = %s
                AND is_cancelled = 0
        """, (item_code, posting_date, company), as_dict=True)

        if result and result[0].total_qty and flt(result[0].total_qty) > 0:
            valuation_rate = flt(result[0].total_value) / flt(result[0].total_qty)
            return valuation_rate

        # Fallback to item master
        item = frappe.get_cached_doc("Item", item_code)
        if item.valuation_rate:
            return flt(item.valuation_rate)

        return 0

    except Exception as e:
        frappe.log_error(f"Error getting valuation rate for {item_code} on {posting_date}: {str(e)}", "Profitability")
        return 0
