'use client';
import { useEffect, useState } from 'react';
import {
  Copy,
  Plus,
  Trash2,
  Upload,
  ArrowLeft,
  Check,
  Image as ImageIcon,
} from 'lucide-react';
import { useApp } from '@/components/app-provider';
import { Field, ErrorText } from '@/components/ui';
import { SESSION_TYPES, type Entry, type Timetable } from '@/types/domain';
import { generateSessions } from '@/lib/timetable/generator';
import { browserExtractor, compressImage } from '@/lib/timetable/extraction';
import { db } from '@/lib/supabase/client';
import { rpc } from '@/lib/supabase/repository';
export const DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const newEntry = (): Entry => ({
  id: crypto.randomUUID(),
  subject_name: '',
  subject_code: '',
  day_of_week: 1,
  start_time: '09:00',
  end_time: '10:00',
  session_type: 'Lecture',
  batch: '',
  group_name: '',
  recurrence: 'weekly',
  on_date: '',
  is_active: true,
});
export function TimetableEditor({ onClose }: { onClose: () => void }) {
  const { user, data, refresh, online, pending } = useApp();
  const [draft, setDraft] = useState<Timetable>(() => {
    const saved = sessionStorage.getItem(`rollcall-draft:${user!.id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return data?.timetable
      ? { ...data.timetable, id: crypto.randomUUID() }
      : {
          id: crypto.randomUUID(),
          name: 'My timetable',
          academic_start_date: '',
          academic_end_date: '',
          timezone: data?.profile?.timezone || 'Asia/Kolkata',
          source_image_path: null,
          is_active: true,
          entries: [],
        };
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [reviewed, setReviewed] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(''),
    [progress, setProgress] = useState(''),
    [rawText, setRawText] = useState(''),
    [warning, setWarning] = useState('');
  useEffect(() => {
    sessionStorage.setItem(`rollcall-draft:${user!.id}`, JSON.stringify(draft));
  }, [draft, user]);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (file || !draft.source_image_path) {
      if (!file) setPreview('');
      return;
    }
    let active = true;
    void db()
      .storage.from('timetable-images')
      .createSignedUrl(draft.source_image_path, 300)
      .then(({ data }) => {
        if (active && data) setPreview(data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [draft.source_image_path, file]);
  function patchEntry(id: string, patch: Partial<Entry>) {
    setReviewed(false);
    setDraft((d) => ({
      ...d,
      entries: d.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  }
  let count = 0,
    validation = '';
  try {
    count = generateSessions(draft, user!.id).length;
    if (!count) validation = 'No classes fall in this academic period.';
  } catch (e) {
    validation =
      e instanceof Error && e.message.startsWith('Classes overlap')
        ? e.message
        : 'Add valid academic dates and at least one complete class. Check dates, names and times.';
  }
  async function upload(original: File) {
    setBusy(true);
    setError('');
    setProgress('Preparing image…');
    try {
      const image = await compressImage(original);
      setFile(image);
      const path = `${user!.id}/${crypto.randomUUID()}.jpg`;
      const { data: auth } = await db().auth.getSession();
      if (!auth.session)
        throw new Error('Sign in again to upload your timetable.');
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(
          'POST',
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/timetable-images/${path}`,
        );
        xhr.setRequestHeader(
          'Authorization',
          `Bearer ${auth.session!.access_token}`,
        );
        xhr.setRequestHeader(
          'apikey',
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );
        xhr.setRequestHeader('Content-Type', 'image/jpeg');
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            setProgress(
              `Uploading image · ${Math.round((e.loaded / e.total) * 100)}%`,
            );
        };
        xhr.onload = () =>
          xhr.status < 300
            ? resolve()
            : reject(new Error('Upload failed. Please retry.'));
        xhr.onerror = () =>
          reject(new Error('Upload failed. Check your connection and retry.'));
        xhr.timeout = 60000;
        xhr.ontimeout = () =>
          reject(new Error('Upload timed out. Please retry.'));
        xhr.send(image);
      });
      setDraft((d) => ({ ...d, source_image_path: path }));
      setProgress('Image uploaded privately. Ready to extract.');
    } catch (e) {
      setError((e as Error).message);
      setProgress('');
    } finally {
      setBusy(false);
    }
  }
  async function extract() {
    if (!file) return;
    setBusy(true);
    setError('');
    setWarning('');
    try {
      setProgress('Loading free OCR…');
      const result = await browserExtractor.extract(file, (n) =>
        setProgress(`Reading image · ${n}%`),
      );
      setRawText(result.rawText);
      if (!result.entries.length) {
        setWarning(
          "We couldn't reliably read this timetable. Try Again or Create Timetable Manually below.",
        );
      } else {
        setDraft((d) => ({
          ...d,
          entries: [...d.entries, ...result.entries],
          academic_start_date:
            d.academic_start_date || result.academicStart || '',
          academic_end_date: d.academic_end_date || result.academicEnd || '',
        }));
        setWarning(result.warnings.join(' '));
      }
      setReviewed(false);
    } catch {
      setWarning(
        "We couldn't reliably read this timetable. Try Again or Create Timetable Manually below.",
      );
    } finally {
      setBusy(false);
      setProgress('');
    }
  }
  async function removeImage() {
    setBusy(true);
    setError('');
    try {
      if (
        draft.source_image_path &&
        draft.source_image_path !== data?.timetable?.source_image_path
      ) {
        const result = await db()
          .storage.from('timetable-images')
          .remove([draft.source_image_path]);
        if (result.error) throw result.error;
      }
      setDraft((d) => ({ ...d, source_image_path: null }));
      setFile(null);
      setPreview('');
    } catch {
      setError('Could not remove image. Try again.');
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (pending) {
      setError('Sync pending attendance before replacing your timetable.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await rpc('activate_timetable', { draft });
      sessionStorage.removeItem(`rollcall-draft:${user!.id}`);
      await refresh();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="editor">
      <button className="text-button" onClick={onClose}>
        <ArrowLeft size={17} />
        Back to my day
      </button>
      <header className="page-heading">
        <div>
          <span className="eyebrow">YOUR ROUTINE, YOUR WAY</span>
          <h1>
            {data?.timetable
              ? 'Update your timetable.'
              : 'Make space for your classes.'}
          </h1>
          <p>Upload a photo or build your week. You have the final say.</p>
        </div>
      </header>
      <div className="editor-grid">
        <div className="stack">
          <section className="panel">
            <h2>
              01 <span>Academic period</span>
            </h2>
            <Field label="Timetable name">
              <input
                value={draft.name}
                maxLength={100}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, name: e.target.value }))
                }
              />
            </Field>
            <div className="form-grid">
              <Field label="Academic start">
                <input
                  type="date"
                  value={draft.academic_start_date}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      academic_start_date: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Academic end">
                <input
                  type="date"
                  value={draft.academic_end_date}
                  min={draft.academic_start_date}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      academic_end_date: e.target.value,
                    }))
                  }
                />
              </Field>
            </div>
            <Field label="Timetable timezone">
              <input
                value={draft.timezone}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, timezone: e.target.value }))
                }
              />
            </Field>
          </section>
          <section className="panel">
            <h2>
              02{' '}
              <span>
                Start with an image <small>Optional</small>
              </span>
            </h2>
            <label className="upload-zone">
              <Upload />
              <strong>
                {preview ? 'Replace timetable image' : 'Upload your timetable'}
              </strong>
              <span>JPG or PNG · up to 20 MB</span>
              <input
                type="file"
                accept="image/jpeg,image/png"
                disabled={busy || !online}
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  if (selected) void upload(selected);
                  e.target.value = '';
                }}
              />
            </label>
            {preview && (
              <>
                <div className="image-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Your timetable for review" />
                </div>
                <div className="button-row">
                  <button
                    className="button secondary"
                    onClick={() => void extract()}
                    disabled={busy || !file}
                  >
                    <ImageIcon size={16} />
                    Try automatic extraction
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Remove image"
                    disabled={busy}
                    onClick={() => void removeImage()}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </>
            )}
            {progress && <p role="status">{progress}</p>}
            {warning && (
              <div className="notice">
                {warning}
                <div className="button-row">
                  {file && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => void extract()}
                    >
                      Try Again
                    </button>
                  )}
                  <button
                    className="text-button"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        entries: [...d.entries, newEntry()],
                      }))
                    }
                  >
                    Create Timetable Manually
                  </button>
                </div>
              </div>
            )}
            {rawText && (
              <details>
                <summary>Recognized text</summary>
                <pre className="ocr-text">{rawText}</pre>
              </details>
            )}
            <p className="fine-print">
              OCR runs in your browser. It can miss grid layouts. Always review
              the result.
            </p>
          </section>
        </div>
        <section className="panel">
          <div className="section-heading">
            <h2>
              03 <span>Review your week</span>
            </h2>
            <span className="count-pill">{draft.entries.length} classes</span>
          </div>
          {draft.entries.length === 0 && (
            <div className="inline-empty">
              A blank page for a new routine.
              <br />
              Add your first class below.
            </div>
          )}
          <div className="entry-list">
            {draft.entries.map((e, i) => (
              <details
                className="entry-editor"
                key={e.id}
                open
              >
                <summary>
                  <span className="entry-day">
                    {e.recurrence === 'once'
                      ? e.on_date || 'Once'
                      : DAYS[e.day_of_week].slice(0, 3)}
                  </span>
                  <span>
                    <strong>{e.subject_name || 'New class'}</strong>
                    <small>
                      {e.start_time}–{e.end_time} · {e.session_type}
                      {!e.is_active ? ' · Inactive' : ''}
                    </small>
                  </span>
                  {e.needs_review && <span className="review-tag">Review</span>}
                </summary>
                <div className="entry-fields">
                  <Field label={`Subject ${i + 1}`}>
                    <input
                      value={e.subject_name}
                      onChange={(event) =>
                        patchEntry(e.id, { subject_name: event.target.value })
                      }
                      maxLength={100}
                      placeholder="Subject name"
                    />
                  </Field>
                  <div className="form-grid">
                    <Field label="Recurrence">
                      <select
                        value={e.recurrence}
                        onChange={(event) =>
                          patchEntry(e.id, {
                            recurrence: event.target
                              .value as Entry['recurrence'],
                          })
                        }
                      >
                        <option value="weekly">Every week</option>
                        <option value="once">One-time class</option>
                      </select>
                    </Field>
                    {e.recurrence === 'weekly' ? (
                      <Field label="Day">
                        <select
                          value={e.day_of_week}
                          onChange={(event) =>
                            patchEntry(e.id, {
                              day_of_week: Number(event.target.value),
                            })
                          }
                        >
                          {DAYS.map((day, i) => (
                            <option key={day} value={i}>
                              {day}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : (
                      <Field label="Date">
                        <input
                          type="date"
                          min={draft.academic_start_date}
                          max={draft.academic_end_date}
                          value={e.on_date}
                          onChange={(event) =>
                            patchEntry(e.id, { on_date: event.target.value })
                          }
                        />
                      </Field>
                    )}
                  </div>
                  <div className="form-grid">
                    <Field label="Start time">
                      <input
                        type="time"
                        value={e.start_time}
                        onChange={(event) =>
                          patchEntry(e.id, { start_time: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="End time">
                      <input
                        type="time"
                        value={e.end_time}
                        onChange={(event) =>
                          patchEntry(e.id, { end_time: event.target.value })
                        }
                      />
                    </Field>
                  </div>
                  <div className="form-grid">
                    <Field label="Session type">
                      <select
                        value={e.session_type}
                        onChange={(event) =>
                          patchEntry(e.id, {
                            session_type: event.target
                              .value as Entry['session_type'],
                          })
                        }
                      >
                        {SESSION_TYPES.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Subject code">
                      <input
                        value={e.subject_code}
                        maxLength={30}
                        onChange={(event) =>
                          patchEntry(e.id, { subject_code: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="Batch">
                      <input
                        value={e.batch}
                        maxLength={60}
                        onChange={(event) =>
                          patchEntry(e.id, { batch: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="Group">
                      <input
                        value={e.group_name}
                        maxLength={60}
                        onChange={(event) =>
                          patchEntry(e.id, { group_name: event.target.value })
                        }
                      />
                    </Field>
                  </div>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={e.is_active}
                      onChange={(event) =>
                        patchEntry(e.id, { is_active: event.target.checked })
                      }
                    />
                    Include in timetable
                  </label>
                  <div className="button-row">
                    <button
                      className="text-button"
                      onClick={() => {
                        setReviewed(false);
                        setDraft((d) => ({
                          ...d,
                          entries: [
                            ...d.entries,
                            { ...e, id: crypto.randomUUID() },
                          ],
                        }));
                      }}
                    >
                      <Copy size={16} />
                      Duplicate
                    </button>
                    <button
                      className="text-button danger-text"
                      onClick={() => {
                        setReviewed(false);
                        setDraft((d) => ({
                          ...d,
                          entries: d.entries.filter((x) => x.id !== e.id),
                        }));
                      }}
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                </div>
              </details>
            ))}
          </div>
          <button
            className="button dashed wide"
            onClick={() => {
              setReviewed(false);
              setDraft((d) => ({ ...d, entries: [...d.entries, newEntry()] }));
            }}
          >
            <Plus size={18} />
            Add a class
          </button>
          <div className="confirm-area">
            {data?.timetable && (
              <p className="notice">
                Past and started classes keep their attendance. Future classes
                will be regenerated; reapply individual reschedules or
                cancellations afterwards. Saved holidays are retained.
              </p>
            )}
            <p>
              {validation || `${count} dated sessions in your academic period.`}
            </p>
            <label className="check-label">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              I reviewed all dates, times, subjects and groups.
            </label>
            <ErrorText message={error} />
            <button
              className="button primary wide"
              disabled={busy || !online || !reviewed || !!validation}
              onClick={() => void confirm()}
            >
              <Check size={18} />
              {busy ? 'Saving…' : 'Confirm timetable'}
            </button>
            <small>
              Your draft stays on this device until you confirm or sign out.
            </small>
          </div>
        </section>
      </div>
    </section>
  );
}
