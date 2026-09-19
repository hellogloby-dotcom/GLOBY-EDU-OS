const express = require('express');
const authMiddleware = require('../auth/middleware/auth.middleware');
const { roleGuard } = require('../auth/middleware/role.middleware');
const pricingService = require('./pricing.service');
const paymentService = require('./payment.service');
const { recordAuditEvent } = require('../audit/audit.service');

const router = express.Router();
router.get('/', async (req, res) => {
  try { return res.json({ status: 'ok', pricingPlans: await pricingService.listPricingPlans({ activeOnly: true }) }); }
  catch (error) { return res.status(500).json({ status: 'error', message: error.message }); }
});

router.post('/checkout', authMiddleware, roleGuard(['school_authority', 'school_head', 'super_admin']), async (req, res) => {
  try {
    const body = req.body || {};
    const schoolId = req.user?.tenantId;
    const checkout = await paymentService.initializeCheckout({ ...body, schoolId, email: body.email || req.user?.email, callbackUrl: body.callbackUrl || process.env.APP_URL });
    return res.json({ status: 'ok', checkout });
  } catch (error) { return res.status(400).json({ status: 'error', message: error.message }); }
});

router.post('/verify', authMiddleware, roleGuard(['school_authority', 'school_head', 'super_admin']), async (req, res) => {
  try {
    const payment = await paymentService.verifyPayment(req.body?.reference, req.user?.roles?.includes('super_admin') ? null : req.user?.tenantId);
    return res.json({ status: 'ok', payment });
  } catch (error) { return res.status(400).json({ status: 'error', message: error.message }); }
});

router.post('/refund-requests', authMiddleware, roleGuard(['school_authority', 'school_head', 'super_admin']), async (req, res) => {
  try {
    const refund = await paymentService.requestRefund({ schoolId: req.user?.tenantId, reference: req.body?.reference, reason: req.body?.reason });
    return res.json({ status: 'ok', refund });
  } catch (error) { return res.status(400).json({ status: 'error', message: error.message }); }
});

router.post('/webhook', async (req, res) => {
  try {
    const rawBody = req.rawBody || JSON.stringify(req.body || {});
    const result = await paymentService.processWebhook(rawBody, req.headers['x-paystack-signature'], req.body);
    return res.json({ status: 'ok', ...result });
  } catch (error) { return res.status(400).json({ status: 'error', message: error.message }); }
});

router.use(authMiddleware, roleGuard(['super_admin']));
router.get('/all', async (req, res) => {
  try { return res.json({ status: 'ok', pricingPlans: await pricingService.listPricingPlans() }); }
  catch (error) { return res.status(500).json({ status: 'error', message: error.message }); }
});
router.put('/:id', async (req, res) => {
  try {
    const plan = await pricingService.updatePricingPlan(req.params.id, req.body || {});
    await recordAuditEvent({ req, actorId: req.user?.userId, actorRole: 'super_admin', action: 'pricing.updated', resourceType: 'pricing_plan', resourceId: plan.id });
    return res.json({ status: 'ok', pricingPlan: plan });
  } catch (error) { return res.status(400).json({ status: 'error', message: error.message }); }
});
module.exports = router;