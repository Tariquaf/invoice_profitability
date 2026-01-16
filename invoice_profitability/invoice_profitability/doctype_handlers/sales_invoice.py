import frappe
from frappe import _

def validate_loss_on_submit(doc, method):
    """
    Validate and confirm if user wants to submit Sales Invoice with loss
    """
    if doc.docstatus != 1:  # Only on submit
        return
    
    # Check if there's a loss
    if doc.custom_loss_ and doc.custom_loss_ > 0:
        # This validation should have been caught on client side
        # But as a safety measure, we can throw an error here
        # However, frappe doesn't support interactive confirmations in server-side
        # So we'll just log a warning or you can throw an error to prevent submission
        
        # Option 1: Throw error (requires user to acknowledge loss before submit)
        # frappe.throw(_("You are submitting an invoice with {0}% loss. Please confirm.").format(doc.custom_loss_))
        
        # Option 2: Just log (allow submission with loss)
        frappe.msgprint(
            _("Sales Invoice {0} submitted with {1}% loss").format(doc.name, doc.custom_loss_),
            indicator='orange',
            alert=True
        )