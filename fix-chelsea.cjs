const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function fix() {
  const { rows: [tmpl] } = await pool.query("SELECT id FROM paycheck_templates WHERE person = 'Chelsea'");
  const tId = tmpl.id;
  console.log('Chelsea template id:', tId);

  const { rows: months } = await pool.query('SELECT id, name, year FROM months ORDER BY sort_order');

  for (const m of months) {
    const { rows: existing } = await pool.query(
      'SELECT COUNT(*) as c FROM paychecks WHERE month_id = $1 AND template_id = $2',
      [m.id, tId]
    );
    const count = parseInt(existing[0].c);
    const needed = 2 - count;
    if (needed > 0) {
      for (let i = 0; i < needed; i++) {
        await pool.query(
          'INSERT INTO paychecks (month_id, template_id, pay_date, amount) VALUES ($1, $2, $3, $4)',
          [m.id, tId, '', 3885]
        );
      }
      console.log(`${m.name} ${m.year}: added ${needed} Chelsea paychecks`);
    }
  }

  const { rows: [{ c }] } = await pool.query('SELECT COUNT(*) as c FROM paychecks');
  console.log('Total paychecks now:', c);
  await pool.end();
}

fix().catch(e => { console.error(e); process.exit(1); });
