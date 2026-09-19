// setup-progress.js
// Setup workflow indicator for school authority dashboard
// Guides schools through the onboarding process step by step

export function SetupProgressIndicator(completedSteps = []) {
  const steps = [
    { id: 1, label: 'Complete School Profile', icon: '👤', key: 'profile' },
    { id: 2, label: 'Create Academic Year', icon: '📅', key: 'academic_year' },
    { id: 3, label: 'Create Term', icon: '📆', key: 'term' },
    { id: 4, label: 'Create Classes', icon: '🏫', key: 'classes' },
    { id: 5, label: 'Create Subjects', icon: '📚', key: 'subjects' },
    { id: 6, label: 'Add Teachers', icon: '🧑‍🏫', key: 'teachers' },
    { id: 7, label: 'Add Students', icon: '👥', key: 'students' },
    { id: 8, label: 'Start Attendance', icon: '✅', key: 'attendance' },
    { id: 9, label: 'Start Finance', icon: '💰', key: 'finance' },
    { id: 10, label: 'Start Exams', icon: '📝', key: 'exams' },
  ];

  const completionPercentage = Math.round((completedSteps.length / steps.length) * 100);

  const renderStep = (step, index) => {
    const isCompleted = completedSteps.includes(step.key);
    const isActive = index === completedSteps.length;

    return `
      <div class="flex flex-col items-center">
        <!-- Connector line -->
        ${index < steps.length - 1 ? `
          <div class="absolute top-14 w-0.5 h-12 bg-gradient-to-b ${isCompleted || isActive ? 'from-emerald-500 to-slate-300' : 'from-slate-300 to-slate-300'}"></div>
        ` : ''}

        <!-- Step circle -->
        <div class="relative z-10 flex h-12 w-12 items-center justify-center rounded-full font-bold text-white transition-all duration-300 ${
          isCompleted
            ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30'
            : isActive
            ? 'bg-gradient-to-br from-sky-400 to-sky-600 shadow-lg shadow-sky-500/30 animate-pulse'
            : 'bg-slate-300 text-slate-700'
        }">
          ${isCompleted ? '✓' : step.id}
        </div>

        <!-- Step label -->
        <p class="mt-3 text-center text-sm font-medium text-slate-700 whitespace-nowrap">${step.icon}</p>
        <p class="mt-1 text-center text-xs font-medium text-slate-600 max-w-[100px]">${step.label}</p>
      </div>
    `;
  };

  return `
    <div class="rounded-[2rem] border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-6 shadow-sm">
      <div class="flex items-center justify-between gap-4 mb-6">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-500">Progress</p>
          <h3 class="mt-2 text-xl font-semibold text-slate-900">School readiness</h3>
        </div>
        <div class="text-right">
          <p class="text-3xl font-bold text-sky-600">${completionPercentage}%</p>
          <p class="text-xs text-slate-600">Complete</p>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="mb-6 h-2 rounded-full bg-slate-200 overflow-hidden">
        <div 
          class="h-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-500 ease-out shadow-lg shadow-sky-500/30"
          style="width: ${completionPercentage}%"
        ></div>
      </div>

      <!-- Steps -->
      <div class="w-full max-w-full">
        <div class="flex w-full min-w-0 flex-wrap justify-center gap-4 px-2 py-4 lg:justify-between">
          ${steps.map((step, index) => renderStep(step, index)).join('')}
        </div>
      </div>

      <!-- Next action -->
      <div class="mt-6 rounded-xl bg-slate-50 border border-slate-200 p-4">
        ${completionPercentage === 100
          ? `
            <p class="text-sm font-medium text-emerald-700">🎉 Ready</p>
            <p class="mt-1 text-sm text-slate-600">Your school is fully set up and ready to manage daily operations.</p>
          `
          : `
            <p class="text-sm font-medium text-sky-700">📝 Continue</p>
            <p class="mt-1 text-sm text-slate-600">Complete the "${steps[completedSteps.length]?.label || 'remaining tasks'}" to keep moving forward.</p>
          `}
      </div>
    </div>
  `;
}
