---
title: Which bill the till prints
summary: With a GSTIN the till prints a TAX INVOICE with CGST and SGST and their rates; on the composition scheme a BILL OF SUPPLY; with no GSTIN a plain receipt. A missing GSTIN never stops a sale.
for: Owners; good for everyone to know
minutes: 3
keywords: tax invoice bill of supply receipt gst gstin composition unregistered cgst sgst igst rate taxable value hsn invoice number rule 46
---

The till works out the kind of bill from the shop's GST details, which come from Inventory.

| The shop | The bill says | GST on it |
|---|---|---|
| Has a GSTIN, regular GST | **TAX INVOICE** | Each line's **GST 5%**, the **Taxable value**, then **CGST 2.5%** and **SGST 2.5%** (one pair per rate). |
| On the composition scheme | **BILL OF SUPPLY** | None, and the line *Composition taxable person, not eligible to collect tax on supplies.* |
| No GSTIN | A plain receipt | None. |

:::note GST is the shop's choice
A shop with no GSTIN sells and prints normally. Nothing is ever refused for a missing GSTIN, rate or
customer detail.
:::

## What a tax invoice shows

- The shop's name, address, phone and **GSTIN**.
- A bill number like **INV/2026-27/0042** — one unbroken series per financial year. From the 10,000th bill
  of a year it is written **INV/26-27/10000**, so it never passes the 16 characters GST allows.
- Date, cashier, and **Served by** if chosen.
- Each line: quantity × price, **HSN** and **GST %**, any offer, the line total.
- **Taxable value**, **CGST** and **SGST** with their rates, round-off, total, how it was paid.
- For a business customer, or a bill of ₹50,000 or more: **Bill to** with their details. See
  [Business bills](/help/gst/business-bills) and [Bills of ₹50,000 or more](/help/gst/large-bills).

:::note Example
A ₹3,000 cotton saree with a ₹300 offer, 5% GST: line ₹2,700 · **Taxable value ₹2,571.43** · **CGST 2.5%
₹64.29** · **SGST 2.5% ₹64.28** · **Total ₹2,700**. Prices include GST; the till works it backwards.
:::

Your shop's GSTIN and registration are set in Inventory. See Inventory's guide:
[Shop details](https://inventory.scaleezy.com/help/settings/shop-details).
