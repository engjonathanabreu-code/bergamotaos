import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message === 'Invalid login credentials' ? 'E-mail ou senha inválidos.' : error.message);
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) setError(error.message);
        else setInfo('Enviamos um link para redefinir a senha no seu e-mail.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col">
      <div className="h-48 bg-amber-500" />
      <div className="flex-1 flex justify-center px-4 -mt-32">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 text-white mb-6">
            <Logo />
            <div>
              <div className="text-2xl font-medium leading-none">bergamota</div>
              <div className="text-xs tracking-[0.3em] uppercase opacity-90 mt-1">OS · gestão</div>
            </div>
          </div>
          <form onSubmit={submit} className="bg-white rounded-[4px] shadow-lg p-6 space-y-5">
            <h1 className="text-lg text-stone-800">{mode === 'login' ? 'Entrar' : 'Recuperar senha'}</h1>
            <label className="block">
              <span className="field-label">E-mail</span>
              <input type="email" required autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {mode === 'login' && (
              <label className="block">
                <span className="field-label">Senha</span>
                <input type="password" required autoComplete="current-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
            )}
            {error && <p className="text-xs text-rose-600">{error}</p>}
            {info && <p className="text-xs text-emerald-700">{info}</p>}
            <button type="submit" disabled={busy} className="btn btn-primary w-full">
              {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Enviar link'}
            </button>
            <button type="button" className="btn btn-text w-full" onClick={() => setMode(mode === 'login' ? 'reset' : 'login')}>
              {mode === 'login' ? 'Esqueci minha senha' : 'Voltar ao login'}
            </button>
          </form>
          <p className="text-center text-[11px] text-stone-400 mt-4">Acesso restrito à equipe Bergamota.</p>
        </div>
      </div>
    </div>
  );
}

export function Logo({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="36" r="24" fill="#fff" />
      <circle cx="32" cy="36" r="18" fill="#FF9C2E" />
      <path d="M32 12c2-6 8-9 14-8-1 6-6 10-14 8z" fill="#68C166" />
      <circle cx="26" cy="31" r="3" fill="#FFD29F" />
    </svg>
  );
}
