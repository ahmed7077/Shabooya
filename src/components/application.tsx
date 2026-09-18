'use client';
import { useEffect, useState } from 'react';
import {
  House,
  CalendarDays,
  ChartNoAxesCombined,
  CalendarRange,
  UserRound,
  Download,
  WifiOff,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { AppProvider, useApp } from './app-provider';
import { Brand, ErrorText } from './ui';
import { AuthScreen, Onboarding, ResetPassword } from '@/features/auth';
import { Dashboard } from '@/features/dashboard';
import { TimetableEditor } from '@/features/timetable-editor';
import { Attendance } from '@/features/attendance';
import { Calendar } from '@/features/calendar';
import { SettingsScreen } from '@/features/settings';
import { PwaControls } from './pwa';
const NAV = [
  { name: 'Home', icon: House },
  { name: 'Timetable', icon: CalendarDays },
  { name: 'Attendance', icon: ChartNoAxesCombined },
  { name: 'Calendar', icon: CalendarRange },
  { name: 'Profile', icon: UserRound },
];
function Content() {
  const {
    user,
    data,
    loading,
    online,
    syncing,
    pending,
    error,
    refresh,
    recovery,
    conflicts,
    resolveConflict,
  } = useApp();
  const [tab, setTab] = useState('Home'),
    [editor, setEditor] = useState(false),
    [install, setInstall] = useState(false),
    [showInstall, setShowInstall] = useState(false),
    [, tick] = useState(0);
  useEffect(() => {
    setTab('Home');
    setEditor(false);
    setInstall(false);
  }, [user?.id]);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 60000);
    setShowInstall(
      !localStorage.getItem('rollcall-install-dismissed') &&
        !matchMedia('(display-mode: standalone)').matches,
    );
    return () => clearInterval(timer);
  }, []);
  function navigate(value: string) {
    setTab(value);
    setEditor(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  if (loading)
    return (
      <main className="loading-screen">
        <Brand />
        <div className="loading-bar" />
        <p>Getting your day ready…</p>
      </main>
    );
  if (!user)
    return (
      <>
        <AuthScreen />
        <PwaControls show={install} onClose={() => setInstall(false)} />
      </>
    );
  if (recovery) return <ResetPassword />;
  if (!data)
    return (
      <main className="loading-screen">
        <Brand />
        <p>{error || 'Loading your personal space…'}</p>
        <button className="button primary" onClick={() => void refresh()}>
          Retry
        </button>
      </main>
    );
  if (!data.profile) return <Onboarding />;
  const active =
    tab.startsWith('Subject:') || tab === 'Pending' ? 'Attendance' : tab;
  return (
    <div className="app-layout">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">YOUR PERSONAL SPACE</div>
        <nav aria-label="Main navigation">
          {NAV.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={active === name && !editor ? 'active' : ''}
              onClick={() => navigate(name)}
              aria-current={active === name && !editor ? 'page' : undefined}
            >
              <Icon size={21} />
              <span>{name}</span>
              {name === 'Home' && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {showInstall && (
            <button className="install-card" onClick={() => setInstall(true)}>
              <Download size={21} />
              <strong>Your day. One tap away.</strong>
              <span>
                Install rollcall
                <ChevronRight size={14} />
              </span>
            </button>
          )}
          <button
            className="sidebar-profile"
            onClick={() => navigate('Profile')}
          >
            <span className="avatar small">
              {data.profile.name.slice(0, 1)}
            </span>
            <span>
              <strong>{data.profile.name}</strong>
              <small>
                {data.profile.course} · {data.profile.semester}
              </small>
            </span>
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>
      <div className="main-area">
        <div className="topbar">
          <div className="mobile-brand">
            <Brand />
          </div>
          <span className="breadcrumb desktop-only">
            My space <ChevronRight size={13} />{' '}
            {editor ? 'Timetable editor' : active}
          </span>
          <div className="topbar-right">
            <span className={`connection ${!online ? 'offline' : ''}`}>
              {!online ? <WifiOff size={14} /> : <span />}
              {!online
                ? 'Offline'
                : syncing
                  ? 'Syncing…'
                  : pending
                    ? `${pending} pending`
                    : 'All up to date'}
            </span>
            <button
              className="icon-button"
              aria-label="Sync data"
              disabled={syncing || !online}
              onClick={() => void refresh()}
            >
              <RefreshCw size={17} className={syncing ? 'spin' : ''} />
            </button>
            <button
              className="avatar small"
              aria-label="Open profile"
              onClick={() => navigate('Profile')}
            >
              {data.profile.name.slice(0, 1)}
            </button>
          </div>
        </div>
        <main id="main" className="main-content">
          <ErrorText message={error} />
          {conflicts.map((c) => (
            <div className="notice" key={c.mark.id}>
              <strong>
                {c.cancelled
                  ? 'This class was cancelled on another device.'
                  : 'A mark changed on another device.'}
              </strong>
              <p>
                {
                  data.sessions.find((s) => s.id === c.mark.session_id)
                    ?.subject_name
                }
                : this device says {c.mark.status || 'unmarked'}, cloud says{' '}
                {c.remoteStatus || 'unmarked'}. Choose which to keep.
              </p>
              <div className="button-row">
                <button
                  className="button secondary"
                  disabled={c.cancelled}
                  onClick={() => void resolveConflict(c.mark.session_id, true)}
                >
                  Keep this device
                </button>
                <button
                  className="button secondary"
                  onClick={() => void resolveConflict(c.mark.session_id, false)}
                >
                  Use cloud mark
                </button>
              </div>
            </div>
          ))}
          {editor ? (
            <TimetableEditor onClose={() => setEditor(false)} />
          ) : tab === 'Home' ? (
            <Dashboard
              navigate={navigate}
              editTimetable={() => setEditor(true)}
            />
          ) : tab === 'Timetable' ? (
            <Calendar week editTimetable={() => setEditor(true)} />
          ) : tab === 'Calendar' ? (
            <Calendar editTimetable={() => setEditor(true)} />
          ) : tab === 'Profile' ? (
            <SettingsScreen
              editTimetable={() => setEditor(true)}
              install={() => setInstall(true)}
            />
          ) : (
            <Attendance
              key={tab}
              subject={tab.startsWith('Subject:') ? tab.slice(8) : undefined}
              pendingOnly={tab === 'Pending'}
              navigate={navigate}
            />
          )}
          <footer className="page-footer">
            <span>A little consistency goes a long way.</span>
            <span>Made for your everyday.</span>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {NAV.map(({ name, icon: Icon }) => (
          <button
            key={name}
            aria-current={active === name && !editor ? 'page' : undefined}
            onClick={() => navigate(name)}
          >
            <Icon size={21} />
            <span>{name}</span>
          </button>
        ))}
      </nav>
      <PwaControls
        show={install}
        onClose={() => {
          setInstall(false);
          setShowInstall(false);
        }}
      />
    </div>
  );
}
export function Application() {
  return (
    <AppProvider>
      <Content />
    </AppProvider>
  );
}
