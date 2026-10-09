---
title: When the internet drops
summary: Keep selling. The till saves the sale on this computer with the time the customer paid, gives it a bill number when the internet is back, and sends it by itself — dated when it was made, on the till and in Inventory.
for: Everyone
minutes: 2
app: /sync
appLabel: Waiting to sync
keywords: offline internet down no connection wifi gone sale saved on this till waiting to send sync outbox bill number later
---

## Keep selling

Make the bill as usual and press **Complete sale**. The till says:

> **Sale saved on this till** — *The internet is down, so the bill number comes when the sale is sent.
> That happens on its own as soon as the connection is back — nothing to do.*

The chip at the top says **1 sale waiting to send · No connection**.

## When the internet is back

The till sends the waiting sales by itself, oldest first. Each gets its bill number then, and is dated
**when the customer paid** — on the till's bill, in reports, and in Inventory's Day Book. A sale made at
11:55 pm stays on that day even if it is sent the next morning.

**More → Waiting to sync** shows what is waiting, and **Everything is sent** when nothing is.

## What does not work offline

- **Points and store credit** — they are kept by Inventory: *can't be used offline. Take the payment
  another way.*
- Looking up a customer the till has never seen.
- Returns, collecting what is owed, and write-offs — they need the server.

:::warning Close the shift after sending
A shift closed while sales are still waiting expects too little cash. The drawer screen says so: **Send
them first**.
:::

:::faq A waiting sale says "Needs a look"
The server answered with a reason (for example a price that changed). Open **Waiting to sync**, read why,
and **Open in till** to fix and send it again.
:::
