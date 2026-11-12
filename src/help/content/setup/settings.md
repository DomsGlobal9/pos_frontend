---
title: Settings
summary: The shop's name, address, phone, GSTIN and bill footer, the cashier's discount limit and the return window; which ways customers pay; the UPI ID for the payment QR; GST registration; and the logo. With the Inventory link, the shop's details come from Inventory instead.
for: The owner
minutes: 2
app: /settings
appLabel: Settings
keywords: settings shop name address phone gstin footer discount limit return window upi id vpa qr gst registration composition logo bill shop details owner
---

**More → Settings**. Only the owner can change these.

## Shop details

The **shop name**, **phone**, **address**, **GSTIN** and the **line at the bottom of the bill**, as every
bill prints them; the **most a cashier can take off** without a manager (in %); and how many days
**returns** are taken (empty: any time). Change what you need and **Save**.

A GSTIN is checked as you save it: one wrong character is caught here. Its first two digits are your
state, which decides CGST + SGST or IGST on every bill from now on.

:::note Bills already given out keep theirs
Each bill keeps the name, address, phone and GSTIN it was issued with, so a reprint of last month's bill
shows what the customer was given, not today's details. Bill numbering is set up by ScaleEzy, so a
year's bills stay one unbroken series.
:::


![The Settings page: UPI payments, GST registration and Logo on the bill.](1-settings.webp "Only the owner can change these.")

## Ways customers pay

Tick **Cash**, **UPI** and **Card on a swiping machine** for the ways the shop takes, and **Save**. The
payment screen then offers only those, and a way switched off is refused on every till. At least one
stays on. Points and store credit are not here: they come with the Inventory link.

## UPI payments

Type the shop's **UPI ID** (for example *lakshmisilks@okaxis*) and **Save**. The payment screen then shows
a QR with the amount already in it, for any UPI app.

## GST registration

How the shop is registered decides the bill: see [Which bill the till prints](/help/gst/which-bill). With
the till linked to Inventory, this comes from Inventory and is shown here only.

## Logo on the bill

Choose a picture; it prints at the top of the bill and its PDF. A PNG with a clear background prints best
on a receipt printer.

## Sign out when idle

With nothing happening for a while (no tap, no scan, nothing on the bill) the till asks for a name and PIN
again, so nobody else at the counter can sell or approve as the last person. Choose how long: 10 minutes
(the usual), 30 minutes, 1 hour or 4 hours. **Never** keeps whoever signed in last until someone presses
Switch; use it only if one person works the till. The till never signs anyone out in the middle of a bill.

## With the Inventory link

The shop's name, address, phone, GSTIN, footer, items, prices, GST rates, offers and the cashier's discount
limit come from Inventory with **Refresh items from Inventory**, and Shop details is shown here read-only. See [Inventory link](/help/behind/inventory-link).

Also under Settings: **Inventory link** and **Devices** (see [Devices](/help/setup/devices)).
