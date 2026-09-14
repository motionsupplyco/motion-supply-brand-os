# Motion Supply Brand OS — Founder Handbook

## From Numbers to Decisions

Brand OS is a decision-support operating system for clothing-brand founders. It helps you turn product, acquisition, store, inventory, fulfillment and cash inputs into clearer operating decisions. It is not bookkeeping, tax, legal or investment advice, and it does not replace Shopify Analytics, an accountant, a 13-week cash forecast, or specialized inventory forecasting software.

## The operating loop

Use Brand OS in this order:

1. **Products & Profit** — prove the economics of one order.
2. **Growth & Sales** — decide what you can afford to pay for a customer and see where shoppers leave the funnel.
3. **Offers** — test discounts against the contribution floor you chose.
4. **Inventory & Operations** — turn demand and lead time into a reorder review trigger; compare fulfillment options.
5. **Cash & Commitments** — protect operating cash before approving inventory or other large commitments.
6. **Store Data** — import source-labeled Shopify exports to replace guesses with observed operating data.
7. **Next Move** — review the highest-priority issues before making the next expensive decision.

The tools are connected. Do not treat each calculator as an isolated answer.

---

## 1. Start here: the numbers every beginner should understand

### Revenue
Money collected from sales before subtracting costs. Revenue is not profit.

### Landed product cost
The per-unit cost of getting inventory into your possession and ready to sell. Include product cost plus inbound freight, duties and other inbound costs allocated per unit when applicable.

### Gross margin
Retail price minus landed product cost, expressed as dollars or a percentage. Useful, but incomplete because orders can also create packaging, shipping, return, payment and acquisition costs.

### Contribution
The money remaining from an order after the variable costs included in the model. Brand OS uses **pre-CAC contribution** before customer acquisition and **post-CAC contribution** after acquisition.

### CAC
Customer acquisition cost. If you calculate it from a period, use acquisition spend divided by **new customers acquired**, not total orders when repeat buyers are mixed in.

### Cash floor
A founder-chosen amount of operating cash you do not want a purchase order or other modeled commitment to push below. Brand OS does not invent a universal floor.

### Reorder review point
A trigger to investigate a reorder based on demand and lead time. It is not an instruction to automatically purchase inventory.

---

## 2. Products & Profit

### What to enter
- Retail price
- Landed product cost
- Packaging per order
- Shipping cost you absorb per order
- Return/refund planning reserve per order
- Actual payment processor percentage and fixed fee

### Where to find the numbers
Use supplier invoices and freight/duty records for landed cost; packaging invoices for packaging; shipping-platform/carrier records for absorbed shipping; your own historical return/refund experience for a planning reserve; and your payment provider's actual terms for processing fees.

### What the result means
Pre-CAC contribution is the pool left from the modeled order before paying to acquire the customer. Do not set ad budgets or discount depth from revenue alone.

### Beginner mistake
Entering only product cost and assuming the remainder is profit. If an order creates a cost, model it before trusting contribution.

### Decision
If contribution is weak or negative before CAC, fix price, sourcing, packaging, shipping policy or other variable costs before trying to scale paid acquisition.

---

## 3. Growth & Sales

### Customer Acquisition Cost
First choose the contribution you require to remain after acquiring a customer. Brand OS then works backward to a maximum first-order CAC.

You can enter CAC directly or calculate it from acquisition spend divided by new customers for the same period.

### Store Funnel
Use the same date range and source for:
- Sessions
- Add-to-carts
- Checkouts started
- Completed orders

Brand OS calculates store conversion, add-to-cart rate, checkout-start rate, cart-to-checkout rate and checkout completion.

### How to interpret it
The funnel identifies **where** the largest drop occurs. It does not prove **why** it happened. Investigate merchandising, traffic quality, product page clarity, offer, trust, shipping, checkout friction and technical issues before claiming a cause.

---

## 4. Discount Ceiling

Discounts change more than revenue. They reduce the amount available to cover CAC, affiliate commissions and the contribution floor you want to preserve.

Before testing an offer, finish product economics and CAC. Enter affiliate commission if one applies. Compare full price and discount scenarios.

- **PASS** means the modeled order remains at or above your chosen post-CAC contribution floor.
- **WATCH** means it remains contribution-positive but misses your chosen floor.
- **FAIL** means modeled contribution after CAC is zero or negative.

Do not interpret PASS as proof the promotion will create enough demand.

---

## 5. Inventory & Reorder

Enter base weekly unit demand, an optional high-case demand scenario, realistic order-to-receipt lead time, on-hand units, confirmed inbound units and allocated/committed units.

Brand OS models lead-time demand, scenario reserve, inventory position, weeks of cover and a reorder review point.

Before placing a PO, also consider size curve, returns, seasonality, stockout history, supplier reliability, demand quality and cash. Interest, likes, comments and waitlists are signals—not guaranteed orders.

---

## 6. Wholesale Economics

Enter wholesale price, per-unit wholesale handling and rep commission if applicable. Brand OS compares wholesale revenue with landed cost, handling and commission, and also shows the retailer's gross-margin room at your MSRP.

Retailer margin is not your margin. A wholesale deal can create revenue while still being unattractive to your business if your contribution is too thin or payment terms create cash pressure.

---

## 7. Launch & Break-Even

Enter fixed launch costs, available units and expected CAC. Brand OS calculates how many contribution-positive orders are required to recover fixed launch costs.

Break-even is not a demand forecast. Having enough units to mathematically cover break-even does not mean customers will buy them.

Use this tool after product economics and CAC, not before.

---

## 8. 3PL Decision

Compare your consistent in-house non-postage fulfillment cost per order with the 3PL's variable cost plus monthly minimum/fixed cost. Brand OS normalizes the monthly charge across order volume and can calculate a cost-only crossover point.

Do not choose a 3PL from the crossover alone. Review receiving fees, storage, pick/pack rules, returns, B2B capability, accuracy, shipping cutoffs, integrations, support, minimums, transition risk and contract terms.

---

## 9. Cash Checkpoint

Put every cash input in the same planning window. Enter starting cash, expected inflows, expected wholesale receivables, committed outflows, supplier balances, payroll, tax reserve, processor holds and your protected cash floor.

Brand OS calculates projected cash and headroom versus your floor.

This is a quick stress check—not a full cash-flow forecast. Do not mix a two-week inflow estimate with six weeks of outflows and interpret the result as runway.

---

## 10. PO Cash Gate

This tool connects inventory purchasing to cash protection.

Enter proposed units, landed cost per unit, deposit percentage and balance timing. Then enter the base cash window plus additional inflows/outflows expected between deposit and balance payment.

Brand OS models:
- Total PO value
- Deposit due now
- Cash after deposit
- Remaining supplier balance
- Cash before balance
- Cash after balance
- Lowest modeled cash/headroom across the payment timeline

**PASS** means the modeled payment timeline stays above the cash floor you chose. It does not guarantee future inflows or demand.

**HOLD** means the modeled timeline crosses your protected floor. Consider fewer units, better supplier terms, more available cash, later timing or removing optimistic inflows.

---

## 11. Shopify CSV Dashboard

Use Shopify Orders exports for operational order totals, units and SKU mix. Use transaction-history exports for captured-payment/refund cash views when supported by the importer.

Raw imported customer rows stay in the browser by default; Brand OS stores aggregate summaries for signed-in eligible users.

Do not call an Orders CSV result official Shopify Analytics net sales. Source definitions matter.

---

## 12. Brands & SKUs

Use saved brands and SKUs as the cloud identity layer for your catalog. Keep names, SKUs and prices clean and consistent with the commerce system you use. The long-term goal is for operating models, imports and historical snapshots to attach to the correct brand/product context.

---

## 13. Next Move Advisor

The Advisor prioritizes rules triggered by the data you entered. Treat it as a decision-support layer, not an autonomous CFO.

A strong operating habit is:
1. Read the highest-priority move.
2. Open the tool behind that move.
3. Verify the source inputs.
4. Model the decision.
5. Make the real-world decision using both the model and business context.
6. Return with updated actual results.

As Brand OS gains historical memory, recommendations should increasingly compare current conditions with the brand's own past rather than generic benchmarks.

---

## 14. Weekly founder routine

Once per week:
- Update product costs if supplier/freight terms changed.
- Update acquisition spend and new customers.
- Enter one consistent funnel period.
- Review inventory demand, lead time and commitments.
- Update near-term cash obligations.
- Run any proposed PO through the PO Cash Gate.
- Review the Next Move Advisor.
- Record what decision you made and compare the result next week.

The goal is not more dashboards. The goal is fewer expensive guesses.

---

## 15. Monthly operator review

Once per month:
- Compare current contribution with the prior month.
- Compare CAC with your maximum first-order CAC.
- Compare funnel stages period-over-period using the same definitions.
- Review SKU demand and inventory exposure.
- Re-evaluate discount and affiliate economics.
- Re-evaluate 3PL economics if order volume changed materially.
- Review wholesale deals and receivables.
- Review cash commitments and supplier terms.
- Identify the three decisions most likely to change profit or cash next month.

---

## 16. Worked example: Foundry Eight demo

The built-in demo uses an illustrative product with a $78 retail price and $27.40 landed cost. With $1.20 packaging, $4.50 absorbed shipping, a $2.50 return/refund reserve and 2.9% + $0.30 processor illustration, pre-CAC contribution is about **$39.84**. If the founder requires $15 to remain after acquisition, the maximum first-order CAC under the model is about **$24.84**.

If actual CAC is $15, modeled post-CAC contribution is about **$24.84**. This does not mean $15 is a universal good CAC; it means $15 fits this specific illustrative order model and its chosen floor.

With weekly demand of 10 units, a 14-unit high case, six-week lead time and 35 units positioned, the demo's reorder review point is 84 units and the gap to that review point is 49 units. That is a reason to investigate the next order—not permission to blindly buy 49 units.

For an 80-unit proposed PO at $27.40 landed cost with a 50% deposit, total PO value is **$2,192**, deposit is **$1,096**, and remaining balance is **$1,096**. In the demo cash case, base projected cash is $6,500 and modeled cash after the remaining balance is $4,308, leaving $1,808 above a $2,500 protected floor.

---

## 17. Common mistakes Brand OS is designed to prevent

- Calling revenue profit.
- Setting CAC from somebody else's benchmark.
- Discounting without modeling the full offer stack.
- Ordering inventory because a product is getting attention.
- Looking only at the supplier deposit and forgetting the balance payment.
- Comparing 3PL variable fees while ignoring monthly minimums.
- Mixing cash-flow time windows.
- Treating an operational CSV export as accounting truth.
- Scaling acquisition before contribution is healthy.
- Making decisions from stale inputs.

---

## 18. What Brand OS should become

The mature product should operate as a loop:

**Connected data → normalized business state → financial engine → historical memory → risks/opportunities → prioritized next moves → founder action → new results.**

The long-term moat is not a collection of calculators. It is the combination of founder education, trustworthy math, clothing-brand-specific operating context, historical memory and decision continuity.

---

## 19. Glossary

**AOV:** Average order value.

**Allocated inventory:** Units already committed and not freely available.

**CAC:** Customer acquisition cost.

**COGS:** Cost of goods sold; definitions vary by reporting context, so keep the source definition consistent.

**Contribution:** Money remaining after the variable costs included in a model.

**GMV:** Gross merchandise value; not the same as profit.

**Inbound inventory:** Confirmed units already ordered and expected to arrive.

**Landed cost:** Product plus applicable inbound costs allocated per unit.

**Lead time:** Time from ordering inventory until it is actually available to sell.

**Protected cash floor:** Founder-selected minimum operating cash to protect in a planning model.

**Reorder point:** A review trigger based on demand and lead time, not an automatic PO.

**SKU:** Stock keeping unit; a unique product/variant identifier.

**3PL:** Third-party logistics provider.

---

## Final rule

**Never trust a result more than you trust the inputs behind it.** Brand OS should always make the source, time window, assumptions and missing information visible before a founder acts.
