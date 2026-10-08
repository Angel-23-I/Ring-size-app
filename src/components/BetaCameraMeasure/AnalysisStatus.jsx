export default function AnalysisStatus({ phase }) {
  if (phase !== 'analyzing') return null;
  return (
    <p className="beta-status" role="status" aria-live="polite">
      Analizando imagen…
    </p>
  );
}
