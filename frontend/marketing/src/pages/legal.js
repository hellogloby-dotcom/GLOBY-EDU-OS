const POLICY_META = {
  privacy: {
    title: 'Privacy Policy',
    effective: 'September 21, 2026',
    intro: 'This Privacy Policy explains how GlobyEdu OS handles personal data for schools, staff, students, parents, and administrators operating in Ghana and other approved jurisdictions.',
  },
  terms: {
    title: 'Terms of Service',
    effective: 'September 21, 2026',
    intro: 'These Terms describe the agreement between GlobyEdu OS and a Ghana-based school, academy, institution, or organization using the platform.',
  },
  cookies: {
    title: 'Cookie Policy',
    effective: 'September 21, 2026',
    intro: 'This Cookie Policy explains the browser cookies, local storage, and session tools used to keep GlobyEdu OS secure and functional for Ghanaian users.',
  },
  payments: {
    title: 'Payment & Refund Policy',
    effective: 'September 21, 2026',
    intro: 'This policy explains the billing, payment, and refund process for Ghana-based schools using GlobyEdu OS subscriptions and school management services.',
  },
};

const Link = ({ href, children }) => `<a class="font-semibold text-sky-700 hover:text-sky-900" href="${href}">${children}</a>`;

function policyBody(type) {
  if (type === 'privacy') {
    return `
      <h2>Personal data we may collect</h2>
      <p>For Ghana-based schools and institutions, GlobyEdu OS may process school registration data, school address and contact information, administrator names and email addresses, teacher details, student profiles, class records, attendance information, academic records, assignments, assessment results, messaging records, uploaded documents, and account activity necessary to deliver the school operating system.</p>
      <p>We also process authentication information such as hashed passwords, email addresses, role assignments, sign-in activity, and security logs. We do not store raw passwords in plain text.</p>
      <h2>Lawful basis and purpose</h2>
      <p>We process personal data to provide access to the school workspace, authenticate users, apply role-based permissions, deliver school operations, maintain account security, manage subscriptions, provide support, and meet legitimate business needs such as fraud prevention and audit readiness.</p>
      <p>Where a school is using the platform to process student or parent personal data, that school remains responsible for ensuring it has lawful authority to do so under Ghanaian law and its internal policies.</p>
      <h2>Student and parent information</h2>
      <p>Schools using GlobyEdu OS should collect and process student and parent data only for valid educational, administrative, and legal purposes. We support school operations, but the subscribing institution decides what data it records and why it is needed.</p>
      <p>Where a student or parent requests information, correction, or restrictions on processing, the school should respond through its internal data governance process and, where relevant, direct issues to the appropriate regulator or authority.</p>
      <h2>Service providers and cross-border transfer</h2>
      <p>GlobyEdu OS may use hosting, authentication, storage, monitoring, email, and payment service providers such as Firebase, cloud hosting infrastructure, and Paystack. Those providers may process data outside Ghana when necessary to provide the platform and services.</p>
      <p>We put safeguards in place to limit access, use encryption and access control measures, and require service providers to meet reasonable security and privacy requirements.</p>
      <h2>Retention, deletion, and rights</h2>
      <p>We retain records needed for authentication, billing, audits, security, and dispute resolution. Schools can request closure or data deletion where permitted by contract and applicable law, though some records may need to be kept for legal or accounting reasons.</p>
      <p>Users may request information about their data, correction, or deletion through the school administrator or through the support channel listed on ${Link({ href: '#/contact', children: 'the contact page' })}. Requests are assessed in line with the school's operational policies and local legal requirements.</p>
      <h2>Regulatory notice for Ghana</h2>
      <p>GlobyEdu OS supports Ghanaian school operations and is designed to align with the Ghana Data Protection Act, 2012 (Act 843) and the oversight role of the National Data Protection Commission (NDPC) for personal data protection. This policy is not a substitute for a school’s own data protection policy or legal advice from a licensed Ghanaian adviser.</p>
      <h2>Security and contact</h2>
      <p>We use role-based access control, tenant separation, password hashing, signed sessions, and secure infrastructure safeguards. No service can guarantee absolute security, but we take reasonable steps to protect user and school data. Privacy or data protection questions can be sent to ${Link({ href: '#/contact', children: 'our support and contact team' })}.</p>
    `;
  }
  if (type === 'terms') {
    return `
      <h2>The service</h2>
      <p>GlobyEdu OS is a school management and operations platform designed for Ghanaian educational institutions, academies, and school networks. A subscribing school may create a workspace, invite authorized staff, teachers, students, and parents, and use the features included in its plan.</p>
      <h2>School responsibilities</h2>
      <p>The school remains responsible for maintaining correct account information, protecting administrator credentials, assigning appropriate permissions, and ensuring that its users only access the information and features they are authorized to use. The school is responsible for the content it uploads and for confirming it has lawful authority to process student and staff information.</p>
      <h2>Acceptable use</h2>
      <p>Users must not misuse the service, bypass tenant or role controls, upload unlawful content, interfere with another school's workspace, attempt unauthorized surveillance, or test the platform's security without written permission. Schools must also comply with Ghanaian law and the policies of the relevant education authority where applicable.</p>
      <h2>Subscriptions and availability</h2>
      <p>Plans include the billing period, student limit, price, and currency shown at purchase. Trials, plan limits, suspension, renewal, and expiration are applied according to the subscribed plan and account status. We may change or discontinue plans, but a completed payment is not silently changed without notice and a valid update to the pricing and billing terms.</p>
      <p>Payment and refund details are described in ${Link({ href: '#/legal/payments', children: 'Payment & Refund Policy' })}.</p>
      <h2>Security, data, and intellectual property</h2>
      <p>You retain rights in the school content you manage in the platform. You grant GlobyEdu OS the limited permission needed to host, process, back up, display, and transmit that content in order to provide the service. GlobyEdu OS and its licensors retain rights in the software, branding, documentation, and platform features.</p>
      <h2>Suspension and termination</h2>
      <p>We may suspend or terminate access for non-payment, misuse, security risk, unlawful activity, or a material breach of these Terms. A school may also stop using the service or request closure of its account. Suspension does not remove any payment obligations already incurred and does not prevent us from retaining records that are reasonably needed for security, dispute handling, or applicable legal requirements.</p>
      <h2>Disclaimers</h2>
      <p>The service is provided on an as-available basis and we do not guarantee uninterrupted performance, zero error rate, or that the service will meet every school requirement. To the extent permitted by law, we are not liable for indirect, incidental, special, or consequential losses arising from use of the service. This does not exclude liability that cannot lawfully be excluded.</p>
      <h2>Updates</h2>
      <p>We may update these Terms by publishing a revised version with a new effective date. Contact us through ${Link({ href: '#/contact', children: 'the contact page' })} if you have questions about the agreement or its application in a Ghanaian school context.</p>
    `;
  }
  if (type === 'cookies') {
    return `
      <h2>What cookies and browser storage we use</h2>
      <p>GlobyEdu OS uses browser storage and cookies to keep the app working for Ghanaian school users. This includes session state, logged-in role and tenant information, remembered sign-in preference, school context, and app preferences needed for a consistent experience.</p>
      <h2>Essential and functional storage</h2>
      <p>We use storage to keep users signed in, remember the selected dashboard view, preserve preferences, and maintain local PWA state. These tools are necessary for the platform to operate properly and are generally treated as essential functionality rather than optional advertising tracking.</p>
      <h2>Third-party providers</h2>
      <p>Firebase Authentication and Paystack may also use browser session tools during sign-in, sign-up, or payment flows. Those cookies and storage mechanisms are controlled by those providers and are subject to their own operating policies.</p>
      <h2>Your choices</h2>
      <p>You can clear your browser storage or block cookies, but doing so may sign you out or prevent some parts of the platform from working. Where a school or user needs a formal explanation of cookie use or wishes to request data deletion, contact the school administrator or the support team via ${Link({ href: '#/contact', children: 'the contact page' })}.</p>
      <h2>Consent notice</h2>
      <p>Where a Ghanaian school or user needs a more explicit cookie-consent banner for local compliance and marketing use, GlobyEdu OS can be configured to show a clear consent banner before optional analytics or marketing cookies are enabled. We do not currently rely on third-party advertising cookies by default.</p>
    `;
  }
  return `
    <h2>Subscription and billing</h2>
    <p>Subscription plans are shown with the student limit, billing period, amount, and currency. GlobyEdu OS supports monthly and annual billing where the plan allows it. The platform's backend is authoritative for the amount sent to the payment provider and any approved local payment record.</p>
    <h2>Refund and cancellation policy</h2>
    <p>A school may request a refund within <strong>14 calendar days</strong> of making a subscription payment, subject to the applicable account and payment record. The request should include the school name, payment reference, date of purchase, plan, and reason for the request. Each request is reviewed in line with the platform's records and the applicable law.</p>
    <p>After the initial refund window, subscription payments are generally non-refundable unless a different requirement applies under Ghanaian law or the platform grants an exception. This policy does not waive any right that cannot lawfully be waived.</p>
    <h2>Price changes and renewals</h2>
    <p>Plans and prices may change over time. A completed payment keeps the amount confirmed at checkout for the active subscription, while later renewals are charged according to the plan and price published at renewal time. Schools should review the current pricing before renewal or purchase.</p>
    <h2>Payment failures and suspension</h2>
    <p>If a payment fails, is reversed, is disputed, or is not approved by the provider, the service may be held or suspended until the payment issue is resolved. We may also refuse access to upgraded features where payment verification is incomplete or the school has exceeded its service terms.</p>
    <h2>Support and disputes</h2>
    <p>Refund and payment disputes should be handled through the school support channel or ${Link({ href: '#/contact', children: 'the public contact page' })}. The school will be asked to provide the payment reference, date, and relevant order information so the issue can be resolved accurately.</p>
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
