// charts.js
// Simple chart components for school dashboard analytics

import { formatCurrencyValue } from '../utils/currency-utils.js';

export function AttendanceTrendChart(data = []) {
  // Sample: [{ date: '2024-01-01', percentage: 85 }, ...]
  const chartData = data.slice(-7); // Last 7 days
  const maxValue = Math.max(...chartData.map(d => d.percentage || 0), 100);

  return `
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex items-center justify-between mb-4">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-500">Attendance Trends</p>
          <h3 class="mt-2 text-lg font-semibold text-slate-900">Last 7 Days</h3>
        </div>
        <span class="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">+2.5%</span>
      </div>
      
      <div class="flex items-end justify-between gap-2 h-48">
        ${chartData.length ? chartData.map(item => {
          const height = Math.round((item.percentage / maxValue) * 100);
          return `
            <div class="flex-1 flex flex-col items-center gap-2">
              <div class="w-full h-40 bg-slate-100 rounded-lg relative flex items-end overflow-hidden">
                <div 
                  class="w-full bg-gradient-to-t from-sky-600 to-sky-400 transition-all duration-300 rounded-t-lg hover:from-sky-700 hover:to-sky-500" 
                  style="height: ${height}%"
                ></div>
              </div>
              <span class="text-xs text-slate-500 text-center">${item.date?.split('-').slice(1).join('-') || 'N/A'}</span>
              <span class="text-xs font-semibold text-slate-700">${item.percentage || 0}%</span>
            </div>
          `;
        }).join('') : `<div class="col-span-7 text-center text-sm text-slate-500">No data available</div>`}
      </div>
    </div>
  `;
}

export function FeeCollectionChart(data = {}, currencyCode = 'USD') {
  // Sample: { collected: 5000, outstanding: 1200, partial: 800 }
  const total = (data.collected || 0) + (data.outstanding || 0) + (data.partial || 0) || 1;
  const collectedPct = Math.round((data.collected || 0) / total * 100);
  const outstandingPct = Math.round((data.outstanding || 0) / total * 100);
  const partialPct = Math.round((data.partial || 0) / total * 100);

  return `
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex items-center justify-between mb-6">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-500">Fee Collection</p>
          <h3 class="mt-2 text-lg font-semibold text-slate-900">Overview</h3>
        </div>
      </div>

      <!-- Donut Chart -->
      <div class="flex items-center justify-between gap-8">
        <div class="relative h-40 w-40">
          <svg viewBox="0 0 100 100" class="transform -rotate-90">
            <!-- Background circle -->
            <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" stroke-width="15"></circle>
            
            <!-- Collected -->
            <circle 
              cx="50" cy="50" r="40" fill="none" 
              stroke="#10b981" 
              stroke-width="15"
              stroke-dasharray="${collectedPct * 2.51} 251"
              class="transition-all duration-500"
            ></circle>
            
            <!-- Outstanding -->
            <circle 
              cx="50" cy="50" r="40" fill="none" 
              stroke="#f59e0b" 
              stroke-width="15"
              stroke-dasharray="${outstandingPct * 2.51} 251"
              stroke-dashoffset="${-(collectedPct * 2.51)}"
              class="transition-all duration-500"
            ></circle>
            
            <!-- Partial -->
            <circle 
              cx="50" cy="50" r="40" fill="none" 
              stroke="#3b82f6" 
              stroke-width="15"
              stroke-dasharray="${partialPct * 2.51} 251"
              stroke-dashoffset="${-((collectedPct + outstandingPct) * 2.51)}"
              class="transition-all duration-500"
            ></circle>
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="text-center">
              <p class="text-2xl font-bold text-slate-900">${collectedPct}%</p>
              <p class="text-xs text-slate-600">Collected</p>
            </div>
          </div>
        </div>

        <!-- Legend -->
        <div class="space-y-3">
          <div class="flex items-center gap-3">
            <div class="h-3 w-3 rounded-full bg-emerald-500"></div>
            <div>
              <p class="text-sm font-medium text-slate-900">Collected</p>
              <p class="text-xs text-slate-600">${formatCurrencyValue(data.collected || 0, currencyCode)}</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="h-3 w-3 rounded-full bg-amber-500"></div>
            <div>
              <p class="text-sm font-medium text-slate-900">Outstanding</p>
              <p class="text-xs text-slate-600">${formatCurrencyValue(data.outstanding || 0, currencyCode)}</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="h-3 w-3 rounded-full bg-blue-500"></div>
            <div>
              <p class="text-sm font-medium text-slate-900">Partial</p>
              <p class="text-xs text-slate-600">${formatCurrencyValue(data.partial || 0, currencyCode)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function StudentGrowthChart(data = []) {
  // Sample: [{ month: 'Jan', count: 120 }, { month: 'Feb', count: 135 }, ...]
  const chartData = data.slice(-6); // Last 6 months
  const maxValue = Math.max(...chartData.map(d => d.count || 0), 100);

  return `
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex items-center justify-between mb-4">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-500">Student Growth</p>
          <h3 class="mt-2 text-lg font-semibold text-slate-900">Last 6 Months</h3>
        </div>
        <span class="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">+12.5%</span>
      </div>
      
      <div class="flex items-end justify-between gap-2 h-48">
        ${chartData.length ? chartData.map(item => {
          const height = Math.round((item.count / maxValue) * 100);
          return `
            <div class="flex-1 flex flex-col items-center gap-2">
              <div class="w-full h-40 bg-slate-100 rounded-lg relative flex items-end overflow-hidden">
                <div 
                  class="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all duration-300 rounded-t-lg hover:from-emerald-700 hover:to-emerald-500" 
                  style="height: ${height}%"
                ></div>
              </div>
              <span class="text-xs text-slate-500 text-center">${item.month || 'N/A'}</span>
              <span class="text-xs font-semibold text-slate-700">${item.count || 0}</span>
            </div>
          `;
        }).join('') : `<div class="col-span-6 text-center text-sm text-slate-500">No data available</div>`}
      </div>
    </div>
  `;
}

export function MonthlyRevenueChart(data = []) {
  // Sample: [{ month: 'Jan', revenue: 25000 }, ...]
  const chartData = data.slice(-12); // Last 12 months
  const maxValue = Math.max(...chartData.map(d => d.revenue || 0), 100000);

  return `
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex items-center justify-between mb-4">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-slate-500">Monthly Revenue</p>
          <h3 class="mt-2 text-lg font-semibold text-slate-900">Last 12 Months</h3>
        </div>
        <span class="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">↑ 8.2%</span>
      </div>
      
      <div class="flex items-end justify-between gap-1 h-48">
        ${chartData.length ? chartData.map((item, idx) => {
          const height = Math.round((item.revenue / maxValue) * 100);
          return `
            <div class="flex-1 flex flex-col items-center gap-2 min-w-0">
              <div class="w-full h-40 bg-slate-100 rounded-sm relative flex items-end overflow-hidden">
                <div 
                  class="w-full bg-gradient-to-t from-purple-600 to-purple-400 transition-all duration-300 rounded-t-sm hover:from-purple-700 hover:to-purple-500" 
                  style="height: ${height}%"
                ></div>
              </div>
              <span class="text-xs text-slate-500 text-center whitespace-nowrap">${item.month || 'M'}</span>
            </div>
          `;
        }).join('') : `<div class="col-span-12 text-center text-sm text-slate-500">No data available</div>`}
      </div>
    </div>
  `;
}

export function TeacherAttendanceChart(data = {}) {
  // Sample: { present: 25, absent: 2, onLeave: 1 }
  const total = (data.present || 0) + (data.absent || 0) + (data.onLeave || 0) || 1;
  const presentPct = Math.round((data.present || 0) / total * 100);
  const absentPct = Math.round((data.absent || 0) / total * 100);
  const leavePct = Math.round((data.onLeave || 0) / total * 100);

  return `
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p class="text-sm uppercase tracking-[0.3em] text-slate-500">Teacher Attendance</p>
      <h3 class="mt-2 text-lg font-semibold text-slate-900">Today</h3>
      
      <div class="mt-6 space-y-4">
        <div>
          <div class="flex items-center justify-between gap-2 mb-1">
            <span class="text-sm font-medium text-emerald-700">Present</span>
            <span class="text-sm font-semibold text-slate-900">${presentPct}%</span>
          </div>
          <div class="h-3 rounded-full bg-slate-200 overflow-hidden">
            <div class="h-full bg-emerald-500" style="width: ${presentPct}%"></div>
          </div>
          <p class="mt-1 text-xs text-slate-600">${data.present || 0} teachers</p>
        </div>

        <div>
          <div class="flex items-center justify-between gap-2 mb-1">
            <span class="text-sm font-medium text-rose-700">Absent</span>
            <span class="text-sm font-semibold text-slate-900">${absentPct}%</span>
          </div>
          <div class="h-3 rounded-full bg-slate-200 overflow-hidden">
            <div class="h-full bg-rose-500" style="width: ${absentPct}%"></div>
          </div>
          <p class="mt-1 text-xs text-slate-600">${data.absent || 0} teachers</p>
        </div>

        <div>
          <div class="flex items-center justify-between gap-2 mb-1">
            <span class="text-sm font-medium text-amber-700">On Leave</span>
            <span class="text-sm font-semibold text-slate-900">${leavePct}%</span>
          </div>
          <div class="h-3 rounded-full bg-slate-200 overflow-hidden">
            <div class="h-full bg-amber-500" style="width: ${leavePct}%"></div>
          </div>
          <p class="mt-1 text-xs text-slate-600">${data.onLeave || 0} teachers</p>
        </div>
      </div>
    </div>
  `;
}
