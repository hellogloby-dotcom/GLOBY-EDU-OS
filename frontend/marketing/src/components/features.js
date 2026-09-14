// features.js
// Feature highlight cards describing key platform capabilities.

import { featureAnalyticsImage, featureCloudImage, featureSecurityImage, learningPreviewImage } from '../assets/asset-paths.js';

export function Features(cms = {}) {
  const companyName = cms.companyName || 'GlobyEdu OS';
  const items = [
    { title: 'Analytics', desc: 'Insightful charts for leaders and executive dashboards.', image: featureAnalyticsImage },
    { title: 'Attendance', desc: 'Rapid attendance tracking and review across classes and campuses.', image: featureCloudImage },
    { title: 'Messaging', desc: 'Secure communication between staff, students, and parents.', image: featureSecurityImage },
    { title: 'Learning Support', desc: 'Personalized guidance and structured resources for stronger student outcomes.', image: learningPreviewImage },
  ];

  return `
    <section id="features" class="mt-20">
      <div class="mx-auto max-w-7xl px-6">
        <div class="grid gap-6">
          <div class="grid lg:grid-cols-4 gap-6">
            ${items.map((item) => `
              <article class="group flex flex-col overflow-hidden card hover-lift" role="article" aria-label="${item.title}">
                <div class="p-6 flex items-start gap-4">
                  <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                    <svg class="icon" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="#0369a1" stroke-width="1.4"/></svg>
                  </div>
                  <div>
                    <p class="text-lg font-semibold text-slate-900">${item.title}</p>
                    <p class="mt-1 text-sm text-muted">${item.desc}</p>
                  </div>
                </div>
                <div class="mt-auto overflow-hidden card-media ${['Analytics', 'Messaging'].includes(item.title) ? `${item.title.toLowerCase()}-feature-media` : ''}">
                  <img src="${item.image}" alt="${item.title}" loading="lazy" decoding="async" class="w-full h-36 object-cover ${['Analytics', 'Messaging'].includes(item.title) ? `${item.title.toLowerCase()}-feature-image` : ''}" />
                </div>
              </article>
            `).join('')}
          </div>
        </div>
      </div>
    </section>
  `;
}
