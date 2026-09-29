// src/app/login/page.js
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/ui/Toast';
import { loginSuperAdmin, loginClient } from '../../lib/api';
import { Field, Input } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { Eye, EyeOff, User, Lock, Headphones } from 'lucide-react';

const ROLE_HOME = {
  SUPER_ADMIN:  '/dashboard',
  CLIENT_ADMIN: '/admin/dashboard',
  EMPLOYEE:     '/employee/dashboard',
};

// Super admin username comes from env or defaults to 'superadmin'
const SA_USERNAME = process.env.NEXT_PUBLIC_SA_USERNAME || 'superadmin';

export default function LoginPage() {
  const { login }  = useAuth();
  const router     = useRouter();
  const toast      = useToast();
  const [form,     setForm]    = useState({ username: '', password: '' });
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState('');
  const [showPw,   setShowPw]  = useState(false);
  const [remember, setRemember] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Determine which login endpoint to call based on username
      // Super admin has a fixed username stored in .env — no guessing needed
      const isSuperAdmin = form.username.trim() === SA_USERNAME;
      const data = isSuperAdmin
        ? await loginSuperAdmin(form)
        : await loginClient(form);

      // At this point data is guaranteed to have token (api.js throws on error)
      login(data.token);
      toast('Welcome back, ' + data.user.username + '!');
      router.push(ROLE_HOME[data.user.role] || '/login');
    } catch (err) {
      // Show the actual error message from the server
      setError(err.message || 'Invalid credentials. Please check your username and password.');
    } finally {
      setLoading(false);
    }
  };

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="login-page">
      <div className="login-page__left">
        <img src="/banner5.png" alt="DMS — Smart Display Management" className="login-page__banner" />
      </div>

      <div className="login-page__right">
        <div className="login-card">
          <div className="login-card__logo">📺</div>
          <div className="login-card__header">
            <h2>Welcome back 👋</h2>
            <p>Sign in to access your DMS dashboard</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              <Field label="Username">
                <div style={{ position:'relative' }}>
                  <Input
                    type="text"
                    placeholder="Enter your username"
                    value={form.username}
                    onChange={set('username')}
                    required
                    autoFocus
                    autoComplete="username"
                    style={{ paddingRight: 40 }}
                  />
                  <span className="login-input-icon"><User size={16} /></span>
                </div>
              </Field>
              <Field label="Password">
                <div style={{ position:'relative' }}>
                  <Input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={e => setForm(f => ({...f, password: e.target.value}))}
                    style={{ paddingRight: 70 }}
                  />
                  <span className="login-input-icon" style={{ right: 40 }}><Lock size={16} /></span>
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    style={{
                      position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                      color:'var(--text-muted)', background:'none', border:'none',
                      cursor:'pointer', display:'flex', alignItems:'center', padding:4,
                    }}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>

              <div className="login-card__row">
                <label className="login-card__remember">
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
                  Remember me
                </label>
                <button type="button" className="login-card__link">Forgot password?</button>
              </div>

              {error && (
                <div style={{
                  background:'var(--danger-10)',
                  color:'var(--danger)',
                  padding:'10px 14px',
                  borderRadius:'var(--radius-sm)',
                  fontSize:13,
                  lineHeight:1.5,
                }}>
                  ⚠️ {error}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                style={{width:'100%',marginTop:8}}
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </Button>
            </div>
          </form>

          <div className="login-card__divider">or</div>
          <div className="login-card__support">
            <Headphones size={14} />
            Need help? <button type="button" className="login-card__link">Contact support</button>
          </div>

          <div className="login-card__footer">
            © {new Date().getFullYear()} DMS. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}
