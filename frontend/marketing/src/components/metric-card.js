// metric-card.js
// Reusable metric card component for dashboard summaries.

export function MetricCard({ label, value, description }) {
  return `
    <div class="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <p class="text-sm uppercase tracking-[0.3em] text-slate-500">${label}</p>
      <p class="mt-3 text-3xl font-semibold text-slate-900">${value}</p>
      <p class="mt-3 text-sm text-slate-600">${description}</p>
    </div>
  `;
}
