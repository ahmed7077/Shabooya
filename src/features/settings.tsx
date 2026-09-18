'use client';
import { useState } from 'react';
import {
  Download,
  LogOut,
  ShieldCheck,
  UserRound,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '@/components/app-provider';
import { ProfileForm } from './auth';
import { db } from '@/lib/supabase/client';
import { removeImages, rpc } from '@/lib/supabase/repository';
import { clearLocal } from '@/lib/offline/storage';
import { ErrorText, Field, Modal } from '@/components/ui';
import type { Settings } from '@/types/domain';
export function SettingsScreen({
  editTimetable,
  install,
}: {
  editTimetable: () => void;
  install: () => void;
}) {
    const { data, user, refresh, signOut, pending, online } = useApp();
  const [profile, setProfile] = useState(false),
    [danger, setDanger] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  if (!data || !user) return null;
  const subjects = [...new Set(data.sessions.map((s) => s.subject_name))];
  async function save(patch: Partial<Settings>) {
    if (!data) return;
    setBusy(true);
    setError('');
    try {
      const result = await db()
        .from('user_settings')
        .upsert({ ...data.settings, ...patch });
      if (result.error) throw result.error;
      await refresh();
      setNotice('Preferences saved.');
    } catch {
      setError('Could not save preferences. Check your connection and retry.');
    } finally {
      setBusy(false);
    }
  }
  async function destroy() {
    setBusy(true);
    setError('');
    try {
      if (pending)
        throw new Error('Sync pending attendance before deleting data.');
      if (danger === 'account' || danger === 'images')
        await removeImages(user!.id);
      await rpc('delete_personal_data', { kind: danger });
      if (danger === 'account') {
        await db().auth.signOut({ scope: 'local' });
        await clearLocal(user!.id);
        sessionStorage.clear();
        location.reload();
      } else {
        await refresh();
        setNotice('Your requested data has been removed.');
        setDanger('');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">MAKE IT YOURS</span>
          <h1>Your space. Your preferences.</h1>
          <p>A few small things that make a difference.</p>
        </div>
      </header>
      <ErrorText message={error} />
      {notice && (
        <p role="status" className="success-text">
          {notice}
        </p>
      )}
      <div className="settings-grid">
        <section className="panel">
          <div className="profile-summary">
            <span className="avatar">{data.profile?.name.slice(0, 1)}</span>
            <div>
              <h2>{data.profile?.name}</h2>
              <p>{user.email}</p>
              <small>
                {data.profile?.course} · {data.profile?.university}
              </small>
            </div>
          </div>
          <button className="settings-row" onClick={() => setProfile(true)}>
            <UserRound size={19} />
            <span>Edit profile</span>
            <ChevronRight size={17} />
          </button>
          <button className="settings-row" onClick={editTimetable}>
            <RefreshCw size={19} />
            <span>Replace / edit timetable</span>
            <ChevronRight size={17} />
          </button>
          <p className="fine-print">
            {data.timetable
              ? `${data.timetable.academic_start_date} → ${data.timetable.academic_end_date}`
              : 'No active timetable'}
            <br />
            Timezone: {data.profile?.timezone}
          </p>
          <button className="settings-row" onClick={install}>
            <Download size={19} />
            <span>Install rollcall</span>
            <ChevronRight size={17} />
          </button>
          <button
            className="settings-row"
            onClick={async () => {
              try {
                await signOut();
                sessionStorage.clear();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <LogOut size={19} />
            <span>Sign out</span>
            <ChevronRight size={17} />
          </button>
        </section>
        <section className="panel">
          <h2>Everyday preferences</h2>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void save({
                target: Number(f.get('target')) / 100,
                theme: f.get('theme') as Settings['theme'],
                reminders: f.get('reminders') === 'on',
              });
            }}
          >
            <Field
              label="Your attendance target (%)"
              hint="Set your own requirement. Check your institution’s rules."
            >
              <input
                name="target"
                type="number"
                min="0"
                max="100"
                step="0.1"
                required
                defaultValue={data.settings.target * 100}
              />
            </Field>
            <Field label="Appearance">
              <select name="theme" defaultValue={data.settings.theme}>
                <option value="system">Follow my device</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </Field>
            <label className="check-label">
              <input
                type="checkbox"
                name="reminders"
                defaultChecked={data.settings.reminders}
              />
              Remind me about unmarked classes in the app
            </label>
            <p className="fine-print">
              Reminders appear while using rollcall. Background push
              notifications are not required or enabled.
            </p>
            <button className="button primary" disabled={busy || !online}>
              Save preferences
            </button>
          </form>
        </section>
        <section className="panel">
          <h2>Subject names & targets</h2>
          <p>Rename display labels without changing historical records.</p>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const subject_labels: Record<string, string> = {},
                subject_targets: Record<string, number> = {};
              subjects.forEach((s, i) => {
                subject_labels[s] = String(f.get(`label${i}`) || s).trim() || s;
                const target = f.get(`target${i}`);
                if (target !== '') subject_targets[s] = Number(target) / 100;
              });
              void save({ subject_labels, subject_targets });
            }}
          >
            {subjects.length ? (
              subjects.map((s, i) => (
                <div className="form-grid" key={s}>
                  <Field label={s}>
                    <input
                      name={`label${i}`}
                      maxLength={100}
                      defaultValue={data.settings.subject_labels[s] || s}
                    />
                  </Field>
                  <Field label="Target % (optional)">
                    <input
                      name={`target${i}`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder={`${data.settings.target * 100}`}
                      defaultValue={
                        data.settings.subject_targets[s] !== undefined
                          ? data.settings.subject_targets[s] * 100
                          : ''
                      }
                    />
                  </Field>
                </div>
              ))
            ) : (
              <p className="muted">
                Add a timetable to customize your subjects.
              </p>
            )}
            {subjects.length > 0 && (
              <button disabled={busy || !online} className="button secondary">
                Save subjects
              </button>
            )}
          </form>
        </section>
        <section className="panel privacy-panel">
          <h2>
            <ShieldCheck size={20} />
            Your data, in your hands
          </h2>
          <p>
            Only you can access your profile, timetable images and attendance.
            No ads, analytics or university connection.
          </p>
          <p>
            For offline use, your signed-in data is stored on this device.
            Signing out clears it. Use a device you trust.
          </p>
          <div className="offline-info">
            <span>{pending} changes waiting to sync</span>
            <button
              className="text-button"
              disabled={!online}
              onClick={() => void refresh()}
            >
              Sync now
            </button>
          </div>
          <button
            className="text-button"
            disabled={!!pending}
            onClick={async () => {
              await clearLocal(user.id);
              await refresh();
              setNotice('Offline data refreshed.');
            }}
          >
            Clear and refresh offline data
          </button>
          <details className="danger-zone">
            <summary>Data & account deletion</summary>
            <p>
              These actions cannot be undone. Timetable removal keeps past
              attendance.
            </p>
            {[
              ['images', 'Delete timetable images'],
              ['timetable', 'Remove active timetable'],
              ['history', 'Delete all attendance marks'],
              ['account', 'Delete my account and all data'],
            ].map(([key, label]) => (
              <button
                className="text-button danger-text"
                key={key}
                onClick={() => {
                  setError('');
                  setDanger(key);
                }}
              >
                {label}
              </button>
            ))}
          </details>
        </section>
      </div>
      {profile && (
        <Modal title="Your profile" onClose={() => setProfile(false)}>
          <ProfileForm onDone={() => setProfile(false)} />
        </Modal>
      )}
      {danger && (
        <Modal
          title={
            danger === 'account' ? 'Delete your account?' : 'Delete this data?'
          }
          onClose={() => setDanger('')}
        >
          <p>
            {danger === 'account'
              ? 'This permanently deletes your account, profile, timetable images, sessions and attendance.'
              : 'This is permanent. Removing a timetable preserves past attendance; deleting attendance marks clears your counts.'}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void destroy();
            }}
          >
            <Field label="Type DELETE to confirm">
              <input required pattern="DELETE" autoComplete="off" />
            </Field>
            <ErrorText message={error} />
            <button className="button danger" disabled={busy || !online}>
              {busy ? 'Deleting…' : 'Permanently delete'}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
