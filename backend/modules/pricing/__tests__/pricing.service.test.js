const pricingService = require('../pricing.service');
const paymentService = require('../payment.service');

describe('authoritative pricing service', () => {
  it('loads the official active plans', async () => {
    const plans = await pricingService.listPricingPlans({ activeOnly: true });
    expect(plans.map((plan) => [plan.slug, plan.studentLimit, plan.monthlyAmount, plan.yearlyAmount])).toEqual([
      ['starter', 100, 150, 1500],
      ['growth', 300, 300, 3000],
      ['pro', 700, 500, 5000],
    ]);
  });

  it.each([
    ['starter', 'monthly', 150],
    ['starter', 'yearly', 1500],
    ['growth', 'monthly', 300],
    ['growth', 'yearly', 3000],
    ['pro', 'monthly', 500],
    ['pro', 'yearly', 5000],
  ])('resolves %s %s to the authoritative amount', async (slug, period, amount) => {
    await expect(pricingService.getPricingPlan(slug, period)).resolves.toMatchObject({ slug, billingPeriod: period, amount, currency: 'GHS' });
  });

  it('persists admin-editable plan metadata such as shortDescription', async () => {
    const plan = (await pricingService.listPricingPlans({ activeOnly: true }))[0];
    const updated = await pricingService.updatePricingPlan(plan.id, {
      ...plan,
      shortDescription: 'Essential school management tools for small schools ready to move their daily operations online.',
      recommendedBadge: true,
    });

    expect(updated.shortDescription).toBe('Essential school management tools for small schools ready to move their daily operations online.');
    expect(updated.recommendedBadge).toBe(true);

    const reloaded = await pricingService.getPricingPlan(plan.slug, 'monthly');
    expect(reloaded.shortDescription).toBe('Essential school management tools for small schools ready to move their daily operations online.');
    expect(reloaded.recommendedBadge).toBe(true);
  });

  it('rejects inactive or unknown plans and invalid periods', async () => {
    await expect(pricingService.getPricingPlan('missing', 'monthly')).rejects.toThrow('not available');
    await expect(pricingService.getPricingPlan('starter', 'termly')).rejects.toThrow('monthly or yearly');
  });

  it('initializes Paystack with the backend amount instead of a client amount', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: true, data: { reference: 'paystack-ref', authorization_url: 'https://checkout.test' } }),
    });
    const originalSecret = process.env.PAYSTACK_SECRET_KEY;
    process.env.PAYSTACK_SECRET_KEY = 'server-only-test-secret';
    try {
      const result = await pricingService.initializePaystackCheckout({ planSlug: 'starter', billingPeriod: 'monthly', email: 'school@example.test', amount: 1 });
      expect(result.amount).toBe(150);
      expect(global.fetch).toHaveBeenCalledWith('https://api.paystack.co/transaction/initialize', expect.objectContaining({
        body: expect.stringContaining('15000'),
        headers: expect.objectContaining({ Authorization: 'Bearer server-only-test-secret' }),
      }));
    } finally {
      global.fetch = originalFetch;
      if (originalSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY;
      else process.env.PAYSTACK_SECRET_KEY = originalSecret;
    }
  });

  it('records out-of-window refund requests without throwing and preserves the decision trail', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: true, data: { reference: 'paystack-refund-out', authorization_url: 'https://checkout.test/refund' } }),
    });
    const originalSecret = process.env.PAYSTACK_SECRET_KEY;
    process.env.PAYSTACK_SECRET_KEY = 'server-only-test-secret';
    try {
      const checkout = await paymentService.initializeCheckout({
        schoolId: 'school-refund-1',
        email: 'refund@example.test',
        planSlug: 'starter',
        billingPeriod: 'monthly',
        callbackUrl: 'https://example.com/checkout',
        acceptance: { terms: true, privacy: true, paymentRefund: true },
      });
      const paymentRecord = await paymentService.getPayment(checkout.reference);
      paymentRecord.paidAt = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
      paymentRecord.status = 'activated';

      await expect(paymentService.requestRefund({
        schoolId: paymentRecord.schoolId,
        reference: paymentRecord.reference,
        reason: 'Example refund request',
      })).resolves.toMatchObject({
        paymentReference: paymentRecord.reference,
        schoolId: paymentRecord.schoolId,
        status: 'Rejected',
        eligibility: 'outside_window',
      });
    } finally {
      global.fetch = originalFetch;
      if (originalSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY;
      else process.env.PAYSTACK_SECRET_KEY = originalSecret;
    }
  });

  it('keeps webhook processing idempotent for duplicate successful events', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: true, data: { reference: 'paystack-webhook-idempotent', authorization_url: 'https://checkout.test/webhook' } }),
    });
    const originalSecret = process.env.PAYSTACK_SECRET_KEY;
    process.env.PAYSTACK_SECRET_KEY = 'server-only-test-secret';
    try {
      const checkout = await paymentService.initializeCheckout({
        schoolId: 'school-webhook-1',
        email: 'webhook@example.test',
        planSlug: 'starter',
        billingPeriod: 'monthly',
        callbackUrl: 'https://example.com/checkout',
        acceptance: { terms: true, privacy: true, paymentRefund: true },
      });
      const payment = await paymentService.getPayment(checkout.reference);
      payment.amountMinor = 15000;
      payment.status = 'initialized';
      const eventBody = {
        event: 'charge.success',
        data: {
          reference: checkout.reference,
          amount: 15000,
          currency: 'GHS',
          status: 'success',
          metadata: { schoolId: payment.schoolId, planSlug: payment.planSlug, billingPeriod: payment.billingPeriod },
          paid_at: new Date().toISOString(),
        },
      };
      const rawBody = JSON.stringify(eventBody);
      const signature = require('crypto').createHmac('sha512', 'server-only-test-secret').update(rawBody).digest('hex');
      const result = await paymentService.processWebhook(rawBody, signature, eventBody);
      const duplicate = await paymentService.processWebhook(rawBody, signature, eventBody);
      expect(result.processed).toBe(true);
      expect(duplicate.processed).toBe(true);
      expect((await paymentService.getPayment(checkout.reference)).status).toBe('activated');
    } finally {
      global.fetch = originalFetch;
      if (originalSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY;
      else process.env.PAYSTACK_SECRET_KEY = originalSecret;
    }
  });
});
