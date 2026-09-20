'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { LinePath } from '@visx/shape';
import type { Session } from '@/types/domain';
import { attendanceTrend } from '@/lib/attendance/analytics';
import {
  calculateAttendance,
  percentageLabel,
} from '@/lib/attendance/calculator';

export default function AttendanceCharts({
  sessions,
  target,
}: {
  sessions: Session[];
  target: number;
}) {
  const id = useId();
  const points = attendanceTrend(sessions);
  const stats = calculateAttendance(sessions);
  const [selected, setSelected] = useState('');
  const [width, setWidth] = useState(600);
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(220, entry.contentRect.width)),
    );
    observer.observe(svg);
    return () => observer.disconnect();
  }, [points.length]);
  const point = points.find((p) => p.date === selected) || points.at(-1);
  const first = points[0] ? Date.parse(points[0].date) : 0;
  const duration = Math.max(
    86400000,
    (points.at(-1) ? Date.parse(points.at(-1)!.date) : first) - first,
  );
  const x = (p: (typeof points)[number]) =>
    points.length === 1
      ? width / 2
      : 48 + ((Date.parse(p.date) - first) / duration) * (width - 72);
  const y = (p: (typeof points)[number]) => 174 - p.percentage * 1.5;
  return (
    <section className="analytics-grid" aria-label="Attendance visualizations">
      <div className="panel chart-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THE BIGGER PICTURE</span>
            <h2>Attendance trend</h2>
          </div>
          <span className="count-pill">Cumulative</span>
        </div>
        {point ? (
          <>
            <div className="chart-readout" aria-live="polite">
              <strong>{percentageLabel(point.percentage)}</strong>
              <span>
                {point.date} · {point.present} present / {point.counted} counted
              </span>
            </div>
            <svg
              ref={svgRef}
              className="trend-chart"
              viewBox={`0 0 ${width} 208`}
              role="img"
              aria-labelledby={id}
              onPointerMove={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                const at =
                  ((event.clientX - bounds.left) / bounds.width) * width;
                const nearest = points.reduce(
                  (best, p) =>
                    Math.abs(x(p) - at) < Math.abs(x(best) - at) ? p : best,
                  points[0],
                );
                setSelected(nearest.date);
              }}
              onPointerDown={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                const at =
                  ((event.clientX - bounds.left) / bounds.width) * width;
                const nearest = points.reduce(
                  (best, p) =>
                    Math.abs(x(p) - at) < Math.abs(x(best) - at) ? p : best,
                  points[0],
                );
                setSelected(nearest.date);
              }}
            >
              <title id={id}>
                Cumulative attendance through {points.at(-1)!.date}. Target{' '}
                {target * 100}%. Use the date selector or data table for exact
                values.
              </title>
              {[0, 50, 100].map((value) => (
                <g key={value}>
                  <line
                    x1="48"
                    x2={width - 24}
                    y1={174 - value * 1.5}
                    y2={174 - value * 1.5}
                    stroke="var(--border)"
                  />
                  <text
                    x="0"
                    y={179 - value * 1.5}
                    fill="var(--muted)"
                    fontSize="13"
                  >
                    {value}%
                  </text>
                </g>
              ))}
              <line
                x1="48"
                x2={width - 24}
                y1={174 - target * 150}
                y2={174 - target * 150}
                stroke="var(--warning)"
                strokeDasharray="5 5"
              />
              <LinePath
                data={points}
                x={x}
                y={y}
                stroke="var(--info)"
                strokeWidth={3}
              />
              <circle
                cx={x(point)}
                cy={y(point)}
                r="6"
                fill="var(--info)"
                stroke="var(--surface)"
                strokeWidth="3"
              />
              <text x="48" y="204" fill="var(--muted)" fontSize="13">
                {points[0].date}
              </text>
              <text
                x={width - 24}
                y="204"
                textAnchor="end"
                fill="var(--muted)"
                fontSize="13"
              >
                {points.at(-1)!.date}
              </text>
            </svg>
            <label className="chart-picker">
              Explore a date
              <select
                value={point.date}
                onChange={(e) => setSelected(e.target.value)}
              >
                {points.map((p) => (
                  <option key={p.date}>{p.date}</option>
                ))}
              </select>
            </label>
            <details className="chart-data">
              <summary>View chart data · dashed line is your target</summary>
              <div className="table-scroll">
                <table>
                  <caption>Cumulative attendance by class date</caption>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Present</th>
                      <th>Absent</th>
                      <th>Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((p) => (
                      <tr key={p.date}>
                        <td>{p.date}</td>
                        <td>{p.present}</td>
                        <td>{p.absent}</td>
                        <td>{percentageLabel(p.percentage)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <div className="chart-empty">
            <span className="empty-orbit" />
            <h3>Your progress starts with a mark.</h3>
            <p>Record a completed class to see your attendance over time.</p>
          </div>
        )}
      </div>
      <div className="panel distribution-card">
        <span className="eyebrow">COUNTED CLASSES</span>
        <h2>Every mark matters</h2>
        <div
          className="distribution-ring"
          role="img"
          aria-label={`${stats.present} present, ${stats.absent} absent, ${stats.counted} counted`}
          style={
            {
              '--progress': `${stats.percentage || 0}%`,
              '--ring-rest': stats.counted ? 'var(--warning)' : 'var(--border)',
            } as React.CSSProperties
          }
        >
          <div>
            <strong>{stats.counted}</strong>
            <span>{stats.counted ? 'counted' : 'No marks yet'}</span>
          </div>
        </div>
        <div className="distribution-legend">
          <span>
            <i className="present-dot" />✓ Present{' '}
            <strong>{stats.present}</strong>
          </span>
          <span>
            <i className="absent-dot" />× Absent <strong>{stats.absent}</strong>
          </span>
        </div>
        <p>Future, cancelled and unmarked classes stay out of these numbers.</p>
      </div>
    </section>
  );
}
