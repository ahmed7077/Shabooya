'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading-screen">
      <h1>Let’s try that again.</h1>
      <p>Something interrupted this page. Your synced attendance is safe.</p>
      <button className="button primary" onClick={reset}>
        Reload this page
      </button>
    </main>
  );
}
