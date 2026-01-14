import frappe
from frappe.utils import flt

@frappe.whitelist()
def get_item_valuation_rate(item_code, posting_date=None, company=None):
    """
    Get the valuation rate for an item on a specific date
    This is called from the frontend JavaScript to get accurate historical rates
    """
    from invoice_profitability.scripts.profitability import get_item_valuation_rate as calc_rate
    return calc_rate(item_code, posting_date, company)

@frappe.whitelist()
def check_loss_sale(doc_name):
    """
    Check if sales invoice is being sold at loss
    Returns loss details if present
    """
    try:
        doc = frappe.get_doc("Sales Invoice", doc_name)
        
        if doc.custom_loss_ and flt(doc.custom_loss_) > 0:
            return {
                'has_loss': True,
                'loss_percentage': doc.custom_loss_,
                'total_average_cost': doc.custom_total_average_cost,
                'total_incoming_cost': doc.custom_total_incoming_cost,
                'loss_amount': flt(doc.custom_total_average_cost - doc.custom_total_incoming_cost, 2)
            }
        
        return {'has_loss': False}
    except Exception as e:
        frappe.log_error(f"Error checking loss sale for {doc_name}: {str(e)}", "Profitability")
        return {'has_loss': False, 'error': str(e)}

