export function formatCurrency(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const [whole, decimal] = Math.abs(amount).toFixed(2).split('.');
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}₵${withCommas}.${decimal}`;
}
