'use client';
import { useState } from 'react';
import { Check, X, MoreHorizontal, MapPin } from 'lucide-react';
import type { Session } from '@/types/domain';
import { hasOccurred } from '@/lib/attendance/calculator';
import { useApp } from '@/components/app-provider';
import { Field, Modal, ErrorText } from '@/components/ui';
import { rpc } from '@/lib/supabase/repository';
export function SessionCard({
  session: s,
  showDate = false,
}: {
  session: Session;
  showDate?: boolean;
}) {
  const { data, mark, refresh, online, pending } = useApp();
  const [edit, setEdit] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const occurred = hasOccurred(s),
    cancelled = s.status === 'cancelled',
    current = !occurred && new Date(s.starts_at) <= new Date();
  const label = data?.settings.subject_labels[s.subject_name] || s.subject_name;
  async function change(action: string, form?: HTMLFormElement) {
    if (pending) {
      setError('Sync your pending marks before changing a class.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const f = form ? new FormData(form) : null;
      await rpc('change_session', {
        session_id_input: s.id,
        action_input: action,
        scope_input: f?.get('scope') || 'one',
        ...(action === 'reschedule'
          ? {
              new_date: f?.get('date'),
              new_start: f?.get('start'),
              new_end: f?.get('end'),
            }
          : {}),
      });
      await refresh();
      setEdit(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className={`session-card ${cancelled ? 'cancelled' : ''}`}>
      <div className="session-time">
        {showDate && (
          <small>
            {new Date(`${s.session_date}T12:00:00`).toLocaleDateString('en', {
              month: 'short',
              day: 'numeric',
            })}
          </small>
        )}
        <strong>{s.start_time.slice(0, 5)}</strong>
        <span>{s.end_time.slice(0, 5)}</span>
      </div>
      <div className="session-info">
        <div className="session-meta">
          <span>{s.session_type}</span>
          {current && <span className="live">In progress</span>}
        </div>
        <h3>{label}</h3>
        {(s.batch || s.group_name) && (
          <small>
            <MapPin size={12} />
            {[s.batch, s.group_name].filter(Boolean).join(' · ')}
          </small>
        )}
        <div className="attendance-actions">
          {cancelled ? (
            <span className="status cancelled-label">
              Cancelled · not counted
            </span>
          ) : occurred ? (
            <>
              <button
                aria-label={`Mark ${label} present`}
                aria-pressed={s.attendance_status === 'present'}
                className={`mark present ${s.attendance_status === 'present' ? 'selected' : ''}`}
                onClick={() => void mark(s.id, 'present')}
              >
                <Check size={16} />
                Present
              </button>
              <button
                aria-label={`Mark ${label} absent`}
                aria-pressed={s.attendance_status === 'absent'}
                className={`mark absent ${s.attendance_status === 'absent' ? 'selected' : ''}`}
                onClick={() => void mark(s.id, 'absent')}
              >
                <X size={16} />
                Absent
              </button>
            </>
          ) : (
            <span className="status">
              {current ? 'Mark after class ends' : 'Upcoming'}
            </span>
          )}
        </div>
      </div>
      <button
        className="icon-button session-menu"
        aria-label={`Options for ${label}`}
        onClick={() => setEdit(true)}
      >
        <MoreHorizontal size={20} />
      </button>
      {edit && (
        <Modal title={label} onClose={() => setEdit(false)}>
          <p>
            {s.session_date} · {s.start_time.slice(0, 5)}–
            {s.end_time.slice(0, 5)}
          </p>
          <ErrorText message={error} />
          {s.attendance_status && !cancelled && (
            <button
              className="button secondary"
              onClick={() => {
                void mark(s.id, null);
                setEdit(false);
              }}
            >
              Clear attendance mark
            </button>
          )}
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void change('reschedule', e.currentTarget);
            }}
          >
            <Field label="Apply changes to">
              <select name="scope">
                <option value="one">This class only</option>
                {new Date(s.starts_at) > new Date() && (
                  <option value="future">
                    All future classes in this series
                  </option>
                )}
              </select>
            </Field>
            {new Date(s.starts_at) > new Date() && !cancelled && (
              <>
                <Field label="New date (this class)">
                  <input
                    type="date"
                    name="date"
                    defaultValue={s.session_date}
                    required
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Starts">
                    <input
                      type="time"
                      name="start"
                      defaultValue={s.start_time.slice(0, 5)}
                      required
                    />
                  </Field>
                  <Field label="Ends">
                    <input
                      type="time"
                      name="end"
                      defaultValue={s.end_time.slice(0, 5)}
                      required
                    />
                  </Field>
                </div>
                <button className="button primary" disabled={busy || !online}>
                  Reschedule
                </button>
              </>
            )}
            <button
              type="button"
              className="button secondary"
              disabled={busy || !online}
              onClick={(e) =>
                void change(
                  cancelled ? 'restore' : 'cancel',
                  e.currentTarget.form!,
                )
              }
            >
              {cancelled ? 'Restore this class' : 'Cancel class'}
            </button>
          </form>
        </Modal>
      )}
    </article>
  );
}
