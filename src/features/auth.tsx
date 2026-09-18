'use client';
import { useState } from 'react';
import {
  ArrowRight,
  ShieldCheck,
  CalendarDays,
  ChartNoAxesCombined,
} from 'lucide-react';
import { db, configured } from '@/lib/supabase/client';
import { Brand, Field, ErrorText } from '@/components/ui';
import { useApp } from '@/components/app-provider';
import { profileSchema } from '@/lib/validation';
export function AuthScreen() {
  const { error: sessionError } = useApp();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const values = new FormData(e.currentTarget);
    const email = String(values.get('email')).trim(),
      password = String(values.get('password') || '');
    try {
      const client = db();
      if (mode === 'forgot') {
        const result = await client.auth.resetPasswordForEmail(email, {
          redirectTo: location.origin,
        });
        if (result.error) throw result.error;
        setNotice('If an account exists, a password reset link is on its way.');
      } else if (mode === 'signup') {
        const result = await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: location.origin },
        });
        if (result.error) throw result.error;
        if (!result.data.session)
          setNotice('Check your email to confirm your account, then sign in.');
      } else {
        const result = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (result.error) throw result.error;
      }
    } catch {
      setError(
        mode === 'signin'
          ? 'Could not sign in. Check your email and password, or reset your password.'
          : 'This request could not be completed. Check your connection and try again shortly.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">A LITTLE CLARITY. EVERY CLASS.</span>
          <h1>
            Show up.
            <br />
            Stay on track.
          </h1>
          <p>
            Your timetable, attendance and peace of mind.
            <br />
            One small space, just for you.
          </p>
          <div className="story-illustration" aria-hidden="true">
            <div className="illustration-top">
              <CalendarDays />
              <span>YOUR NEXT CHAPTER</span>
              <span className="illustration-dot" />
            </div>
            <div className="illustration-bars">
              {[48, 72, 56, 92, 78, 100, 88].map((n, i) => (
                <span key={i} style={{ height: `${n}%` }} />
              ))}
            </div>
            <div className="illustration-bottom">
              <span>A little more consistent.</span>
              <ChartNoAxesCombined />
            </div>
          </div>
        </div>
        <span className="privacy-note">
          <ShieldCheck size={16} /> Personal by design. Private by default.
        </span>
      </section>
      <section className="auth-form-panel">
        <div className="mobile-brand">
          <Brand />
        </div>
        <div className="auth-form">
          <span className="eyebrow">YOUR DAY, IN FOCUS</span>
          <h2>
            {mode === 'signup'
              ? 'Make room for progress.'
              : mode === 'forgot'
                ? 'Let’s get you back in.'
                : 'Welcome back.'}
          </h2>
          <p>
            {mode === 'signup'
              ? 'Create your personal attendance space.'
              : mode === 'forgot'
                ? 'We’ll email you a link to reset your password.'
                : 'A fresh day. A little more in control.'}
          </p>
          {!configured && (
            <div className="notice">
              <strong>One setup step before you start</strong>
              <p>
                Connect your Supabase project using the two variables in{' '}
                <code>.env.local</code>. The setup guide is in{' '}
                <code>README.md</code>.
              </p>
            </div>
          )}
          <form onSubmit={submit}>
            <Field label="Email address">
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </Field>
            {mode !== 'forgot' && (
              <Field
                label="Password"
                hint={
                  mode === 'signup' ? 'Use at least 10 characters.' : undefined
                }
              >
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    mode === 'signup' ? 'new-password' : 'current-password'
                  }
                  minLength={mode === 'signup' ? 10 : 1}
                  required
                  placeholder="Your password"
                />
              </Field>
            )}
            <ErrorText message={error || sessionError} />
            {notice && (
              <p role="status" className="success-text">
                {notice}
              </p>
            )}
            <button
              className="button primary wide"
              disabled={busy || !configured}
            >
              {busy
                ? 'Just a moment…'
                : mode === 'signup'
                  ? 'Create account'
                  : mode === 'forgot'
                    ? 'Send reset link'
                    : 'Sign in'}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="auth-switch">
            {mode === 'signin' ? (
              <>
                New here?{' '}
                <button
                  onClick={() => {
                    setMode('signup');
                    setNotice('');
                    setError('');
                  }}
                >
                  Create an account
                </button>
                <button
                  className="forgot"
                  onClick={() => {
                    setMode('forgot');
                    setNotice('');
                    setError('');
                  }}
                >
                  Forgot password?
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setMode('signin');
                  setNotice('');
                  setError('');
                }}
              >
                Back to sign in
              </button>
            )}
          </div>
          <p className="fine-print">
            No university login needed.
            <br />
            Your attendance belongs to you.
          </p>
        </div>
      </section>
    </div>
  );
}
export function ProfileForm({ onDone }: { onDone?: () => void }) {
  const { user, data, refresh } = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const p = data?.profile;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    const parsed = profileSchema.safeParse({
      id: user.id,
      email: user.email,
      name: f.get('name'),
      university: f.get('university'),
      course: f.get('course'),
      semester: f.get('semester'),
      student_id: f.get('student_id'),
      timezone: f.get('timezone'),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      setBusy(false);
      return;
    }
    try {
      const result = await db().from('profiles').upsert(parsed.data);
      if (result.error) throw result.error;
      await refresh();
      onDone?.();
    } catch {
      setError(
        'Could not save your profile. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="stack">
      <Field label="Your name">
        <input
          name="name"
          required
          maxLength={100}
          defaultValue={p?.name}
          autoComplete="name"
          placeholder="What should we call you?"
        />
      </Field>
      <Field label="University / college">
        <input
          name="university"
          required
          defaultValue={p?.university}
          maxLength={160}
          placeholder="Your institution"
        />
      </Field>
      <div className="form-grid">
        <Field label="Course">
          <input
            name="course"
            required
            defaultValue={p?.course}
            maxLength={100}
            placeholder="e.g. Medicine"
          />
        </Field>
        <Field label="Semester / year">
          <input
            name="semester"
            required
            defaultValue={p?.semester}
            maxLength={60}
            placeholder="e.g. Year 2"
          />
        </Field>
      </div>
      <Field label="Student ID (optional)">
        <input name="student_id" defaultValue={p?.student_id} maxLength={60} />
      </Field>
      <Field
        label="Timezone"
        hint="Your classes follow this timezone, even while travelling."
      >
        <input
          name="timezone"
          required
          defaultValue={p?.timezone || 'Asia/Kolkata'}
          list="timezones"
        />
        <datalist id="timezones">
          {[
            'Asia/Kolkata',
            'Asia/Dubai',
            'Europe/London',
            'America/New_York',
            'Australia/Sydney',
          ].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </datalist>
      </Field>
      <ErrorText message={error} />
      <button className="button primary" disabled={busy}>
        {busy ? 'Saving…' : p ? 'Save profile' : 'Continue to my timetable'}
        <ArrowRight size={18} />
      </button>
    </form>
  );
}
export function Onboarding() {
  return (
    <main className="onboarding">
      <Brand />
      <div className="panel">
        <span className="eyebrow">01 / A SPACE THAT’S YOURS</span>
        <h1>Let’s start with you.</h1>
        <p>A few details to make rollcall feel like home.</p>
        <ProfileForm />
      </div>
    </main>
  );
}
export function ResetPassword() {
  const { finishRecovery } = useApp();
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <main className="onboarding">
      <Brand />
      <div className="panel">
        <h1>A fresh start.</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const password = String(
              new FormData(e.currentTarget).get('password'),
            );
            const { error } = await db().auth.updateUser({ password });
            setBusy(false);
            if (error)
              setMessage(
                'Could not update your password. Request a new reset link and try again.',
              );
            else finishRecovery();
          }}
        >
          <Field label="New password">
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
            />
          </Field>
          <ErrorText message={message} />
          <button disabled={busy} className="button primary">
            {busy ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      </div>
    </main>
  );
}
