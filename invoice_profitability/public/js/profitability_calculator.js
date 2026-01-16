frappe.provide('invoice_profitability');

invoice_profitability.calculate_profitability = function(frm) {
    if (!frm.doc.transaction_date && !frm.doc.posting_date) {
        return;
    }

    let items = frm.doc.items || [];
    if (items.length === 0) {
        frm.set_value('custom_total_average_cost', 0);
        frm.set_value('custom_total_incoming_cost', 0);
        frm.set_value('custom_profit_', 0);
        frm.set_value('custom_loss_', 0);
        return;
    }

    // Get transaction date based on doctype
    let trans_date = frm.doc.transaction_date || frm.doc.posting_date;
    
    // Collect all item codes
    let item_codes = items.map(row => row.item_code).filter(Boolean);
    
    if (item_codes.length === 0) {
        return;
    }

    // Fetch valuation rates for all items
    frappe.call({
        method: 'invoice_profitability.invoice_profitability.api.get_valuation_rates',
        args: {
            item_codes: item_codes,
            posting_date: trans_date,
            company: frm.doc.company
        },
        callback: function(r) {
            if (r.message) {
                let valuation_map = r.message;
                let total_average_cost = 0;
                let total_incoming_cost = 0;

                // Calculate totals
                items.forEach(row => {
                    if (row.item_code && row.qty) {
                        let valuation_rate = valuation_map[row.item_code] || 0;
                        let qty = flt(row.qty);
                        let rate = flt(row.rate);
                        
                        total_average_cost += valuation_rate * qty;
                        total_incoming_cost += rate * qty;
                    }
                });

                // Set values
                frm.set_value('custom_total_average_cost', total_average_cost);
                frm.set_value('custom_total_incoming_cost', total_incoming_cost);

                // Calculate profit/loss percentage
                if (total_average_cost > 0) {
                    let difference = total_incoming_cost - total_average_cost;
                    // percent relative to average cost (what you expect)
                    let percentage = (difference / total_average_cost) * 100;
                    percentage = parseFloat(percentage.toFixed(2));

                    if (percentage >= 0) {
                        // Profit
                        frm.set_value('custom_profit_', percentage);
                        frm.set_value('custom_loss_', 0);
                    } else {
                        // Loss
                        frm.set_value('custom_profit_', 0);
                        frm.set_value('custom_loss_', Math.abs(percentage));
                    }
                } else {
                    frm.set_value('custom_profit_', 0);
                    frm.set_value('custom_loss_', 0);
                }
            }
        }
    });
};

// Attach to Sales Order
frappe.ui.form.on('Sales Order', {
    refresh: function(frm) {
        invoice_profitability.calculate_profitability(frm);
    },
    transaction_date: function(frm) {
        invoice_profitability.calculate_profitability(frm);
    },
    company: function(frm) {
        invoice_profitability.calculate_profitability(frm);
    }
});

frappe.ui.form.on('Sales Order Item', {
    items_add: function(frm, cdt, cdn) {
        invoice_profitability.calculate_profitability(frm);
    },
    items_remove: function(frm, cdt, cdn) {
        invoice_profitability.calculate_profitability(frm);
    },
    item_code: function(frm, cdt, cdn) {
        invoice_profitability.calculate_profitability(frm);
    },
    qty: function(frm, cdt, cdn) {
        invoice_profitability.calculate_profitability(frm);
    },
    rate: function(frm, cdt, cdn) {
        invoice_profitability.calculate_profitability(frm);
    }
});

// Attach to Delivery Note
frappe.ui.form.on('Delivery Note', {
    refresh: function(frm) {
        invoice_profitability.calculate_profitability(frm);
    },
    posting_date: function(frm) {
        invoice_profitability.calculate_profitability(frm);
    },
    company: function(frm) {
        invoice_profitability.calculate_profitability(frm);
    }
});

frappe.ui.form.on('Delivery Note Item', {
    items_add: function(frm, cdt, cdn) {
        invoice_profitability.calculate_profitability(frm);
    },
    items_remove: function(frm, cdt, cdn) {
        invoice_profitability.calculate_profitability(frm);
    },
    item_code: function(frm, cdt, cdn) {
        invoice_profitability.calculate_profitability(frm);
    },
    qty: function(frm, cdt, cdn) {
        invoice_profitability.calculate_profitability(frm);
    },
    rate: function(frm, cdt, cdn) {
        invoice_profitability.calculate_profitability(frm);
    }
});

// Attach to Sales Invoice
frappe.ui.form.on('Sales Invoice', {
    refresh: function(frm) {
        invoice_profitability.calculate_profitability(frm);
    },
    posting_date: function(frm) {
        invoice_profitability.calculate_profitability(frm);
    },
    company: function(frm) {
        invoice_profitability.calculate_profitability(frm);
    }
});

frappe.ui.form.on('Sales Invoice Item', {
    items_add: function(frm, cdt, cdn) {
        invoice_profitability.calculate_profitability(frm);
    },
    items_remove: function(frm, cdt, cdn) {
        invoice_profitability.calculate_profitability(frm);
    },
    item_code: function(frm, cdt, cdn) {
        invoice_profitability.calculate_profitability(frm);
    },
    qty: function(frm, cdt, cdn) {
        invoice_profitability.calculate_profitability(frm);
    },
    rate: function(frm, cdt, cdn) {
        invoice_profitability.calculate_profitability(frm);
    }
});

// Add this section for Sales Invoice before_submit
frappe.ui.form.on('Sales Invoice', {
    before_submit: function(frm) {
        if (frm.doc.custom_loss_ && frm.doc.custom_loss_ > 0) {
            return new Promise((resolve, reject) => {
                frappe.confirm(
                    __('You are submitting this invoice with {0}% loss. Are you sure you want to continue?', [frm.doc.custom_loss_]),
                    () => resolve(),  // User clicked Yes
                    () => reject()    // User clicked No
                );
            });
        }
    }
});