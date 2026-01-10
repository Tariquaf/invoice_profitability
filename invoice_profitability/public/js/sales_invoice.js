// Sales Invoice Profitability Enhancement
frappe.ui.form.on('Sales Invoice', {
    refresh: function(frm) {
        // Calculate profitability metrics when form is refreshed
        calculate_profitability_metrics(frm);
    },
    
    items_add: function(frm, cdt, cdn) {
        // Recalculate when new item is added
        calculate_profitability_metrics(frm);
    },
    
    items_remove: function(frm, cdt, cdn) {
        // Recalculate when item is removed
        calculate_profitability_metrics(frm);
    },
    
    net_total: function(frm) {
        // Recalculate when net total changes
        calculate_profitability_metrics(frm);
    }
});

function calculate_profitability_metrics(frm) {
    /**
     * Dummy function to calculate and display profitability metrics
     * Calculates total cost, profit/loss percentages for sales invoices
     */
    if (!frm.doc.items || frm.doc.items.length === 0) {
        frm.set_value('custom_total_average_cost', 0);
        frm.set_value('custom_total_incoming_cost', 0);
        frm.set_value('custom_profit_', 0);
        frm.set_value('custom_loss_', 0);
        return;
    }
    
    // Calculate total average cost (dummy logic)
    let total_avg_cost = 0;
    frm.doc.items.forEach(function(item) {
        total_avg_cost += (item.valuation_rate || 0) * (item.qty || 0);
    });
    
    // Calculate total incoming cost (dummy logic)
    let total_inc_cost = 0;
    frm.doc.items.forEach(function(item) {
        total_inc_cost += (item.valuation_rate || 0) * (item.stock_qty || item.qty || 0);
    });
    
    // Update custom fields
    frm.set_value('custom_total_average_cost', Math.round(total_avg_cost * 100) / 100);
    frm.set_value('custom_total_incoming_cost', Math.round(total_inc_cost * 100) / 100);
    
    // Calculate profit/loss percentage
    if (total_avg_cost > 0) {
        let net_total = frm.doc.net_total || 0;
        let profit_percent = ((net_total - total_avg_cost) / total_avg_cost) * 100;
        
        frm.set_value('custom_profit_', Math.max(profit_percent, 0));
        frm.set_value('custom_loss_', Math.max(-profit_percent, 0));
    }
}
