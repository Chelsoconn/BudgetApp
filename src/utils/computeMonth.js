/**
 * Shared logic for computing a single month's financials.
 * Used by both Dashboard and MonthlyBudget so they always agree.
 */

export function computeMonthFinancials(month, bills, carryoverIn = 0) {
  const paidBills = new Set(month.paidBills ?? []);
  const billOverrides = month.billOverrides ?? {};

  const billAmount = (bill) => billOverrides[bill.id] ?? bill.amount;
  const activeBillsTotal = bills.filter((b) => !paidBills.has(b.id)).reduce((s, b) => s + billAmount(b), 0);

  const totalIncome = month.paychecks.reduce((s, p) => s + p.amount, 0);
  const bankBalance = month.bankBalance ?? 0;
  const amexBalance = month.amexBalance ?? 0;
  const extraExpenses = (month.spending ?? 0) + (month.other ?? 0);
  const totalExpenses = activeBillsTotal + extraExpenses;
  const adjustments = (month.adjustments ?? []).reduce((s, a) => s + a.amount, 0);

  const effectiveCarryover = month.carryoverOverride ?? carryoverIn;
  const effectiveIncome = month.incomeOverride ?? totalIncome;
  const effectiveExpenses = month.expensesOverride ?? totalExpenses;

  const totalAvailable = effectiveIncome + bankBalance - amexBalance + effectiveCarryover;
  const difference = totalAvailable - effectiveExpenses;
  const monthFinal = difference + adjustments;

  return {
    totalIncome,
    bankBalance,
    amexBalance,
    activeBillsTotal,
    extraExpenses,
    totalExpenses,
    adjustments,
    effectiveCarryover,
    effectiveIncome,
    effectiveExpenses,
    totalAvailable,
    difference,
    monthFinal,
    paidBills,
    billOverrides,
  };
}

/**
 * Compute the carryover chain for all months up to (but not including) targetIdx.
 * Returns the carryover value that feeds into months[targetIdx].
 */
export function computeCarryover(months, bills, targetIdx) {
  let carryover = 0;
  for (let i = 0; i < targetIdx; i++) {
    const { monthFinal } = computeMonthFinancials(months[i], bills, carryover);
    carryover = monthFinal;
  }
  return carryover;
}

/**
 * Compute the full chain of month finals for all months.
 * Returns an array of { name, year, monthFinal, carryover } for each month.
 */
export function computeAllMonths(months, bills) {
  let carryover = 0;
  return months.map((m) => {
    const result = computeMonthFinancials(m, bills, carryover);
    const entry = {
      name: m.name,
      year: m.year,
      monthFinal: result.monthFinal,
      carryover,
      totalIncome: result.totalIncome,
      totalExpenses: result.effectiveExpenses,
      adjustments: result.adjustments,
      difference: result.difference,
    };
    carryover = result.monthFinal;
    return entry;
  });
}
