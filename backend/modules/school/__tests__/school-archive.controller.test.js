jest.mock('../../audit/audit.service', () => ({
  recordAuditEvent: jest.fn().mockResolvedValue({}),
}));

const authMiddleware = require('../../auth/middleware/auth.middleware');
const schoolService = require('../school.service');
const schoolRouter = require('../school.controller');
const { recordAuditEvent } = require('../../audit/audit.service');

const PLATFORM_ADMIN = {
  userId: 'platform-admin-test',
  roles: ['super_admin'],
  platformAdmin: true,
  tenantId: null,
  schoolId: null,
};
const SCHOOL_ID = 'archive-route-test-001';
const SCHOOL = {
  schoolId: SCHOOL_ID,
  name: 'Archive Route Test School',
  archivedAt: '2026-10-02T00:00:00.000Z',
  schoolStatus: 'active',
  subscriptionStatus: 'trial',
};

const protectedRoutes = [
  ['delete', '/:schoolId'],
  ['get', '/archived'],
  ['post', '/:schoolId/archive'],
  ['post', '/:schoolId/restore'],
  ['delete', '/:schoolId/permanent'],
];

function routeHandlers(method, routePath) {
  const layer = schoolRouter.stack.find((entry) => entry.route?.path === routePath && entry.route.methods[method]);
  if (!layer) throw new Error(`Route not found: ${method.toUpperCase()} ${routePath}`);
  return layer.route.stack;
}

function createResponse() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

function createRequest() {
  return {
    params: { schoolId: SCHOOL_ID },
    query: { search: 'Archive Route', status: 'trial' },
    body: {},
    user: PLATFORM_ADMIN,
    ip: '127.0.0.1',
    get: () => 'archive-test-agent',
  };
}

describe('Super Admin school archive routes', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(protectedRoutes)('%s %s runs authentication and rejects non-Super-Admin roles', (method, routePath) => {
    const handlers = routeHandlers(method, routePath);
    expect(handlers[0].handle).toBe(authMiddleware);

    const req = { user: { roles: ['school_authority'], platformAdmin: false, tenantId: SCHOOL_ID } };
    const res = createResponse();
    const next = jest.fn();
    handlers[1].handle(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it.each(protectedRoutes)('%s %s accepts a tenantless platform administrator', (method, routePath) => {
    const handlers = routeHandlers(method, routePath);
    const req = { user: PLATFORM_ADMIN };
    const res = createResponse();
    const next = jest.fn();
    handlers[1].handle(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('routes active-school DELETE through the protected soft-suspend service and records an audit event', async () => {
    const school = { ...SCHOOL, id: 'firebase-tenant-id' };
    jest.spyOn(schoolService, 'getSchoolBySchoolId').mockResolvedValue(school);
    const suspend = jest.spyOn(schoolService, 'deleteSchool').mockResolvedValue({ ...school, schoolStatus: 'suspended' });
    const handlers = routeHandlers('delete', '/:schoolId');
    const req = createRequest();
    const res = createResponse();

    await handlers[2].handle(req, res);

    expect(suspend).toHaveBeenCalledWith('firebase-tenant-id');
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: SCHOOL_ID,
      action: 'school.suspended',
      resourceId: SCHOOL_ID,
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'ok' }));
  });

  it.each([
    ['post', '/:schoolId/archive', 'archiveSchool', { ...SCHOOL }, 'school.archived'],
    ['post', '/:schoolId/restore', 'restoreSchool', { ...SCHOOL, archivedAt: null }, 'school.restored'],
    ['delete', '/:schoolId/permanent', 'permanentlyDeleteArchivedSchool', { schoolId: SCHOOL_ID, name: SCHOOL.name }, 'school.permanently_deleted'],
  ])('%s %s records the lifecycle audit event after the service succeeds', async (method, routePath, serviceMethod, serviceResult, action) => {
    jest.spyOn(schoolService, serviceMethod).mockResolvedValue(serviceResult);
    const handlers = routeHandlers(method, routePath);
    const req = createRequest();
    const res = createResponse();

    await handlers[2].handle(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'ok' }));
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      actorId: PLATFORM_ADMIN.userId,
      actorRole: 'super_admin',
      tenantId: SCHOOL_ID,
      action,
      resourceType: 'school',
      resourceId: SCHOOL_ID,
    }));
  });
});
