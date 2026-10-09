---
title: The link to Inventory
summary: The till takes its items, prices, GST and shop details from Inventory, and sends every bill, return, collection and write-off back, in order. What "Sending to Inventory has stopped" means and what to do.
for: The owner connects it; managers can read it
minutes: 3
app: /inventory-link
appLabel: Inventory link
keywords: inventory link connect key refresh items catalogue sending stopped waiting to send being applied try again leave out notes from inventory sync stock
---

**More → Inventory link** (also under **Settings**).

## What comes from Inventory

Items, prices, offers, GST rates, stock, the shop's name, address, phone and GSTIN, the logo, the discount
limit, points and store credit. **Refresh items from Inventory** brings them now; the till also refreshes on
its own.

## What goes to Inventory

Every bill, return, exchange, collection of money owed and write-off — **one at a time, in order**, so a
payment never arrives before its bill. Inventory takes the stock out, and counts the money in its Day Book
on the day it happened.

The page shows **Waiting to send**, **Being applied in Inventory** and **Last sent**.

## Connect a till (owner)

In Inventory make a key (Settings → POS (billing counter)), paste it here, and **Connect**. Then
**Refresh items from Inventory**. Inventory's guide:
[Connect your POS till](https://inventory.scaleezy.com/help/settings/pos-billing-counter).

## "Sending to Inventory has stopped"

The chip at the top says so, and this page says **why** and **at which bill**. Everything after it waits,
safely, in order. Common reasons:

- *An item on this bill is not in Inventory* — add it in Inventory, then **I've fixed it — try again**.
- *Inventory no longer accepts this till's key* — it was replaced; paste the new key.

When it cannot be fixed, the owner can **leave that one bill out** with a reason: the queue moves on, and
Inventory is told the bill was left out.

:::note It waits by itself when Inventory is being updated
If Inventory has not yet learnt a kind of record the till sends, the till waits and sends it again by
itself. Nothing to press.
:::

## Notes from Inventory

Things Inventory noticed, for example *sold 1 more than Inventory had at this store; stock is now −2*. They
do not stop anything; they are for the next stock count.
