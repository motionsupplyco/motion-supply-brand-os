# Motion Supply Brand OS - Beginner Operating Guide

## What Brand OS is

Motion Supply Brand OS is a decision-support system for clothing-brand operators. It is designed to help a founder answer expensive questions before money leaves the business: Is this product priced correctly? How much can I afford to spend to acquire a customer? Can I run this discount? When should I review a reorder? Can the business afford this purchase order? Is a 3PL actually cheaper? Does a wholesale deal still leave contribution?

Brand OS is not bookkeeping, tax software, a bank balance, Shopify Analytics, ad-platform attribution, or a substitute for professional accounting advice. The goal is to connect operating decisions that founders normally make in separate spreadsheets.

## The core operating loop

Use the app in this order:

1. Product economics
2. Customer acquisition
3. Store funnel
4. Discount and launch decisions
5. Inventory timing
6. Cash protection
7. Purchase-order gate
8. Fulfillment and wholesale decisions
9. Shopify source data
10. Next Move Advisor

The logic is simple: **Economics -> Acquisition -> Demand -> Inventory -> Cash -> Decision.**

Do not start with a purchase order or ad budget before the earlier parts of the model are trustworthy.

---

## 1. Business Health - your command center

Business Health is the summary screen. It should not be treated as a place to enter every number. It reads the model you build in the operating tools and shows the decisions that deserve attention.

### What to look for

- Pre-CAC contribution
- Max first-order CAC
- Contribution after CAC or break-even orders
- Reorder review point when inventory is set up
- Cash headroom when cash is set up
- The highest-priority Next Move

### Beginner rule

If Business Health says a section needs setup, do not treat the blank area as a bad score. Brand OS intentionally refuses to invent a result from missing inputs.

---

## 2. Profit & Pricing - build one real order

### Business question

**Does this product leave enough money per order after the costs that actually move with the order?**

### Enter

- Retail price
- Landed product cost
- Packaging per order
- Shipping cost you absorb
- Return/refund planning reserve
- Payment processor percentage
- Payment processor fixed fee

### Understand the output

**Gross margin** compares selling price with the product cost in the model.

**Pre-CAC contribution** is the modeled money remaining after the order-level variable costs entered, before customer acquisition.

**Contribution margin** is pre-CAC contribution as a percentage of selling price.

### Common beginner mistake

Do not look at a $78 sale and think you made $78. Revenue is not contribution, and contribution is not accounting net profit.

### What this tool feeds

Profit & Pricing feeds CAC, Discounts, Launch & Break-Even, Wholesale, and the PO model.

---

## 3. Customer Acquisition - set your ad-spend ceiling

### Business question

**How much can I afford to spend to acquire a first-order customer while preserving the contribution I want left?**

### Enter

- The contribution you require after CAC
- Either observed/expected CAC, or acquisition spend plus new customers acquired

### Formula used by Brand OS

Max first-order CAC = full-price pre-CAC contribution - your required post-CAC contribution floor.

If direct CAC is blank and spend plus new customers are entered, Brand OS uses spend / new customers.

### Common beginner mistake

Do not divide spend by total orders if repeat customers are mixed into the order count and you are trying to calculate new-customer CAC.

### Decision

If observed CAC is above the ceiling created by your own economics, scaling spend can make the business larger without making it healthier.

---

## 4. Store Funnel - find the stage that changed

### Business question

**Where are shoppers dropping out between a visit and a completed order?**

### Enter from the same period and source

- Sessions
- Add-to-carts
- Checkouts started
- Completed orders

### Outputs

- Store conversion rate
- Add-to-cart rate
- Checkout-start rate
- Cart-to-checkout rate
- Checkout-completion rate

### How to use the tool

Compare your own periods and experiments. A change tells you where to investigate. The number alone does not prove why the change happened.

### Common beginner mistake

Do not mix last week's sessions with this month's orders.

---

## 5. Discount Ceiling - test the whole offer stack

### Business question

**How deep can I discount while still preserving the contribution floor I chose?**

### Before using it

Complete Product Economics and CAC first.

### Include

- Affiliate commission if one applies
- CAC expected during the offer
- Required post-CAC contribution floor

Brand OS compares full price and discount levels against the floor.

### Important

A discount that still has positive contribution can still be below the operating floor you need. PASS means it clears your chosen floor; WATCH means it does not.

---

## 6. Launch & Break-Even - know the order target before a drop

### Business question

**How many contribution-positive orders are required to recover the fixed cost of this launch?**

### Enter

- Fixed launch cost
- Units available
- Expected CAC

### Examples of fixed launch costs

- Samples
- Creative production
- Photography/video
- One-time setup
- Launch-specific design or contractor costs

### Important

Break-even math does not prove demand exists. It tells you what must happen financially if the modeled assumptions hold.

---

## 7. Inventory & Reorder - review before you stock out

### Business question

**When does inventory deserve a reorder review based on demand and supplier lead time?**

### Enter

- Base weekly unit demand
- Optional high-case weekly demand
- Supplier lead time in weeks
- On-hand units
- Confirmed inbound units
- Allocated or committed units

### Outputs

- Lead-time demand
- Scenario reserve
- Reorder review point
- Inventory position
- Gap to review point
- On-hand weeks of cover

### Important

The reorder point is a review trigger, not an automatic purchase order. Before ordering, confirm cash, supplier terms, returns, size curve, demand quality, and timing.

---

## 8. Cash Checkpoint - protect operating liquidity

### Business question

**After near-term cash movements, how much headroom remains above the operating cash floor I refuse to cross?**

### Keep one planning window

Every inflow and outflow must refer to the same time window.

### Enter

- Starting cash
- Expected inflows
- Wholesale receivable expected in the window
- Other committed outflows
- Existing supplier balances
- Payroll
- Tax reserve
- Processor holds
- Protected cash floor

### Important

This is a quick checkpoint, not a complete 13-week cash forecast.

---

## 9. PO Cash Gate - model the payment timeline before buying inventory

### Business question

**Can I place this order and still stay above my protected cash floor after both the deposit and the remaining supplier balance?**

### Enter

- Proposed units
- Landed cost per unit
- Deposit percentage
- Weeks until the remaining balance is due
- Base cash-window inputs
- Additional inflows before balance payment
- Additional outflows before balance payment

### Outputs

- PO total
- Deposit due now
- Cash after deposit
- Remaining supplier balance
- Cash before balance
- Cash after balance
- Lowest modeled headroom
- PASS or HOLD

### Important

Future inflows are estimates, not guaranteed cash. Do not make an unsafe PO look safe by entering optimistic revenue that has not happened.

---

## 10. 3PL Decision - compare the quote on the same basis

### Business question

**At my order volume, does the 3PL cost less per order than the in-house fulfillment baseline?**

### Enter

- In-house non-postage fulfillment cost per order
- 3PL variable cost per order
- 3PL fixed monthly fee or minimum
- Monthly orders

### Outputs

- Normalized 3PL cost per order
- Cost-only crossover volume

### Do not stop at the number

Also review receiving fees, storage, pick-and-pack rules, packaging, returns, B2B handling, shipping cutoffs, accuracy, software integrations, support, and transition risk.

---

## 11. Wholesale Economics - protect both sides of the deal

### Business question

**Does the deal leave unit contribution for my brand while leaving margin room for the retailer?**

### Enter

- Wholesale price
- Wholesale handling cost per unit
- Rep commission percentage if any

### Outputs

- Wholesale contribution per unit
- Retailer gross-margin room at MSRP

### Remember

Retailer gross margin is not your margin, and it is not the retailer's final profit. Their rent, labor, markdowns, payment fees, returns, and other operating costs still exist.

---

## 12. Shopify Import - bring source data into the operating conversation

Brand OS accepts Shopify Orders CSV and Transaction History CSV exports.

### Orders export can show

- Orders in the export
- Non-canceled order total from exported fields
- Units in line items
- Average exported order total
- Discounts
- Customer-email count
- Top SKUs/items

### Transaction History can show

- Captured sales
- Refunds
- Net captured payments
- Orders with transactions

### Privacy

Raw Shopify customer rows are intended to stay in the browser by default; the app saves aggregate summaries when the signed-in Pro workflow is used.

### Important

An Orders CSV is not treated as official Shopify Analytics net sales. Transaction History is better for captured/refunded payment cash; official analytics should still come from Shopify Analytics.

---

## 13. Brands & SKUs - your saved operating structure

Create a brand and save SKUs under it so the operating model can become more persistent over time.

Free accounts have limited saved brands/SKUs. Pro is intended to become the recurring operating layer with broader history and business memory.

The long-term goal is for saved SKU economics, Shopify source data, snapshots, and recommendations to connect so founders do less repeated data entry.

---

## 14. Next Move Advisor - priority, not prophecy

The Advisor reads the inputs you supplied and prioritizes operating rules such as:

- Finish missing product economics
- Set the acquisition model
- Stop scaling acquisition when contribution becomes negative
- Bring CAC back under the ceiling
- Protect cash
- Hold a PO that crosses the cash floor
- Review a reorder
- Review a favorable 3PL cost comparison
- Review the latest store pulse

The Advisor is rule-based decision support. It is not a forecast and does not replace judgment.

---

# Beginner glossary

**Landed cost** - product cost plus inbound costs allocated to getting a unit ready to sell.

**Gross margin** - sales revenue remaining after cost of goods in the model, usually expressed as a percentage.

**Contribution** - money remaining after the variable costs included in the model. Brand OS uses it as an operating decision pool, not accounting net profit.

**CAC** - customer acquisition cost.

**AOV** - average order value.

**Inventory position** - on hand + confirmed inbound - allocated/committed units.

**Reorder point** - a trigger to review replenishment, not an automatic buy instruction.

**Protected cash floor** - the operating cash balance you choose not to cross.

**Break-even orders** - contribution-positive orders needed to recover fixed launch cost.

**3PL** - a third-party logistics provider that stores and/or fulfills orders.

**MOQ** - minimum order quantity required by a supplier or manufacturer.

---

# The weekly founder routine

A useful operating rhythm for Brand OS is:

### Monday - store and acquisition

Update CAC and funnel inputs for a consistent period. Review whether contribution after CAC still clears the floor.

### Wednesday - inventory and cash

Update unit demand, on-hand inventory, inbound units, and cash obligations. Review any reorder or PO decision before committing.

### Friday - decisions and learning

Review Next Move, compare the week with previous periods, and record what changed after the decision.

The future Business Memory layer should automate more of this history so the app can compare current and previous business states.

---

# What Brand OS should never encourage

- Scaling ads because revenue looks good while first-order contribution is negative
- Ordering inventory from comments, likes, or waitlists alone
- Calling gross margin net profit
- Treating projected inflows as guaranteed cash
- Treating one universal conversion or CAC benchmark as correct for every brand
- Mixing different time windows inside one cash or funnel calculation
- Treating a 3PL cost comparison as a complete vendor decision
- Treating an operational CSV export as official accounting or analytics reporting

---

# Final operating principle

**Your store tells you what happened. Brand OS should tell you whether the next decision makes financial sense - and eventually remember what happened after you made it.**
