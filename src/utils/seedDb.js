const KEYS = [
  'budget_bills',
  'budget_debts',
  'budget_months',
  'budget_paycheck_config',
  'budget_playgrounds',
];

/**
 * One-time push of localStorage data into Postgres.
 * Only runs once per browser session.
 */
export async function seedDbFromLocalStorage() {
  if (sessionStorage.getItem('db_seeded')) return;
  for (const key of KEYS) {
    const value = localStorage.getItem(key);
    if (value) {
      try {
        await fetch(`/api/data/${key}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: value,
        });
      } catch {}
    }
  }
  sessionStorage.setItem('db_seeded', '1');
}
