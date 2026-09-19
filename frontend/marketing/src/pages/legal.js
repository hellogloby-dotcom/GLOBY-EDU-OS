const POLICY_META = {
  privacy: {
    title: 'Privacy Policy',
    effective: 'September 18, 2026',
    intro: 'This Privacy Policy explains what GlobyEdu OS collects and how it is used when schools and their authorized users use the platform.',
  },
  terms: {
    title: 'Terms of Service',
    effective: 'September 18, 2026',
    intro: 'These Terms describe the agreement between GlobyEdu OS and a school or organization that subscribes to the platform.',
  },
  cookies: {
    title: 'Cookie Policy',
    effective: 'September 18, 2026',
    intro: 'This Cookie Policy explains the browser storage and cookies used to keep GlobyEdu OS working and to remember user preferences.',
  },
  payments: {
    title: 'Payment & Refund Policy',
    effective: 'September 18, 2026',
    intro: 'This policy explains subscription billing, price changes, payment records, and the fourteen-day refund window for GlobyEdu OS subscriptions.',
  },
};

const Link = ({ href, children }) => `<a class="font-semibold text-sky-700 hover:text-sky-900" href="${href}">${children}</a>`;

function policyBody(type) {
  if (type === 'privacy') {
    return `
      <h2>Information schools provide</h2>
      <p>Schools may provide school details, administrator contact information, teacher records, student records, class information, attendance, academic results, messages, uploaded photos, documents, and other information needed to operate their workspace.</p>
      <p>Authentication records may include email addresses, Firebase account identifiers, role information, password hashes, sign-in activity, and security events. GlobyEdu OS does not store passwords in plain text.</p>
      <h2>How information is used</h2>
      <p>We use information to provide school workspaces, authenticate users, apply tenant and role permissions, deliver requested features, maintain security, provide support, process subscriptions, and improve reliability. Activity and audit records may be used to investigate misuse or security incidents.</p>
      <h2>Services and payments</h2>
      <p>Firebase may provide authentication, database, and file-storage services for production deployments. Paystack may process subscription payments. Payment card details are handled by the payment provider; GlobyEdu OS does not receive or store full card numbers.</p>
      <h2>Student information</h2>
      <p>Schools are responsible for deciding what student information to enter, confirming that they have the authority and permissions required for their use of the service, and responding to requests from students, parents, guardians, or regulators where applicable. GlobyEdu OS is a service provider to the subscribing school and does not decide why a school collects a student's information.</p>
      <h2>Sharing and service providers</h2>
      <p>We share information with service providers only as needed to operate the platform, such as hosting, authentication, storage, email, monitoring, and payment services. We may disclose information when required by law, to protect the platform, or to address fraud, abuse, or security risks.</p>
      <h2>Retention and deletion</h2>
      <p>Schools control their workspace content subject to the subscription agreement and applicable retention needs. We retain account, payment, and security records for as long as reasonably needed for operations, dispute handling, legal obligations, and security. Contact us to request account closure or discuss deletion options.</p>
      <h2>Security and contact</h2>
      <p>We use access controls, tenant separation, password hashing, signed sessions, and other safeguards. No service can promise absolute security. Privacy questions or requests can be sent to ${Link({ href: '#/contact', children: 'our contact team' })}.</p>
    `;
  }
  if (type === 'terms') {
    return `
      <h2>The service</h2>
      <p>GlobyEdu OS is a multi-tenant school-management SaaS platform. A subscribing school may create and manage its workspace, authorize school authorities, teachers, students, and other users, and use the features included in its current plan.</p>
      <h2>Accounts and school responsibility</h2>
      <p>The school is responsible for keeping account details accurate, protecting administrator credentials, assigning appropriate permissions, and ensuring that its users use only the information and features they are authorized to access. The school is also responsible for the content it uploads and for its legal authority to process student and staff information.</p>
      <h2>Acceptable use</h2>
      <p>You must not misuse the service, attempt to bypass tenant or role controls, upload malicious or unlawful content, interfere with another school's workspace, use the service for unauthorized surveillance, or test security against the platform without written permission.</p>
      <h2>Subscriptions and service availability</h2>
      <p>Plans have a billing period, student limit, price, and currency shown at purchase. Trials, plan limits, expiration, suspension, and renewal are applied according to the current plan and account status. We may change or discontinue plans, but a completed payment is not silently changed. Future purchases and renewals use the price displayed at that time. The service may occasionally be unavailable for maintenance, failures, or events outside our control.</p>
      <p>Payment and refund details are described in ${Link({ href: '#/legal/payments', children: 'Payment & Refund Policy' })}.</p>
      <h2>Security and intellectual property</h2>
      <p>You retain rights in your school content. You grant GlobyEdu OS the limited permission needed to host, process, back up, display, and transmit that content to provide the service. GlobyEdu OS and its licensors retain rights in the software, branding, documentation, and platform features.</p>
      <h2>Suspension and termination</h2>
      <p>We may suspend or terminate access for non-payment, misuse, security risk, unlawful activity, or material breach. A school may stop using the service or request account closure. Suspension does not remove payment obligations already incurred or prevent us from retaining records that are reasonably needed for security, disputes, or legal requirements.</p>
      <h2>Disclaimers and limits</h2>
      <p>The service is provided on an as-available basis. We do not promise uninterrupted availability, error-free operation, or that the service will meet every school requirement. To the extent permitted by law, neither party is liable for indirect, incidental, special, or consequential loss arising from use of the service. These limits do not exclude liability that cannot lawfully be excluded.</p>
      <h2>Governing terms and updates</h2>
      <p>Any governing-law or dispute terms applicable to a school should be confirmed in its order or subscription agreement. We may update these Terms by publishing a revised version with a new update date. Contact us through ${Link({ href: '#/contact', children: 'the public contact page' })} with questions.</p>
    `;
  }
  if (type === 'cookies') {
    return `
      <h2>Essential session storage</h2>
      <p>GlobyEdu OS uses browser storage for access-token state, role and school context, remembered sign-in preference, session expiry, and other information needed to keep the SPA working. The backend can issue a refresh token in an HttpOnly cookie; in production it is configured for HTTPS and an appropriate SameSite setting.</p>
      <h2>Preferences</h2>
      <p>We may use local browser storage for interface preferences, workspace display settings, PWA state, and the school directory. These values help the application restore the experience you selected. They are not used to read information from another school's workspace.</p>
      <h2>Firebase and payments</h2>
      <p>Firebase Authentication may use browser storage and provider-managed session state when Firebase login is enabled. Paystack may use its own cookies or browser mechanisms during a hosted payment flow. Those mechanisms are controlled by the relevant provider and are subject to its policies.</p>
      <h2>What we do not claim</h2>
      <p>The current application does not advertise an analytics-cookie program or an advertising-cookie program. If that changes, this policy will be updated before those technologies are introduced.</p>
      <h2>Your choices</h2>
      <p>You can clear browser storage or block cookies, but doing so may sign you out or prevent parts of the platform from working. To close an account or ask a question, contact us through ${Link({ href: '#/contact', children: 'the contact page' })}.</p>
    `;
  }
  return `
    <h2>Plans, billing periods, and currency</h2>
    <p>Subscription plans are shown with their current student limit, billing period, amount, and currency. GlobyEdu OS supports monthly and yearly billing where the selected plan offers both options. The backend is authoritative for the amount sent to Paystack; a client cannot change the payable amount.</p>
    <h2>Fourteen-day refund window</h2>
    <p>A school may request a refund within <strong>14 calendar days of the relevant subscription payment</strong>. The request should identify the school, payment date, Paystack reference, subscription, and reason. We review each request against the account and payment record. An approved refund is recorded with its decision and date.</p>
    <p>After the fourteen-day period, subscription payments are generally non-refundable, except where applicable law requires otherwise or GlobyEdu OS expressly approves an exception. This policy does not remove any rights that cannot legally be waived.</p>
    <h2>Price changes</h2>
    <p>Published prices may change, and we may introduce, change, or discontinue plans. A completed payment keeps the amount confirmed at checkout. Future purchases or renewals may use the current published price, so schools should review the pricing page before paying.</p>
    <h2>Payment records and failures</h2>
    <p>Paystack supplies the payment reference and payment result. A payment is not treated as successfully activating a subscription until the server has received and verified the provider result. Failed, abandoned, reversed, or disputed payments may leave the subscription inactive or suspended until resolved.</p>
    <h2>Refund requests and contact</h2>
    <p>Refund requests should be made through the school support channel or ${Link({ href: '#/contact', children: 'the public contact page' })}. We do not claim to provide an automated Paystack refund where that workflow has not been enabled. An authorized platform administrator may review and record a decision.</p>
  `;
}

export function LegalPage(type = 'privacy') {
  const key = POLICY_META[type] ? type : 'privacy';
  const meta = POLICY_META[key];
  return `
    <div class="min-h-screen bg-slate-50 text-slate-900">
      <main class="mx-auto max-w-4xl px-6 py-12 sm:py-20">
        <a href="#/" class="text-sm font-semibold text-sky-700 hover:text-sky-900">Back to GlobyEdu OS</a>
        <header class="mt-10 border-b border-slate-200 pb-8">
          <p class="text-sm font-semibold uppercase tracking-[0.25em] text-sky-700">GlobyEdu OS</p>
          <h1 class="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">${meta.title}</h1>
          <p class="mt-5 max-w-3xl text-lg leading-8 text-slate-600">${meta.intro}</p>
          <p class="mt-5 text-sm text-slate-500">Effective date: ${meta.effective} · Last updated: ${meta.effective}</p>
        </header>
        <article class="prose prose-slate mt-10 max-w-none prose-headings:font-semibold prose-headings:text-slate-950 prose-a:no-underline prose-p:leading-8">
          ${policyBody(key)}
        </article>
        <nav class="mt-12 flex flex-wrap gap-4 border-t border-slate-200 pt-6 text-sm">
          ${Object.entries(POLICY_META).map(([policyKey, policy]) => `<a class="font-semibold ${policyKey === key ? 'text-slate-950' : 'text-sky-700 hover:text-sky-900'}" href="#/legal/${policyKey}">${policy.title}</a>`).join('')}
        </nav>
      </main>
    </div>
  `;
}
