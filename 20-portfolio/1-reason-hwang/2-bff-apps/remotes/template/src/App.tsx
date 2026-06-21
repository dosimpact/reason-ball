import './styles.css';

export function App() {
  return (
    <main className="template-shell">
      <section className="template-panel" aria-labelledby="template-title">
        <p className="template-kicker">Template remote</p>
        <h1 id="template-title">Reusable remote app shell</h1>
        <p className="template-copy">
          This Vite React remote is mounted through Module Federation using a
          container-owned lifecycle.
        </p>
        <dl className="template-facts" aria-label="Remote details">
          <div>
            <dt>Remote</dt>
            <dd>template</dd>
          </div>
          <div>
            <dt>Port</dt>
            <dd>2802</dd>
          </div>
          <div>
            <dt>Expose</dt>
            <dd>./mount</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
