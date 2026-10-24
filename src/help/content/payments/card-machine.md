---
title: Take a card on your swiping machine
summary: Use any card machine as you always have, then type the last 4 digits and the approval code from the slip on the till. A Pine Labs or Razorpay POS machine can also be connected, so the till sends it the amount and confirms itself.
for: Cashiers, managers and the owner
minutes: 2
keywords: card swiping machine pos machine edc pine labs plutus razorpay pos paytm phonepe ezetap bank machine debit credit card last 4 digits approval code auth code slip emi amex tap send to machine connected
---

## 1. Take the card on the machine

Type the amount on the machine, the customer taps, swipes or puts in their PIN, and the machine prints a
slip. Nothing changes here.

## 2. Record it on the till

1. Press **Take payment**, choose [[1]] **Card**.
2. Type the [[2]] **Card last 4** (on the slip, after the stars: ****4321).
3. Type the [[3]] **Approval code** (on the slip as *Appr code*, *Auth code* or *Approval*; 6 letters or
   numbers).
4. Press **Complete sale**.

![The payment box on Card. Card is marked 1, Card last 4 digits 2 and Card approval code 3.](1-card.webp "Both are on the slip the machine prints.")

:::note Any machine, any bank
Typing the slip works with every machine: Pine Labs, Paytm, PhonePe, Ezetap, Mswipe or a bank's own.
Changing your machine changes nothing on the till. EMI and Amex on the machine are card payments too.
:::

## A connected machine (Pine Labs or Razorpay POS)

When the owner has set up the shop's machine in **Settings → Card machines**, the Card row shows
**Send ₹… to the card machine**.

1. Press it. The amount appears on the machine; nothing to type there.
2. The customer taps, swipes or puts in their PIN.
3. The till shows **Approved ✓** and completes the sale by itself, with the last 4 digits and approval code
   filled in from the machine.

Changed your mind? Press **Cancel on the machine**, or **Back**: the amount is taken off the machine. If
the customer had already paid, the till keeps the payment and stays open, so it is never asked for twice.

If the machine's company cannot be reached, the till says so: type the slip as above.

:::faq The sale completed before the machine said approved
The payment is saved as **to check**, linked to the machine. The till asks the machine again every
half minute and marks it paid the moment it was approved — nobody needs to do anything.
:::

## Setting up a machine (owner)

1. Ask your machine's company for its **cloud integration** ids. Pine Labs: Merchant ID, Security token,
   Store ID and Client ID. Razorpay POS: Username, App key and the Device ID.
2. **Settings → Card machines → Add a card machine**, choose the company and type them. The keys are kept
   locked on the server and never shown again.
3. It starts on the company's **test system**, where no real money moves. Try a sale; when it works,
   **Change** it and untick *Test system*.

A machine you **Switch off** is no longer offered at the till.

## Common problems

:::faq "That card payment is already on bill INV/…"
The same last 4 digits and approval code were typed on another bill. Usually it is the previous
customer's slip — check it. A manager can allow it if one payment really paid for both.
:::

:::faq The machine declined
Nothing was paid. Do not complete the sale on **Card** — try again or take another way.
:::
