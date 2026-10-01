const crypto = require('crypto');
const express = require('express');
const pricingRoutes = require('../pricing.routes');

describe('Paystack webhook raw body handling', () => {
  const originalSecret = process.env.PAYSTACK_WEBHOOK_SECRET;

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.PAYSTACK_WEBHOOK_SECRET;
    else process.env.PAYSTACK_WEBHOOK_SECRET = originalSecret;
  });

  test('rejects requests without captured raw request bytes', async () => {
    process.env.PAYSTACK_WEBHOOK_SECRET = 'webhook-route-test-secret';
    const app = express();
    app.use(express.json());
    app.use('/pricing', pricingRoutes);
    const server = await new Promise((resolve) => {
      const listener = app.listen(0, () => resolve(listener));
    });
    const event = { event: 'ping' };
    const signature = crypto.createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET)
      .update(JSON.stringify(event))
      .digest('hex');

    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/pricing/webhook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-paystack-signature': signature },
        body: '{ "event" : "ping" }',
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ status: 'error' });
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});