import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './AuthPages.css';

export function AdminLoginPage() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const loginError = await login(email.trim(), password);
    if (loginError) {
      setError(loginError);
      return;
    }
    navigate('/admin');
  };

  return (
    <div className="auth-page">
      <div className="auth-container animate-scale-in">
        <div className="auth-brand"><Shield size={42} /><h1>EduSwap Admin</h1><p className="auth-tagline">Secure platform administration</p></div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>Administrator sign in</h2>
          {error && <div className="auth-error">{error}</div>}
          <div className="form-group"><label htmlFor="admin-email">Email</label><input id="admin-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          <div className="form-group"><label htmlFor="admin-password">Password</label><input id="admin-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          <button className="auth-submit" type="submit" disabled={isLoading}>{isLoading ? <Loader2 className="spinner" /> : <>Sign in securely <ArrowRight size={18} /></>}</button>
        </form>
      </div>
    </div>
  );
}