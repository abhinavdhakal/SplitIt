// operate in cents to avoid floating point issues
const toCents = (n) => Math.round(Number(n) * 100);
const fromCents = (c) => (c / 100).toFixed(2);

/**
 * items: [{ id, total_price (float), claimed_by (user_id|null) }]
 * tax_total, tip_total floats
 * returns { perUser: { userId: { subtotal, tax, tip, total }}, rounding_correction_cents }
 */
export function finalizeShares(items, tax_total, tip_total) {
  const taxC = toCents(tax_total);
  const tipC = toCents(tip_total);

  // per-user subtotal in cents
  const subtotals = {}; // userId -> cents
  let subtotalTotalC = 0;
  for (const it of items) {
    const cents = toCents(it.total_price || 0);
    subtotalTotalC += cents;
    const owner = it.claimed_by || "__unclaimed__";
    subtotals[owner] = (subtotals[owner] || 0) + cents;
  }

  // if nothing claimed, split equally across team? here we just leave unclaimed user
  const perUser = {};
  const userIds = Object.keys(subtotals);

  // compute tax and tip proportionally using integer math
  let allocatedTax = 0;
  let allocatedTip = 0;
  for (const uid of userIds) {
    const subC = subtotals[uid];
    // ratio = subC / subtotalTotalC
    const taxShare =
      subtotalTotalC > 0 ? Math.floor((taxC * subC) / subtotalTotalC) : 0;
    const tipShare =
      subtotalTotalC > 0 ? Math.floor((tipC * subC) / subtotalTotalC) : 0;
    allocatedTax += taxShare;
    allocatedTip += tipShare;
    const totalC = subC + taxShare + tipShare;
    perUser[uid] = {
      subtotal: fromCents(subC),
      tax: fromCents(taxShare),
      tip: fromCents(tipShare),
      total: fromCents(totalC),
    };
  }

  // rounding correction: difference between actual tax/tip and allocated
  let taxDiff = taxC - allocatedTax; // cents remaining to allocate
  let tipDiff = tipC - allocatedTip;

  // distribute leftover cents deterministically: sort user ids and add +1 cent until diff zero
  const sortedUsers = userIds.slice().sort();
  let i = 0;
  while (taxDiff > 0 && sortedUsers.length) {
    const uid = sortedUsers[i % sortedUsers.length];
    const prevTax = toCents(perUser[uid].tax);
    const newTax = prevTax + 1;
    perUser[uid].tax = fromCents(newTax);
    const prevTotal = toCents(perUser[uid].total);
    perUser[uid].total = fromCents(prevTotal + 1);
    taxDiff -= 1;
    i += 1;
  }
  i = 0;
  while (tipDiff > 0 && sortedUsers.length) {
    const uid = sortedUsers[i % sortedUsers.length];
    const prevTip = toCents(perUser[uid].tip);
    const newTip = prevTip + 1;
    perUser[uid].tip = fromCents(newTip);
    const prevTotal = toCents(perUser[uid].total);
    perUser[uid].total = fromCents(prevTotal + 1);
    tipDiff -= 1;
    i += 1;
  }

  // compute rounding correction (how many cents we had to allocate)
  const finalSum = Object.values(perUser).reduce(
    (s, p) => s + toCents(p.total),
    0
  );
  const expectedTotal = subtotalTotalC + taxC + tipC;
  const roundingCorrection = expectedTotal - finalSum; // ideally 0

  return { perUser, roundingCorrectionCents: roundingCorrection };
}
