'use client';
import { Fragment, useEffect, useRef, useState } from 'react';
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
import { Field, ErrorText, Modal } from '@/components/ui';
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
function entryDay(entry: Entry) {
  if (entry.recurrence === 'once' && entry.on_date) {
    const day = new Date(`${entry.on_date}T12:00:00Z`).getUTCDay();
    if (Number.isFinite(day)) return day;
  }
  return entry.day_of_week;
}
export function TimetableEditor({ onClose }: { onClose: () => void }) {
  const { user, data, refresh, online, pending, notify } = useApp();
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
    [dragging, setDragging] = useState(false),
    [deleting, setDeleting] = useState(''),
    [collapsed, setCollapsed] = useState<string[]>([]),
    [error, setError] = useState(''),
    [reviewed, setReviewed] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(''),
    [progress, setProgress] = useState(''),
    [rawText, setRawText] = useState(''),
    [warning, setWarning] = useState(''),
    [dateRanges, setDateRanges] = useState<[string, string][]>([]),
    [selectedBatch, setSelectedBatch] = useState(() => {
      const active = [
        ...new Set(
          draft.entries
            .filter((e) => e.source_text && e.batch && e.is_active)
            .map((e) => e.batch),
        ),
      ];
      return active.length === 1 ? active[0] : '';
    });
  const savedEntries = useRef(
    new Map(draft.entries.map((e) => [e.id, { ...e }])),
  );
  const orderedEntries = [...draft.entries].sort(
    (a, b) => ((entryDay(a) + 6) % 7) - ((entryDay(b) + 6) % 7),
  );
  const extractedBatches = [
    ...new Set(
      draft.entries.filter((e) => e.source_text && e.batch).map((e) => e.batch),
    ),
  ].sort();
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
  if (extractedBatches.length && !selectedBatch)
    validation = 'Choose your batch from the image before confirming.';
  async function upload(original: File) {
    setBusy(true);
    setError('');
    setProgress('Preparing image…');
    try {
      const image = await compressImage(original);
      setFile(original);
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
      notify('Timetable image uploaded.');
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
      setDateRanges(result.dateRanges || []);
      setSelectedBatch('');
      if (!result.entries.length) {
        setWarning(
          "We couldn't reliably read this timetable. Try Again or Create Timetable Manually below.",
        );
      } else {
        result.entries.forEach((entry) =>
          savedEntries.current.set(entry.id, {
            ...entry,
            is_active: entry.batch ? false : entry.is_active,
          }),
        );
        setDraft((d) => ({
          ...d,
          entries: [
            ...d.entries.filter((e) => !e.source_text),
            ...result.entries.map((e) => ({
              ...e,
              is_active: e.batch ? false : e.is_active,
            })),
          ],
          academic_start_date:
            d.academic_start_date || result.academicStart || '',
          academic_end_date: d.academic_end_date || result.academicEnd || '',
        }));
        setWarning(result.warnings.join(' '));
      }
      setReviewed(false);
    } catch (cause) {
      console.error('Timetable extraction failed', cause);
      setWarning(
        'Automatic extraction could not start. Check your connection, disable content blocking for this site, and try again. You can still create the timetable manually below.',
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
      setProgress('');
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
      notify('Timetable saved. Your schedule is ready.');
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
      <ol className="import-steps" aria-label="Timetable import steps">
        {['Upload', 'Processing', 'Review', 'Confirm'].map((step, i) => (
          <li
            key={step}
            aria-current={
              (busy ? 1 : reviewed ? 3 : draft.entries.length ? 2 : 0) === i
                ? 'step'
                : undefined
            }
          >
            {i + 1}. {step}
          </li>
        ))}
      </ol>
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
            <label
              className={`upload-zone ${dragging ? 'dragging' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                if (!busy && online) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const selected = event.dataTransfer.files[0];
                if (selected && !busy && online) void upload(selected);
              }}
            >
              <Upload />
              <strong>
                {preview ? 'Replace timetable image' : 'Upload your timetable'}
              </strong>
              <span>Drop a photo or tap to choose · JPG / PNG · 20 MB</span>
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
                    onClick={() => setDeleting('image')}
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
            {dateRanges.length > 1 && (
              <Field label="Academic period printed in the image">
                <select
                  value={dateRanges.findIndex(
                    (r) =>
                      r[0] === draft.academic_start_date &&
                      r[1] === draft.academic_end_date,
                  )}
                  onChange={(event) => {
                    const range = dateRanges[Number(event.target.value)];
                    if (range) {
                      setReviewed(false);
                      setDraft((d) => ({
                        ...d,
                        academic_start_date: range[0],
                        academic_end_date: range[1],
                      }));
                    }
                  }}
                >
                  <option value={-1}>Choose the applicable period</option>
                  {dateRanges.map((r, i) => (
                    <option key={r.join()} value={i}>
                      {r[0]} to {r[1]}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {extractedBatches.length > 0 && (
              <Field label="Your batch in this timetable">
                <select
                  value={selectedBatch}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedBatch(value);
                    setReviewed(false);
                    setDraft((d) => ({
                      ...d,
                      entries: d.entries.map((e) =>
                        e.source_text && e.batch
                          ? {
                              ...e,
                              is_active: e.batch === value && !e.review_reason,
                            }
                          : e,
                      ),
                    }));
                  }}
                >
                  <option value="">Choose your batch</option>
                  {extractedBatches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <p className="fine-print">
              Reads table cells, merged periods and weekday patterns on your
              device. Check the preview before confirming. Missing dates or
              batch membership cannot be inferred from the image.
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
            {orderedEntries.map((e, position) => {
              const i = draft.entries.findIndex((entry) => entry.id === e.id);
              return (
                <Fragment key={e.id}>
                  {(position === 0 ||
                    entryDay(orderedEntries[position - 1]) !== entryDay(e)) && (
                    <h3 className="entry-group-title">{DAYS[entryDay(e)]}</h3>
                  )}
                  <details
                    className="entry-editor"
                    data-review={!!e.needs_review}
                    open={
                      !collapsed.includes(e.id) &&
                      (!e.source_text || e.needs_review)
                    }
                  >
                    <summary
                      onClick={(event) => {
                        if (
                          !event.currentTarget.parentElement?.hasAttribute(
                            'open',
                          )
                        )
                          savedEntries.current.set(e.id, { ...e });
                      }}
                    >
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
                      {e.needs_review ? (
                        <span className="review-tag">Review</span>
                      ) : e.source_text ? (
                        <span className="count-pill">✓ Read</span>
                      ) : null}
                    </summary>
                    <div className="entry-fields">
                      {e.source_text && (
                        <details>
                          <summary>Text from this timetable cell</summary>
                          <pre className="ocr-text">{e.source_text}</pre>
                        </details>
                      )}
                      {e.review_reason && (
                        <div className="notice">
                          <p>{e.review_reason}</p>
                          <button
                            className="text-button"
                            onClick={() =>
                              patchEntry(e.id, {
                                review_reason: '',
                                needs_review: false,
                              })
                            }
                          >
                            I have checked and resolved this row
                          </button>
                        </div>
                      )}
                      <Field label={`Subject ${i + 1}`}>
                        <input
                          value={e.subject_name}
                          onChange={(event) =>
                            patchEntry(e.id, {
                              subject_name: event.target.value,
                            })
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
                                patchEntry(e.id, {
                                  on_date: event.target.value,
                                })
                              }
                            />
                          </Field>
                        )}
                      </div>
                      {e.recurrence === 'weekly' && (
                        <Field label="Weeks of the month">
                          <select
                            value={(e.month_weeks || []).join(',')}
                            onChange={(event) =>
                              patchEntry(e.id, {
                                month_weeks: event.target.value
                                  ? event.target.value.split(',').map(Number)
                                  : [],
                              })
                            }
                          >
                            <option value="">Every occurrence</option>
                            <option value="1,3,5">1st, 3rd and 5th</option>
                            <option value="2,4">2nd and 4th</option>
                          </select>
                        </Field>
                      )}
                      <div className="form-grid">
                        <Field label="Start time">
                          <input
                            type="time"
                            value={e.start_time}
                            onChange={(event) =>
                              patchEntry(e.id, {
                                start_time: event.target.value,
                              })
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
                              patchEntry(e.id, {
                                subject_code: event.target.value,
                              })
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
                              patchEntry(e.id, {
                                group_name: event.target.value,
                              })
                            }
                          />
                        </Field>
                      </div>
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={e.is_active}
                          onChange={(event) =>
                            patchEntry(e.id, {
                              is_active: event.target.checked,
                            })
                          }
                        />
                        Include in timetable
                      </label>
                      <div className="button-row">
                        <button
                          className="button secondary"
                          onClick={(event) => {
                            savedEntries.current.set(e.id, { ...e });
                            const details =
                              event.currentTarget.closest('details');
                            if (details) details.open = false;
                            setCollapsed((v) => [...v, e.id]);
                            notify(
                              'Class saved in draft. Confirm the timetable to activate it.',
                            );
                          }}
                        >
                          Save class
                        </button>
                        <button
                          className="text-button"
                          onClick={(event) => {
                            const saved = savedEntries.current.get(e.id);
                            const details =
                              event.currentTarget.closest('details');
                            if (details) details.open = false;
                            if (saved) patchEntry(e.id, saved);
                            else
                              setDraft((d) => ({
                                ...d,
                                entries: d.entries.filter(
                                  (row) => row.id !== e.id,
                                ),
                              }));
                            setCollapsed((v) => [...v, e.id]);
                          }}
                        >
                          Cancel edit
                        </button>
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
                            setDeleting(e.id);
                          }}
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </div>
                    </div>
                  </details>
                </Fragment>
              );
            })}
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
      {deleting && (
        <Modal
          title={
            deleting === 'image' ? 'Remove this image?' : 'Delete this class?'
          }
          onClose={() => setDeleting('')}
        >
          <p>
            {deleting === 'image'
              ? 'The image will be removed from this draft. Your classes stay available.'
              : 'This removes the class from your draft. Your active timetable changes only after confirmation.'}
          </p>
          <div className="button-row">
            <button
              className="button secondary"
              onClick={() => setDeleting('')}
            >
              Keep it
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={() => {
                if (deleting === 'image') void removeImage();
                else {
                  setReviewed(false);
                  setDraft((d) => ({
                    ...d,
                    entries: d.entries.filter((e) => e.id !== deleting),
                  }));
                }
                setDeleting('');
              }}
            >
              Remove
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
