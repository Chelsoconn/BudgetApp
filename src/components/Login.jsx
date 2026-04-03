import { useState } from 'react';

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!password.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        onLogin();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="logo-mark" style={{ width: 48, height: 40, fontSize: 16, margin: '0 auto 12px' }}>B&C</div>
          <h1>Tracker</h1>
          <p>Make that Monaay</p>
        </div>
        <form onSubmit={submit}>
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            style={{ width: '100%', padding: '12px 16px', fontSize: 15, marginBottom: 12 }}
          />
          {error && <div className="login-error">{error}</div>}
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !password.trim()}
            style={{ width: '100%', padding: '12px', fontSize: 15 }}
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}
