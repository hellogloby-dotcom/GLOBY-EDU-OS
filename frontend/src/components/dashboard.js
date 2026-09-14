// dashboard.js
// Dashboard view templates for the GlobyEdu OS frontend.

// Create the authenticated dashboard shell with navigation and header.
export function createDashboardShell(role, username, schoolName, grade) {
  return `
    <div class="min-h-screen lg:flex lg:flex-row">
      <aside class="w-full lg:w-72 bg-slate-950 text-slate-100 p-6">
        <div class="mb-10">
          <h2 class="text-xl font-semibold">GlobyEdu</h2>
          <p class="text-sm text-slate-400">${schoolName}</p>
        </div>
        <nav class="space-y-3">
          <button id="nav-dashboard" class="w-full text-left rounded-2xl px-4 py-3 bg-slate-800 text-slate-100 hover:bg-slate-700">Home / Dashboard</button>
          <button id="nav-subjects" class="w-full text-left rounded-2xl px-4 py-3 bg-slate-800 text-slate-100 hover:bg-slate-700">My Subjects</button>
          <button id="nav-ai-tutor" class="w-full text-left rounded-2xl px-4 py-3 bg-slate-800 text-slate-100 hover:bg-slate-700">AI Tutor</button>
          <button id="nav-logout" class="w-full text-left rounded-2xl px-4 py-3 bg-blue-700 text-white hover:bg-blue-600">Log Out</button>
        </nav>
      </aside>

      <main class="flex-1 bg-slate-50 p-6">
        <header class="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p class="text-sm uppercase tracking-[0.25em] text-slate-500">${role.toUpperCase()}</p>
            <h1 class="text-3xl font-semibold text-slate-900">Welcome, ${username}</h1>
            <p class="mt-2 text-slate-600">You are signed in as a ${role} at ${schoolName}.</p>
          </div>
          <div class="rounded-3xl bg-white border border-slate-200 px-5 py-4 shadow-sm">
            <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Current Grade</p>
            <p id="dashboard-grade" class="mt-2 text-xl font-semibold text-slate-900">${grade}</p>
          </div>
        </header>

        <section id="dashboard-content" class="space-y-6">
          <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3" id="subject-card-grid">
            <!-- Subject cards populate here -->
          </div>
        </section>
      </main>
    </div>
  `;
}

// Create a subject card for the dashboard grid.
export function createSubjectCard(subject, topic) {
  return `
    <article class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
      <p class="text-sm uppercase tracking-[0.3em] text-slate-500">${subject}</p>
      <h2 class="mt-3 text-xl font-semibold text-slate-900">${topic}</h2>
      <p class="mt-3 text-slate-600">A curriculum placeholder to guide development for the ${subject} module.</p>
    </article>
  `;
}
