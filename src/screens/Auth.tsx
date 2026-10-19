import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { exploreDemo, signIn, signUp } from '../backend/api';
import { Button, Field, TopBar, errMsg } from '../ui/kit';

function AuthLayout({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="screen">
      <TopBar />
      <div className="pad">
        <h1 className="display">{title}</h1>
        <p className="lede">{sub}</p>
        {children}
      </div>
    </div>
  );
}

export function SignIn() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await signIn(email, pw);
      nav('/', { replace: true });
    } catch (x) {
      setErr(errMsg(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout title="Welcome back" sub="Sign in to your albums.">
      <form className="stack gap-14 mt-24" onSubmit={submit} noValidate>
        <Field label="Email">
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        </Field>
        <Field label="Password" error={err}>
          <input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" required />
        </Field>
        <Button type="submit" size="lg" block loading={busy}>Sign In</Button>
        <p className="hint-card">Demo login: <strong>olivia@lumen.demo</strong> / <strong>demo1234</strong></p>
        <Button type="button" variant="secondary" block onClick={async () => { await exploreDemo(); nav('/', { replace: true }); }}>Explore Demo instead</Button>
        <p className="center muted">New to LUMEN? <Link to="/signup" className="link">Create an account</Link></p>
      </form>
    </AuthLayout>
  );
}

export function SignUp() {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await signUp(name, email, pw);
      nav('/', { replace: true });
    } catch (x) {
      setErr(errMsg(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout title="Create your account" sub="Your memories, beautifully kept — and private by default.">
      <form className="stack gap-14 mt-24" onSubmit={submit} noValidate>
        <Field label="Name">
          <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </Field>
        <Field label="Email">
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="Password" hint="At least 8 characters" error={err}>
          <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" />
        </Field>
        <Button type="submit" size="lg" block loading={busy}>Create Account</Button>
        <p className="center muted">Already have an account? <Link to="/signin" className="link">Sign in</Link></p>
      </form>
    </AuthLayout>
  );
}
