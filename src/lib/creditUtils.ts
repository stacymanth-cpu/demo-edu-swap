export interface CreditTransferResult {
  teacherCredits: number;
  learnerCredits: number;
  amount: number;
}

export function calculateCreditTransfer(teacherBalance: number, learnerBalance: number, amount: number): CreditTransferResult {
  if (![teacherBalance, learnerBalance, amount].every(Number.isFinite)) throw new Error('Credit values must be finite numbers');
  if (teacherBalance < 0 || learnerBalance < 0) throw new Error('Credit balances cannot be negative');
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('Credit amount must be a positive whole number');
  return {
    teacherCredits: teacherBalance + amount,
    learnerCredits: Math.max(0, learnerBalance - amount),
    amount,
  };
}
