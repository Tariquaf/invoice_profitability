frappe.provide("erpnext.stock");

erpnext.stock.ProfitabilityCalculator = class ProfitabilityCalculator {
    constructor(frm) {
        this.frm = frm;
        this.setup();
    }

    setup() {
        const me = this;
        
        // Setup event handlers for item table changes
        this.frm.fields_dict.items.grid.wrapper.on('change', '[data-fieldname="item_code"], [data-fieldname="qty"], [data-fieldname="rate"], [data-fieldname="amount"], [data-fieldname="warehouse"]', function() {
            me.debounced_calculate();
        });

        // Setup event handler for transaction date change
        this.frm.fields_dict.transaction_date && this.frm.fields_dict.transaction_date.$input.on('change', function() {
            me.debounced_calculate();
        });

        // Setup event handler for posting date change (Sales Invoice)
        this.frm.fields_dict.posting_date && this.frm.fields_dict.posting_date.$input.on('change', function() {
            me.debounced_calculate();
        });

        // Setup grid row changes
        this.frm.fields_dict.items.grid.df.onload = (frm) => {
            me.debounced_calculate();
        };

        // Initial calculation
        this.debounced_calculate = frappe.utils.debounce(() => {
            this.calculate_profitability();
        }, 800);
    }

    async calculate_profitability() {
        const me = this;
        const items = this.frm.doc.items;
        
        if (!items || items.length === 0) {
            this.clear_calculations();
            return;
        }

        // Get the transaction date (use posting_date for Sales Invoice if available)
        let transaction_date = this.frm.doc.transaction_date || this.frm.doc.posting_date;
        
        if (!transaction_date) {
            this.clear_calculations();
            return;
        }

        try {
            let total_incoming_cost = 0;
            let total_average_cost = 0;

            // Calculate incoming cost (sum of all item amounts)
            items.forEach(item => {
                if (item.item_code && item.qty) {
                    const amount = item.amount || (flt(item.rate) * flt(item.qty));
                    total_incoming_cost += amount;
                }
            });

            // Get valuation rates for all items in one call
            const valuation_rates = await this.get_valuation_rates(items, transaction_date);
            
            // Calculate average cost using valuation rates
            items.forEach(item => {
                if (item.item_code && item.qty) {
                    const valuation_rate = valuation_rates[item.item_code] || 0;
                    const qty = item.qty || 0;
                    const conversion_factor = item.conversion_factor || 1;
                    
                    // Calculate stock qty
                    const stock_qty = qty * conversion_factor;
                    
                    total_average_cost += valuation_rate * stock_qty;
                }
            });

            // Set calculated values
            this.frm.set_value('custom_total_incoming_cost', flt(total_incoming_cost, 2));
            this.frm.set_value('custom_total_average_cost', flt(total_average_cost, 2));
            
            // Calculate profit/loss percentage
            this.calculate_profit_loss_percentage(total_average_cost, total_incoming_cost);
            
        } catch (error) {
            console.error('Error calculating profitability:', error);
            // Don't clear on error, let user see what they have
        }
    }

    async get_valuation_rates(items, transaction_date) {
        const unique_items = [...new Set(items.filter(item => item.item_code).map(item => item.item_code))];
        const valuation_rates = {};

        // Get valuation rates for each unique item
        for (const item_code of unique_items) {
            try {
                const rate = await this.get_valuation_rate_for_item(item_code, transaction_date);
                valuation_rates[item_code] = rate;
            } catch (error) {
                console.warn(`Could not get valuation rate for ${item_code}:`, error);
                valuation_rates[item_code] = 0;
            }
        }

        return valuation_rates;
    }

    async get_valuation_rate_for_item(item_code, posting_date) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: 'invoice_profitability.scripts.profitability.get_item_valuation_rate',
                args: {
                    'item_code': item_code,
                    'posting_date': posting_date,
                    'company': this.frm.doc.company
                },
                callback: function(r) {
                    if (r.message !== undefined) {
                        resolve(r.message);
                    } else {
                        resolve(0);
                    }
                },
                error: function(err) {
                    console.warn(`Error getting valuation rate for ${item_code}:`, err);
                    resolve(0);
                }
            });
        });
    }

    calculate_profit_loss_percentage(total_average_cost, total_incoming_cost) {
        let profit_percentage = 0;
        let loss_percentage = 0;

        if (total_average_cost > 0) {
            if (total_incoming_cost > total_average_cost) {
                // Profit
                profit_percentage = ((total_incoming_cost - total_average_cost) / total_average_cost) * 100;
                loss_percentage = 0;
            } else {
                // Loss
                loss_percentage = ((total_average_cost - total_incoming_cost) / total_average_cost) * 100;
                profit_percentage = 0;
            }
        }

        // Round to 2 decimal places
        profit_percentage = flt(profit_percentage, 2);
        loss_percentage = flt(loss_percentage, 2);

        // Set values
        this.frm.set_value('custom_profit_', profit_percentage);
        this.frm.set_value('custom_loss_', loss_percentage);

        // Update UI to highlight loss
        this.update_loss_indication(loss_percentage > 0);
    }

    update_loss_indication(is_loss) {
        const profit_field = this.frm.get_field('custom_profit_');
        const loss_field = this.frm.get_field('custom_loss_');
        
        if (profit_field && loss_field) {
            if (is_loss) {
                loss_field.$wrapper.css('background-color', '#ffe6e6');
                profit_field.$wrapper.css('background-color', '');
            } else {
                profit_field.$wrapper.css('background-color', '#e6ffe6');
                loss_field.$wrapper.css('background-color', '');
            }
        }
    }

    clear_calculations() {
        this.frm.set_value('custom_total_average_cost', 0);
        this.frm.set_value('custom_total_incoming_cost', 0);
        this.frm.set_value('custom_profit_', 0);
        this.frm.set_value('custom_loss_', 0);
        this.update_loss_indication(false);
    }
};

// Attach to all three doctypes
frappe.ui.form.on('Sales Order', {
    onload: function(frm) {
        frm.profitability_calculator = new erpnext.stock.ProfitabilityCalculator(frm);
    },
    refresh: function(frm) {
        if (!frm.profitability_calculator) {
            frm.profitability_calculator = new erpnext.stock.ProfitabilityCalculator(frm);
        }
    },
    transaction_date: function(frm) {
        if (frm.profitability_calculator) {
            frm.profitability_calculator.debounced_calculate();
        }
    },
    items_add: function(frm, cdt, cdn) {
        if (frm.profitability_calculator) {
            setTimeout(() => {
                frm.profitability_calculator.debounced_calculate();
            }, 100);
        }
    },
    items_remove: function(frm, cdt, cdn) {
        if (frm.profitability_calculator) {
            frm.profitability_calculator.debounced_calculate();
        }
    }
});

frappe.ui.form.on('Delivery Note', {
    onload: function(frm) {
        frm.profitability_calculator = new erpnext.stock.ProfitabilityCalculator(frm);
    },
    refresh: function(frm) {
        if (!frm.profitability_calculator) {
            frm.profitability_calculator = new erpnext.stock.ProfitabilityCalculator(frm);
        }
    },
    transaction_date: function(frm) {
        if (frm.profitability_calculator) {
            frm.profitability_calculator.debounced_calculate();
        }
    },
    items_add: function(frm, cdt, cdn) {
        if (frm.profitability_calculator) {
            setTimeout(() => {
                frm.profitability_calculator.debounced_calculate();
            }, 100);
        }
    },
    items_remove: function(frm, cdt, cdn) {
        if (frm.profitability_calculator) {
            frm.profitability_calculator.debounced_calculate();
        }
    }
});

frappe.ui.form.on('Sales Invoice', {
    onload: function(frm) {
        frm.profitability_calculator = new erpnext.stock.ProfitabilityCalculator(frm);
    },
    refresh: function(frm) {
        if (!frm.profitability_calculator) {
            frm.profitability_calculator = new erpnext.stock.ProfitabilityCalculator(frm);
        }
    },
    posting_date: function(frm) {
        if (frm.profitability_calculator) {
            frm.profitability_calculator.debounced_calculate();
        }
    },
    items_add: function(frm, cdt, cdn) {
        if (frm.profitability_calculator) {
            setTimeout(() => {
                frm.profitability_calculator.debounced_calculate();
            }, 100);
        }
    },
    items_remove: function(frm, cdt, cdn) {
        if (frm.profitability_calculator) {
            frm.profitability_calculator.debounced_calculate();
        }
    }
});
