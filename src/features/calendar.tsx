'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import {
  addDays,
  addMonths,
  format,
  startOfMonth,
  startOfWeek,
  isSameMonth,
  addWeeks,
} from 'date-fns';
import { useApp } from '@/components/app-provider';
import { todayInZone } from '@/lib/timetable/generator';
import { hasOccurred } from '@/lib/attendance/calculator';
import { SessionCard } from './session-card';
import { Empty, ErrorText, Field, Modal } from '@/components/ui';
import { rpc } from '@/lib/supabase/repository';
export function Calendar({
  week = false,
  editTimetable,
}: {
  week?: boolean;
  editTimetable: () => void;
}) {
  const { data, refresh, online, pending } = useApp();
  const today = todayInZone(data?.profile?.timezone || 'Asia/Kolkata');
  const [selected, setSelected] = useState(today),
    [cursor, setCursor] = useState(new Date(`${today}T12:00:00`)),
    [holiday, setHoliday] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [view, setView] = useState<'day' | 'week'>('week');
  if (!data) return null;
  const daySessions = data.sessions.filter((s) => s.session_date === selected);
  const first = week
    ? startOfWeek(cursor, { weekStartsOn: 1 })
    : startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const days = Array.from({ length: week ? 7 : 42 }, (_, i) =>
    addDays(first, i),
  );
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">A LITTLE PERSPECTIVE</span>
          <h1>{week ? 'Your week, laid out.' : 'See the bigger picture.'}</h1>
          <p>
            {week
              ? 'A rhythm that works around your life.'
              : 'Your classes and check-ins, one day at a time.'}
          </p>
        </div>
        <button className="button secondary" onClick={editTimetable}>
          <Plus size={17} />
          Add / edit classes
        </button>
      </header>
      <section className="panel calendar-panel">
        <div className="calendar-toolbar">
          <button
            className="icon-button"
            aria-label={week ? 'Previous week' : 'Previous month'}
            onClick={() =>
              setCursor((c) => (week ? addWeeks(c, -1) : addMonths(c, -1)))
            }
          >
            <ChevronLeft />
          </button>
          <h2>{format(cursor, 'MMMM yyyy')}</h2>
          <button
            className="icon-button"
            aria-label={week ? 'Next week' : 'Next month'}
            onClick={() =>
              setCursor((c) => (week ? addWeeks(c, 1) : addMonths(c, 1)))
            }
          >
            <ChevronRight />
          </button>
          <button
            className="text-button"
            onClick={() => {
              setCursor(new Date(`${today}T12:00:00`));
              setSelected(today);
            }}
          >
            Today
          </button>
        </div>
        <div className="calendar-weekdays">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className={`calendar-grid ${week ? 'week-strip' : ''}`}>
          {days.map((date) => {
            const key = format(date, 'yyyy-MM-dd'),
              sessions = data.sessions.filter((s) => s.session_date === key);
            const states = [
              ...new Set(
                sessions.map((s) =>
                  s.status === 'cancelled'
                    ? 'Cancelled'
                    : !hasOccurred(s)
                      ? 'Upcoming'
                      : s.attendance_status === 'present'
                        ? 'Present'
                        : s.attendance_status === 'absent'
                          ? 'Absent'
                          : 'Pending',
                ),
              ),
            ];
            return (
              <button
                aria-label={`${format(date, 'MMMM d, yyyy')}: ${states.join(', ') || 'No classes'}`}
                aria-pressed={selected === key}
                key={key}
                className={`${selected === key ? 'selected' : ''} ${key === today ? 'today' : ''} ${!week && !isSameMonth(date, cursor) ? 'outside' : ''}`}
                onClick={() => setSelected(key)}
              >
                <span>{format(date, 'd')}</span>
                <span className="calendar-marks">
                  {states.slice(0, 3).map((state) => (
                    <span
                      className={`calendar-mark ${state.toLowerCase()}`}
                      key={state}
                    >
                      {state === 'Present'
                        ? '✓'
                        : state === 'Absent'
                          ? '×'
                          : state === 'Pending'
                            ? '!'
                            : state === 'Cancelled'
                              ? '−'
                              : '·'}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        <div className="calendar-legend">
          {[
            ['✓', 'Present'],
            ['×', 'Absent'],
            ['!', 'Pending'],
            ['·', 'Upcoming'],
            ['−', 'Cancelled'],
            ['', 'No classes'],
          ].map(([symbol, label]) => (
            <span key={label}>
              <b className={label.toLowerCase()}>{symbol || '○'}</b>
              {label}
            </span>
          ))}
        </div>
      </section>
      <div className="section-heading">
        <h2>
          {week && view === 'week'
            ? 'This week'
            : format(new Date(`${selected}T12:00:00`), 'EEEE, d MMMM')}
        </h2>
        <div className="button-row">
          {week && (
            <div className="segmented">
              <button
                aria-pressed={view === 'day'}
                onClick={() => setView('day')}
              >
                Day
              </button>
              <button
                aria-pressed={view === 'week'}
                onClick={() => setView('week')}
              >
                Week
              </button>
            </div>
          )}
          <button className="text-button" onClick={() => setHoliday(true)}>
            Add holiday
          </button>
        </div>
      </div>
      {week && view === 'week' ? (
        days.map((day) => {
          const key = format(day, 'yyyy-MM-dd'),
            sessions = data.sessions.filter((s) => s.session_date === key);
          return (
            <section className="week-day" key={key}>
              <h3>
                {format(day, 'EEEE, d MMM')}{' '}
                {key === today && <span className="count-pill">Today</span>}
              </h3>
              {sessions.length ? (
                sessions.map((s) => <SessionCard session={s} key={s.id} />)
              ) : (
                <p className="muted">
                  No classes. A little space in your week.
                </p>
              )}
            </section>
          );
        })
      ) : daySessions.length ? (
        <div className="session-list">
          {daySessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      ) : (
        <Empty
          title="Nothing on the timetable."
          description="No classes scheduled for this day."
        />
      )}
      {holiday && (
        <Modal title="Add a holiday" onClose={() => setHoliday(false)}>
          <p>
            Classes on this date will be cancelled and excluded from attendance.
            You can restore individual classes later.
          </p>
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (pending) {
                setError('Sync pending attendance first.');
                return;
              }
              setBusy(true);
              setError('');
              const f = new FormData(e.currentTarget);
              try {
                await rpc('add_holiday', {
                  date_input: f.get('date'),
                  reason_input: f.get('reason'),
                });
                await refresh();
                setHoliday(false);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Holiday date">
              <input type="date" name="date" defaultValue={selected} required />
            </Field>
            <Field label="Reason">
              <input
                name="reason"
                required
                maxLength={150}
                placeholder="e.g. Public holiday"
              />
            </Field>
            <ErrorText message={error} />
            <button className="button primary" disabled={busy || !online}>
              {busy ? 'Saving…' : 'Save holiday'}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
