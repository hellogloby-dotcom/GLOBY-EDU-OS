// layout.js
// Reusable template helpers for UI components in the GlobyEdu frontend.

// Create a standard card component with title and body text.
export function createCard(title, description) {
  return `
    <article class="card fade-in">
      <h3 class="text-xl font-semibold text-slate-900">${title}</h3>
      <p class="mt-3 text-slate-600 leading-7">${description}</p>
    </article>
  `;
}

// Create a custom button component for inline actions.
export function createButton(label, id, variant = 'primary') {
  const buttonClass = variant === 'secondary' ? 'btn-secondary' : 'btn-primary';
  return `<button id="${id}" class="${buttonClass}">${label}</button>`;
}

// Create an alert banner with a type and accessible role.
export function createAlert(message, type = 'info') {
  const alertClasses = {
    info: 'alert alert-info',
    success: 'alert alert-success',
    warning: 'alert alert-warning',
    danger: 'alert alert-danger',
  };

  return `
    <div class="${alertClasses[type] || alertClasses.info}" role="status">
      <span class="text-sm font-medium">${message}</span>
    </div>
  `;
}
