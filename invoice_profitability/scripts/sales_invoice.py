import frappe
from frappe import _
from frappe.utils import flt

def calculate_profitability(doc, method):
    """
    Calculate profitability metrics for all three doctypes before saving
    This function:
    1. Calculates total incoming cost from item amounts
    2. Fetches valuation rates and calculates total average cost
    3. Computes profit/loss percentages
    """
    if not doc.items:
        # Clear calculations if no items
        doc.custom_total_average_cost = 0
        doc.custom_total_incoming_cost = 0
        doc.custom_profit_ = 0
        doc.custom_loss_ = 0
        return

    # Get the appropriate date field based on doctype
    transaction_date = None
    if doc.doctype == "Sales Order":
        transaction_date = doc.transaction_date
    else:
        # Both Sales Invoice and Delivery Note use posting_date
        transaction_date = doc.posting_date

    if not transaction_date:
        return

    # Calculate totals
    total_incoming_cost = 0
    total_average_cost = 0

    for item in doc.items:
        if not item.item_code or not item.qty:
            continue

        # Total incoming cost = sum of all item amounts (selling price * qty)
        item_amount = flt(item.amount) if item.amount else (flt(item.rate) * flt(item.qty))
        total_incoming_cost += item_amount

        # Get valuation rate for this item
        valuation_rate = get_item_valuation_rate(
            item.item_code,
            transaction_date,
            doc.company
        )

        # Conversion factor for stock quantity
        conversion_factor = flt(item.conversion_factor) if item.conversion_factor else 1
        stock_qty = flt(item.qty) * conversion_factor

        # Total average cost = sum of (valuation_rate * stock_qty)
        total_average_cost += flt(valuation_rate) * stock_qty

    # Update fields
    doc.custom_total_average_cost = flt(total_average_cost, 2)
    doc.custom_total_incoming_cost = flt(total_incoming_cost, 2)

    # Calculate profit/loss percentage
    if total_average_cost > 0:
        if total_incoming_cost > total_average_cost:
            # Profit
            profit_percentage = ((total_incoming_cost - total_average_cost) / total_average_cost) * 100
            doc.custom_profit_ = flt(profit_percentage, 2)
            doc.custom_loss_ = 0
        else:
            # Loss
            loss_percentage = ((total_average_cost - total_incoming_cost) / total_average_cost) * 100
            doc.custom_loss_ = flt(loss_percentage, 2)
            doc.custom_profit_ = 0
    else:
        doc.custom_profit_ = 0
        doc.custom_loss_ = 0

    frappe.msgprint(f"✓ Profitability Calculated: Avg Cost: {doc.custom_total_average_cost}, Incoming: {doc.custom_total_incoming_cost}, Profit: {doc.custom_profit_}%, Loss: {doc.custom_loss_}%", title="Calculation Complete", indicator="green")


def get_item_valuation_rate(item_code, posting_date, company):
    """
    Get the valuation rate for an item on a specific date
    Uses Stock Ledger Entry to calculate weighted average cost
    """
    try:
        # First try to get from stock ledger for accurate historical rate
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

        # Fallback to item master valuation rate
        item = frappe.get_cached_doc("Item", item_code)
        if item.valuation_rate:
            return flt(item.valuation_rate)

        return 0

    except Exception as e:
        frappe.log_error(f"Error getting valuation rate for {item_code} on {posting_date}: {str(e)}", "Profitability Calculation")
        return 0

