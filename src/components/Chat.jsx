import { useState, useRef, useEffect } from 'react';
import { fmt } from '../utils/format';
import { computeAllMonths } from '../utils/computeMonth';

function buildBudgetContext(bills, debts, months, paycheckConfig) {
  const allMonths = computeAllMonths(months, bills);

  const billsSummary = bills.map((b) => `${b.name}: ${fmt(b.amount)}/mo (${b.category})`).join('\n');
  const billsTotal = bills.reduce((s, b) => s + b.amount, 0);

  const debtLines = [
    ...debts.vehicles.map((d) => `Vehicle - ${d.name}: ${fmt(d.amount)}`),
    ...debts.studentLoans.map((d) => `Student Loan - ${d.name}: ${fmt(d.amount)}`),
    ...debts.creditCards.map((d) => `Credit Card - ${d.name}: ${fmt(d.amount)}${d.limit ? ` (limit ${fmt(d.limit)})` : ''}`),
    ...debts.medicalDebt.filter((d) => d.amount > 0).map((d) => `Medical - ${d.name}: ${fmt(d.amount)}`),
  ].join('\n');
  const totalDebt = Object.values(debts).flat().reduce((s, d) => s + d.amount, 0);

  const monthLines = allMonths.map((m) => {
    const mo = months.find((x) => x.name === m.name && x.year === m.year);
    const expenses = (mo?.expenses ?? []).map((e) => `${e.label}: ${fmt(e.amount)}`).join(', ');
    const income = mo?.paychecks.reduce((s, p) => s + p.amount, 0) ?? 0;
    const brandonCount = mo?.paychecks.filter((p) => p.person === 'Brandon').length ?? 0;
    const chelseaCount = mo?.paychecks.filter((p) => p.person === 'Chelsea').length ?? 0;
    return `${m.name} ${m.year}: Income ${fmt(income)} (${brandonCount} Brandon + ${chelseaCount} Chelsea checks), Expenses: ${expenses}, Bills: ${fmt(m.totalExpenses)}, Final: ${fmt(m.monthFinal)}`;
  }).join('\n');

  const dec26 = allMonths.find((m) => m.name === 'December' && m.year === 2026);
  const dec27 = allMonths.find((m) => m.name === 'December' && m.year === 2027);

  return `PAYCHECK CONFIG:
Brandon small (weekly): ${fmt(paycheckConfig.brandonSmall)}
Brandon big (every 3rd week): ${fmt(paycheckConfig.brandonBig)}
Chelsea (15th + last day): ${fmt(paycheckConfig.chelseaPay)}

MONTHLY BILLS (${fmt(billsTotal)}/mo total):
${billsSummary}

DEBTS (${fmt(totalDebt)} total):
${debtLines}

MONTHLY BREAKDOWN:
${monthLines}

MILESTONES:
End of 2026: ${dec26 ? fmt(dec26.monthFinal) : 'N/A'}
End of 2027: ${dec27 ? fmt(dec27.monthFinal) : 'N/A'}
Average overage/month: ${dec27 ? fmt(dec27.monthFinal / months.length) : 'N/A'}`;
}

export default function Chat({ bills, debts, months, paycheckConfig }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const budgetContext = buildBudgetContext(bills, debts, months, paycheckConfig);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updated.slice(-20), // last 20 messages for context window
          budgetContext,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Request failed');
      }

      const { reply } = await res.json();
      setMessages([...updated, { role: 'assistant', content: reply }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)', maxHeight: 700 }}>
      <div className="page-header" style={{ marginBottom: 12, flexShrink: 0 }}>
        <h2>Ask About Your Budget</h2>
        <p className="text-sm text-muted">AI has full context of your bills, debts, income, and projections</p>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="card flex-1"
        style={{ overflowY: 'auto', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}
      >
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, opacity: 0.5 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <div className="text-sm text-muted" style={{ textAlign: 'center' }}>
              Ask anything about your budget<br />
              <span className="text-xs">"Can we afford to pay off Discover this year?"</span><br />
              <span className="text-xs">"What if we cut jiu jitsu?"</span><br />
              <span className="text-xs">"How much are we spending on vehicles?"</span>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              padding: '10px 14px',
              borderRadius: 12,
              background: msg.role === 'user' ? 'var(--accent)' : 'var(--surface2)',
              color: msg.role === 'user' ? 'white' : 'var(--text)',
              fontSize: 14,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          >
            {msg.content}
          </div>
        ))}

        {loading && (
          <div style={{ alignSelf: 'flex-start', padding: '10px 14px', borderRadius: 12, background: 'var(--surface2)', fontSize: 14 }}>
            <span className="text-muted">Thinking...</span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red mb-2" style={{ padding: '0 4px' }}>
          {error}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2" style={{ flexShrink: 0 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask about your budget..."
          style={{ flex: 1, padding: '12px 16px', fontSize: 14 }}
          disabled={loading}
        />
        <button
          className="btn-primary"
          onClick={send}
          disabled={loading || !input.trim()}
          style={{ padding: '12px 20px' }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
