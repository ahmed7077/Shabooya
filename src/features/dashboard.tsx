'use client';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarPlus,
  Check,
  Clock3,
  Sparkles,
} from 'lucide-react';
import { useApp } from '@/components/app-provider';
import {
  calculateAttendance,
  hasOccurred,
  percentageLabel,
} from '@/lib/attendance/calculator';
import { todayInZone } from '@/lib/timetable/generator';
import { Empty } from '@/components/ui';
import { SessionCard } from './session-card';
export function Dashboard({
  navigate,
  editTimetable,
}: {
  navigate: (tab: string) => void;
  editTimetable: () => void;
}) {
  const { data } = useApp();
  if (!data) return null;
  const today = todayInZone(data.profile?.timezone || 'Asia/Kolkata');
  const sessions = data.sessions.filter((s) => s.session_date === today);
  const summary = calculateAttendance(data.sessions),
    marked = sessions.filter(
      (s) => s.attendance_status && s.status !== 'cancelled' && hasOccurred(s),
    ).length;
  const pending = data.sessions.filter(
    (s) => hasOccurred(s) && s.status !== 'cancelled' && !s.attendance_status,
  );
  const subjects = [...new Set(data.sessions.map((s) => s.subject_name))];
  const next = data.sessions.find(
    (s) => s.status !== 'cancelled' && !hasOccurred(s),
  );
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">
            {new Date(`${today}T12:00:00`).toLocaleDateString('en', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </span>
          <h1>
            A little more on track<span className="accent">.</span>
          </h1>
          <p>
            Welcome back, {data.profile?.name.split(' ')[0]}. Let’s make today
            count.
          </p>
        </div>
        <button
          className="button secondary desktop-only"
          onClick={editTimetable}
        >
          <CalendarPlus size={17} />
          Manage timetable
        </button>
      </header>
      <div className="dashboard-grid">
        <section className="attendance-hero">
          <div className="hero-copy">
            <span className="eyebrow">YOUR ATTENDANCE</span>
            <div className="hero-number">
              {percentageLabel(summary.percentage)}
              <span className="trend">
                <ArrowUpRight size={18} />
              </span>
            </div>
            <p>
              {summary.counted
                ? `${summary.present} present out of ${summary.counted} marked classes`
                : 'Your first mark is the start of your story.'}
            </p>
            <span className="hero-target">
              <span />
              Your target · {Math.round(data.settings.target * 100)}%
            </span>
          </div>
          <div
            className="attendance-ring"
            style={
              {
                '--progress': `${summary.percentage || 0}%`,
              } as React.CSSProperties
            }
          >
            <div>
              <Check size={25} />
              <strong>
                {summary.percentage === null
                  ? 'Let’s begin'
                  : summary.percentage >= data.settings.target * 100
                    ? 'On track'
                    : 'Keep going'}
              </strong>
              <small>
                {summary.percentage === null
                  ? 'One class at a time'
                  : 'You’ve got this'}
              </small>
            </div>
          </div>
          <button className="hero-link" onClick={() => navigate('Attendance')}>
            See your progress
            <ArrowRight size={17} />
          </button>
        </section>
        <section className="day-summary panel">
          <span className="eyebrow">THE DAY AT A GLANCE</span>
          <div className="day-numbers">
            <div>
              <strong>
                {sessions.filter((s) => s.status !== 'cancelled').length}
              </strong>
              <span>classes today</span>
            </div>
            <div>
              <strong>
                {marked}
                <span>
                  /{sessions.filter((s) => s.status !== 'cancelled').length}
                </span>
              </strong>
              <span>marked</span>
            </div>
          </div>
          <div className="next-class">
            <span className="icon-tile">
              <Clock3 size={19} />
            </span>
            <div>
              <small>UP NEXT</small>
              <strong>
                {next
                  ? data.settings.subject_labels[next.subject_name] ||
                    next.subject_name
                  : 'A little breathing room'}
              </strong>
              <span>
                {next
                  ? `${next.session_date === today ? 'Today' : next.session_date} · ${next.start_time.slice(0, 5)}`
                  : 'Your schedule is clear'}
              </span>
            </div>
          </div>
        </section>
      </div>
      {pending.length > 0 && data.settings.reminders && (
        <button className="reminder" onClick={() => navigate('Pending')}>
          <span>
            <span className="reminder-count">{pending.length}</span>
            <strong>
              {pending.length === 1 ? 'class needs' : 'classes need'} attendance
            </strong>
            <span className="desktop-only">
              A quick check-in keeps your numbers accurate.
            </span>
          </span>
          <span>
            Review
            <ArrowRight size={16} />
          </span>
        </button>
      )}
      <div className="content-grid">
        <section>
          <div className="section-heading">
            <h2>
              Today’s classes
              <span className="count-pill">{sessions.length}</span>
            </h2>
            <button
              className="text-button"
              onClick={() => navigate('Timetable')}
            >
              View week
              <ArrowUpRight size={15} />
            </button>
          </div>
          {sessions.length ? (
            <div className="session-list">
              {sessions.map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </div>
          ) : (
            <Empty
              title={
                data.timetable
                  ? 'A clear day ahead.'
                  : 'Your schedule starts here.'
              }
              description={
                data.timetable
                  ? 'No classes today. Make some room for yourself.'
                  : 'Add your timetable to start tracking attendance.'
              }
              action={
                !data.timetable ? (
                  <div className="button-row">
                    <button className="button primary" onClick={editTimetable}>
                      Create manually
                    </button>
                    <button
                      className="button secondary"
                      onClick={editTimetable}
                    >
                      Upload timetable
                    </button>
                  </div>
                ) : undefined
              }
            />
          )}
        </section>
        <aside>
          <div className="section-heading">
            <h2>Subject snapshot</h2>
            <span className="muted">This journey</span>
          </div>
          <div className="panel subject-snapshot">
            {subjects.length ? (
              subjects.slice(0, 5).map((name, i) => {
                const stats = calculateAttendance(
                  data.sessions.filter((s) => s.subject_name === name),
                );
                const target =
                  data.settings.subject_targets[name] ?? data.settings.target;
                return (
                  <button
                    className="subject-row"
                    key={name}
                    onClick={() => navigate(`Subject:${name}`)}
                  >
                    <div>
                      <span className={`subject-icon tone-${i % 4}`}>
                        {(data.settings.subject_labels[name] || name)
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                      <strong>
                        {data.settings.subject_labels[name] || name}
                      </strong>
                      <span>{percentageLabel(stats.percentage)}</span>
                    </div>
                    <div className="progress-track">
                      <span style={{ width: `${stats.percentage || 0}%` }} />
                    </div>
                    <small>
                      {stats.percentage === null
                        ? 'No marks yet'
                        : stats.percentage < target * 100
                          ? 'Below your target'
                          : 'On track'}{' '}
                      · Target {target * 100}%
                    </small>
                  </button>
                );
              })
            ) : (
              <p>Your subjects will appear here once you add your timetable.</p>
            )}
            <button
              className="text-button"
              onClick={() => navigate('Attendance')}
            >
              All attendance
              <ArrowRight size={16} />
            </button>
          </div>
          <div className="gentle-note">
            <Sparkles size={20} />
            <p>
              Progress, without the guesswork.
              <br />
              <span>Only classes you mark count toward attendance.</span>
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
