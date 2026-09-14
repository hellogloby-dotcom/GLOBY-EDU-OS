// sidebar.js
// Reusable dark-themed sidebar component for school authority dashboard
// Single source of truth for navigation - no duplication

export function SchoolAuthoritySidebar(currentSection = 'overview') {
  const menuItems = [
    { id: 'overview', icon: '🏠', label: 'Dashboard', action: 'renderSchoolDashboardPage' },
    { id: 'profile', icon: '👤', label: 'Profile', action: 'renderSchoolDashboardPage' },
    { id: 'students', icon: '👥', label: 'Students', action: 'renderSchoolDashboardPage' },
    { id: 'teachers', icon: '🧑‍🏫', label: 'Teachers', action: 'renderSchoolDashboardPage' },
    { id: 'classes', icon: '🏫', label: 'Class Management', action: 'renderSchoolDashboardPage' },
    { id: 'attendance', icon: '✅', label: 'Attendance', action: 'renderSchoolDashboardPage' },
    { id: 'finance', icon: '💰', label: 'Finance & Billing', action: 'renderSchoolDashboardPage' },
    { id: 'exams', icon: '📝', label: 'Examination & Grading', action: 'renderSchoolDashboardPage' },
    { id: 'announcements', icon: '📣', label: 'Announcements', action: 'renderSchoolDashboardPage' },
    { id: 'notifications', icon: '🔔', label: 'Notifications', action: 'renderSchoolDashboardPage' },
    { id: 'messages', icon: '💬', label: 'Messaging', action: 'renderSchoolDashboardPage' },
    { id: 'reports', icon: '📄', label: 'Reports', action: 'renderSchoolDashboardPage' },
    { id: 'settings', icon: '⚙️', label: 'Settings', action: 'renderSchoolDashboardPage' },
  ];

  const renderMenuItem = (item) => {
    const isActive = currentSection === item.id;
    const baseClasses = 'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 cursor-pointer';
    const activeClasses = isActive
      ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
      : 'text-slate-300 hover:bg-slate-700 hover:text-white';

    return `
      <button 
        data-sidebar-nav="${item.id}" 
        class="${baseClasses} ${activeClasses}"
        title="${item.label}"
      >
        <span class="text-lg">${item.icon}</span>
        <span class="hidden lg:inline">${item.label}</span>
      </button>
    `;
  };

  return `
    <aside class="fixed left-0 top-0 h-screen w-full sm:w-20 lg:w-64 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-r border-slate-700 flex flex-col shadow-2xl overflow-y-auto z-40">
      <!-- Logo/Branding Section -->
      <div class="flex items-center justify-center lg:justify-start gap-3 px-4 py-6 border-b border-slate-700">
        <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-sky-600 text-sm font-bold text-white shadow-lg">
          GE
        </div>
        <span class="hidden lg:block text-lg font-semibold text-white">GlobyEdu</span>
      </div>

      <!-- Navigation Menu -->
      <nav class="flex-1 overflow-y-auto px-3 py-6 space-y-2">
        <div class="space-y-1">
          ${menuItems.map(renderMenuItem).join('')}
        </div>
      </nav>

      <!-- Footer Section -->
      <div class="border-t border-slate-700 p-3 space-y-2">
        <button 
          id="sidebar-help" 
          class="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-all duration-200"
          title="Help and Support"
        >
          <span class="text-lg">❓</span>
          <span class="hidden lg:inline">Help</span>
        </button>
        <button 
          id="sidebar-logout" 
          class="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-rose-900/30 hover:text-rose-200 transition-all duration-200"
          title="Sign out"
        >
          <span class="text-lg">🚪</span>
          <span class="hidden lg:inline">Sign out</span>
        </button>
      </div>

      <!-- Mobile Menu Toggle Hint -->
      <div class="hidden sm:flex lg:hidden items-center justify-center p-3 text-xs text-slate-500 border-t border-slate-700">
        <span>Expand →</span>
      </div>
    </aside>

    <!-- Responsive Spacer -->
    <div id="sidebar-spacer" class="sm:w-20 lg:w-64"></div>
  `;
}

// Attach event handlers to sidebar
export function attachSidebarHandlers(onNavigate, onLogout, onHelp) {
  // Navigation buttons
  document.querySelectorAll('[data-sidebar-nav]').forEach((button) => {
    button.addEventListener('click', () => {
      const section = button.getAttribute('data-sidebar-nav');
      if (onNavigate && typeof onNavigate === 'function') {
        onNavigate(section);
      }
    });
  });

  // Logout button
  const logoutBtn = document.getElementById('sidebar-logout');
  if (logoutBtn && onLogout && typeof onLogout === 'function') {
    logoutBtn.addEventListener('click', onLogout);
  }

  // Help button
  const helpBtn = document.getElementById('sidebar-help');
  if (helpBtn && onHelp && typeof onHelp === 'function') {
    helpBtn.addEventListener('click', onHelp);
  }
}
