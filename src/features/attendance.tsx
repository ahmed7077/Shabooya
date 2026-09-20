'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, ArrowUpRight, SlidersHorizontal } from 'lucide-react';
import { useApp } from '@/components/app-provider';
import {
  calculateAttendance,
  calculateMissableClasses,
  calculateRecoveryClasses,
  calculateProjection,
  percentageLabel,
  hasOccurred,
} from '@/lib/attendance/calculator';
import { Field, Empty } from '@/components/ui';
import { SessionCard } from './session-card';
const AttendanceCharts = dynamic(
  () => import('@/components/attendance-charts'),
  {
    loading: () => (
      <div
        className="skeleton chart-skeleton"
        aria-label="Loading attendance charts"
      />
    ),
  },
);
export function Attendance({
  subject,
  pendingOnly = false,
  navigate,
}: {
  subject?: string;
  pendingOnly?: boolean;
  navigate: (tab: string) => void;
}) {
  const { data, mark } = useApp();
  const [projection, setProjection] = useState(3),
    [missProjection, setMissProjection] = useState(0),
    [targetOverride, setTargetOverride] = useState<number | null>(null),
    [sessionType, setSessionType] = useState('All'),
    [selected, setSelected] = useState<string[]>([]),
    [page, setPage] = useState(1);
  if (!data) return null;
  const sessions = data.sessions.filter(
      (s) =>
        (!subject || s.subject_name === subject) &&
        (sessionType === 'All' || s.session_type === sessionType),
    ),
    stats = calculateAttendance(sessions),
    target =
      targetOverride ??
      (subject
        ? (data.settings.subject_targets[subject] ?? data.settings.target)
        : data.settings.target);
  const missable = calculateMissableClasses(
      stats.present,
      stats.absent,
      target,
    ),
    recovery = calculateRecoveryClasses(stats.present, stats.absent, target);
  const past = sessions
    .filter(
      (s) =>
        hasOccurred(s) &&
        (!pendingOnly || (!s.attendance_status && s.status !== 'cancelled')),
    )
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const future = sessions.filter((s) => !hasOccurred(s));
  const subjects = [...new Set(sessions.map((s) => s.subject_name))];
  async function bulk(status: 'present' | 'absent') {
    for (const id of selected) await mark(id, status);
    setSelected([]);
  }
  return (
    <>
      {subject && (
        <button className="text-button" onClick={() => navigate('Attendance')}>
          <ArrowLeft size={16} />
          All subjects
        </button>
      )}
      <header className="page-heading">
        <div>
          <span className="eyebrow">EVERY CLASS COUNTS</span>
          <h1>
            {pendingOnly
              ? 'A quick catch-up.'
              : subject
                ? data.settings.subject_labels[subject] || subject
                : 'Your progress, clearly.'}
          </h1>
          <p>
            {pendingOnly
              ? 'Unmarked classes are never counted as absences.'
              : 'Real numbers. Only the classes you’ve marked.'}
          </p>
        </div>
      </header>
      {!pendingOnly && (
        <>
          <div className="analytics-toolbar">
            <Field label="Session type">
              <select
                value={sessionType}
                onChange={(e) => {
                  setSessionType(e.target.value);
                  setPage(1);
                  setSelected([]);
                }}
              >
                <option>All</option>
                {[
                  ...new Set(
                    data.sessions
                      .filter((s) => !subject || s.subject_name === subject)
                      .map((s) => s.session_type),
                  ),
                ]
                  .sort()
                  .map((type) => (
                    <option key={type}>{type}</option>
                  ))}
              </select>
            </Field>
            <span>Only completed, marked classes count.</span>
          </div>
          <div className="stat-grid">
            <div className="panel main-stat">
              <span>Current attendance</span>
              <strong>{percentageLabel(stats.percentage)}</strong>
              <small>
                {stats.counted
                  ? 'Weighted by marked classes'
                  : 'No attendance yet'}
              </small>
            </div>
            {[
              ['Present', stats.present],
              ['Absent', stats.absent],
              ['Counted', stats.counted],
              ['Future', future.filter((s) => s.status !== 'cancelled').length],
            ].map(([label, value]) => (
              <div className="panel small-stat" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <AttendanceCharts
            sessions={sessions}
            target={
              subject
                ? (data.settings.subject_targets[subject] ??
                  data.settings.target)
                : data.settings.target
            }
          />
          <section className="calculator panel">
            <div className="section-heading">
              <h2>
                <SlidersHorizontal size={19} />
                Plan your next move
              </h2>
              <span className="count-pill">Target {target * 100}%</span>
            </div>
            <Field
              label="Planning target (%)"
              hint="Explore a target here. Your saved requirement stays in Profile."
            >
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={Number((target * 100).toFixed(1))}
                onChange={(e) =>
                  setTargetOverride(
                    Math.min(100, Math.max(0, Number(e.target.value) || 0)) /
                      100,
                  )
                }
              />
            </Field>
            <div className="calculator-grid">
              <div>
                <small>ROOM TO MISS</small>
                <strong>
                  {Number.isFinite(missable) ? missable : 'Unlimited'}
                  <span> classes</span>
                </strong>
                <p>
                  {stats.percentage === null
                    ? 'Mark your first completed class to build your buffer.'
                    : stats.percentage < target * 100
                      ? 'You are currently below your target.'
                      : 'Before dropping below your target.'}
                </p>
              </div>
              <div>
                <small>TO REACH YOUR TARGET</small>
                <strong>
                  {Number.isFinite(recovery) ? recovery : 'Not finite'}
                  <span>
                    {Number.isFinite(recovery) ? ' consecutive classes' : ''}
                  </span>
                </strong>
                <p>
                  {recovery === Infinity
                    ? 'A past absence prevents reaching exactly 100%.'
                    : recovery === 0
                      ? 'You’re at or above your target. Keep it up.'
                      : 'Attend these next classes without an absence.'}
                </p>
              </div>
              <div>
                <Field label="Attend next N classes">
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    value={projection}
                    onChange={(e) =>
                      setProjection(
                        Math.max(
                          0,
                          Math.min(
                            1000,
                            Math.floor(Number(e.target.value) || 0),
                          ),
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Miss next N classes">
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    value={missProjection}
                    onChange={(e) =>
                      setMissProjection(
                        Math.max(
                          0,
                          Math.min(
                            1000,
                            Math.floor(Number(e.target.value) || 0),
                          ),
                        ),
                      )
                    }
                  />
                </Field>
                <div className="projected-result">
                  <span>Combined projection</span>
                  <strong>
                    {percentageLabel(
                      calculateProjection(
                        stats.present,
                        stats.absent,
                        projection,
                        missProjection,
                      ),
                    )}
                  </strong>
                  <progress
                    aria-label="Projected attendance"
                    value={
                      calculateProjection(
                        stats.present,
                        stats.absent,
                        projection,
                        missProjection,
                      ) || 0
                    }
                    max={100}
                  />
                </div>
                <div className="projection">
                  <span>
                    Attend all{' '}
                    <strong>
                      {percentageLabel(
                        calculateProjection(
                          stats.present,
                          stats.absent,
                          projection,
                          0,
                        ),
                      )}
                    </strong>
                  </span>
                  <span>
                    Miss all{' '}
                    <strong>
                      {percentageLabel(
                        calculateProjection(
                          stats.present,
                          stats.absent,
                          0,
                          projection,
                        ),
                      )}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          </section>
          {!subject && (
            <section>
              <div className="section-heading">
                <h2>By subject</h2>
                <span className="muted">Tap to explore</span>
              </div>
              <div className="subjects-grid">
                {subjects.map((name) => {
                  const s = calculateAttendance(
                    sessions.filter((x) => x.subject_name === name),
                  );
                  const t =
                    data.settings.subject_targets[name] ?? data.settings.target;
                  return (
                    <button
                      className={`panel subject-detail-card ${s.percentage === null ? 'neutral' : s.percentage < t * 100 ? 'warning' : 'healthy'}`}
                      key={name}
                      onClick={() => navigate(`Subject:${name}`)}
                    >
                      <span className="subject-icon">
                        {(data.settings.subject_labels[name] || name)
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                      <ArrowUpRight size={18} />
                      <h3>{data.settings.subject_labels[name] || name}</h3>
                      <strong>{percentageLabel(s.percentage)}</strong>
                      <div className="progress-track">
                        <span style={{ width: `${s.percentage || 0}%` }} />
                      </div>
                      <small>
                        Target {Number((t * 100).toFixed(1))}% · {s.present}{' '}
                        present · {s.absent} absent ·{' '}
                        {s.percentage === null
                          ? 'No marks'
                          : s.percentage < t * 100
                            ? 'Below target'
                            : 'On track'}
                      </small>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
      <section>
        <div className="section-heading">
          <h2>{pendingOnly ? 'Unmarked classes' : 'Attendance history'}</h2>
          <span className="count-pill">{past.length}</span>
        </div>
        {selected.length > 0 && (
          <div className="bulk-actions">
            <span>{selected.length} selected</span>
            <button
              className="button secondary"
              onClick={() => void bulk('present')}
            >
              Mark present
            </button>
            <button
              className="button secondary"
              onClick={() => void bulk('absent')}
            >
              Mark absent
            </button>
          </div>
        )}
        {past.length ? (
          <div className="session-list">
            {past.slice(0, page * 30).map((s) => (
              <div className="history-row" key={s.id}>
                {pendingOnly && (
                  <label className="bulk-select">
                    <input
                      type="checkbox"
                      aria-label={`Select ${s.subject_name} on ${s.session_date}`}
                      checked={selected.includes(s.id)}
                      onChange={(e) =>
                        setSelected((v) =>
                          e.target.checked
                            ? [...v, s.id]
                            : v.filter((id) => id !== s.id),
                        )
                      }
                    />
                  </label>
                )}
                <SessionCard session={s} showDate />
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title={pendingOnly ? 'All caught up.' : 'No attendance yet.'}
            description={
              pendingOnly
                ? 'Your completed classes are all marked.'
                : 'Completed classes appear here. Future classes stay out of your percentage.'
            }
          />
        )}{' '}
        {past.length > page * 30 && (
          <button
            className="button secondary"
            onClick={() => setPage((p) => p + 1)}
          >
            Load more history
          </button>
        )}
      </section>
      {subject && future.length > 0 && (
        <section>
          <div className="section-heading">
            <h2>Coming up</h2>
            <span className="muted">Not counted in attendance</span>
          </div>
          {future.slice(0, 10).map((s) => (
            <SessionCard key={s.id} session={s} showDate />
          ))}
        </section>
      )}
    </>
  );
}
