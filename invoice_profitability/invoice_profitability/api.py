import frappe
from frappe import _

@frappe.whitelist()
def calculate_total_average_cost(doctype, items):
    """
    Calculate total average cost from items.
    Dummy implementation for profitability calculation.
    """
    try:
        total_cost = 0
        for item in items:
            if item.get('valuation_rate') and item.get('qty'):
                total_cost += item['valuation_rate'] * item['qty']
        return round(total_cost, 2)
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "calculate_total_average_cost")
        return 0


@frappe.whitelist()
def calculate_total_incoming_cost(doctype, items):
    """
    Calculate total incoming cost from items.
    Dummy implementation for profitability calculation.
    """
    try:
        total_cost = 0
        for item in items:
            if item.get('valuation_rate') and item.get('stock_qty'):
                total_cost += item['valuation_rate'] * item['stock_qty']
        return round(total_cost, 2)
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "calculate_total_incoming_cost")
        return 0


@frappe.whitelist()
def calculate_profit_loss_percentage(net_total, total_cost):
    """
    Calculate profit/loss percentage.
    Dummy implementation for profitability analysis.
    """
    try:
        if total_cost == 0:
            return 0
        profit_loss_percent = ((net_total - total_cost) / total_cost) * 100
        return round(profit_loss_percent, 2)
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "calculate_profit_loss_percentage")
        return 0


def update_profitability_fields(doc, method):
    """
    Hook to update custom profitability fields on document update.
    Called on Sales Order, Delivery Note, and Sales Invoice save.
    """
    try:
        items = doc.get('items', [])
        
        # Calculate total average cost
        total_avg_cost = calculate_total_average_cost(doc.doctype, items)
        if hasattr(doc, 'custom_total_average_cost'):
            doc.custom_total_average_cost = total_avg_cost
        
        # Calculate total incoming cost
        total_inc_cost = calculate_total_incoming_cost(doc.doctype, items)
        if hasattr(doc, 'custom_total_incoming_cost'):
            doc.custom_total_incoming_cost = total_inc_cost
        
        # Calculate profit percentage
        net_total = doc.get('net_total', 0)
        profit_percent = calculate_profit_loss_percentage(net_total, total_avg_cost)
        if hasattr(doc, 'custom_profit_'):
            doc.custom_profit_ = max(profit_percent, 0)
        
        # Calculate loss percentage
        loss_percent = -min(profit_percent, 0)
        if hasattr(doc, 'custom_loss_'):
            doc.custom_loss_ = loss_percent
            
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "update_profitability_fields")
