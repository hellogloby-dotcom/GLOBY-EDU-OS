const schoolService = require('../school.service');
const tenantMiddleware = require('../middleware/tenant.middleware');
const firebaseData = require('../../../firebase.data');

const SCHOOL_ID = 'archive-qa-school-001';

function createSchool() {
  return {
    id: 'archive-qa-tenant-id',
    schoolId: SCHOOL_ID,
    name: 'Archive QA School',
    schoolStatus: 'active',
    status: 'active',
    subscriptionStatus: 'trial',
    users: [{ id: 'user-1', email: 'head@example.test', role: 'school_authority' }],
    classes: [{ id: 'class-1', name: 'Class 1' }],
    payments: [{ id: 'payment-1', amount: 100 }],
    subscriptions: [{ id: 'subscription-1', plan: 'trial' }],
  };
}

describe('Super Admin school archive service', () => {
  let previousSnapshot;
  let hadPreviousSnapshot;

  beforeEach(() => {
    hadPreviousSnapshot = Object.prototype.hasOwnProperty.call(global, '__workspaceSnapshot');
    previousSnapshot = global.__workspaceSnapshot;
    global.__workspaceSnapshot = [createSchool()];
  });

  afterEach(() => {
    if (hadPreviousSnapshot) global.__workspaceSnapshot = previousSnapshot;
    else delete global.__workspaceSnapshot;
  });

  it('archives without changing school status or removing tenant data', async () => {
    const original = createSchool();
    const archived = await schoolService.archiveSchool(SCHOOL_ID);

    expect(archived.archivedAt).toEqual(expect.any(String));
    expect(archived.schoolStatus).toBe(original.schoolStatus);
    expect(archived.status).toBe(original.status);
    expect(archived.subscriptionStatus).toBe(original.subscriptionStatus);
    expect(archived.users).toEqual(original.users);
    expect(archived.classes).toEqual(original.classes);
    expect(archived.payments).toEqual(original.payments);
    expect(archived.subscriptions).toEqual(original.subscriptions);
  });

  it('keeps archived schools out of the normal list and returns them in the archived list', async () => {
    await schoolService.archiveSchool(SCHOOL_ID);

    expect(await schoolService.listSchools()).toEqual([]);
    expect((await schoolService.listArchivedSchools()).map((school) => school.schoolId)).toEqual([SCHOOL_ID]);
    expect((await schoolService.listArchivedSchools('archive qa')).map((school) => school.schoolId)).toEqual([SCHOOL_ID]);
    expect(await schoolService.listArchivedSchools('not a match')).toEqual([]);
    expect((await schoolService.listArchivedSchools('', 'trial')).map((school) => school.schoolId)).toEqual([SCHOOL_ID]);
    expect(await schoolService.listArchivedSchools('', 'active')).toEqual([]);
  });

  it('excludes archived schools from platform summary metrics', async () => {
    await schoolService.archiveSchool(SCHOOL_ID);

    const summary = await schoolService.getPlatformSummary();

    expect(summary.totalSchools).toBe(0);
    expect(summary.schools).toEqual([]);
  });

  it('restores only archive state and preserves status and related data', async () => {
    await schoolService.archiveSchool(SCHOOL_ID);
    const restored = await schoolService.restoreSchool(SCHOOL_ID);

    expect(restored.archivedAt).toBeNull();
    expect(restored.schoolStatus).toBe('active');
    expect(restored.status).toBe('active');
    expect(restored.subscriptionStatus).toBe('trial');
    expect(restored.users).toHaveLength(1);
    expect(restored.payments).toHaveLength(1);
    expect((await schoolService.listSchools()).map((school) => school.schoolId)).toEqual([SCHOOL_ID]);
    expect(await schoolService.listArchivedSchools()).toEqual([]);
  });

  it('denies archived tenant access without blocking the tenantless platform-admin path', async () => {
    const firebaseMode = jest.spyOn(firebaseData, 'isFirebaseDataConfigured').mockReturnValue(false);
    try {
      await schoolService.archiveSchool(SCHOOL_ID);

      const tenantReq = {
        user: { roles: ['school_authority'], tenantId: SCHOOL_ID, schoolId: SCHOOL_ID },
        params: { schoolId: SCHOOL_ID },
        body: {},
        headers: {},
      };
      const tenantRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const tenantNext = jest.fn();
      await tenantMiddleware(tenantReq, tenantRes, tenantNext);

      expect(tenantRes.status).toHaveBeenCalledWith(403);
      expect(tenantRes.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SCHOOL_ARCHIVED' }));
      expect(tenantNext).not.toHaveBeenCalled();

      const adminNext = jest.fn();
      await tenantMiddleware({
        user: { roles: ['super_admin'], platformAdmin: true, tenantId: null, schoolId: null },
        params: { schoolId: SCHOOL_ID },
        body: {},
        headers: {},
      }, tenantRes, adminNext);
      expect(adminNext).toHaveBeenCalledTimes(1);
    } finally {
      firebaseMode.mockRestore();
    }
  });

  it('blocks permanent deletion unless the school is archived', async () => {
    await expect(schoolService.permanentlyDeleteArchivedSchool(SCHOOL_ID))
      .rejects.toMatchObject({ code: 'SCHOOL_NOT_ARCHIVED' });
    expect(global.__workspaceSnapshot).toHaveLength(1);
  });

  it('blocks permanent deletion of an archived fallback aggregate with related records', async () => {
    await schoolService.archiveSchool(SCHOOL_ID);

    await expect(schoolService.permanentlyDeleteArchivedSchool(SCHOOL_ID))
      .rejects.toMatchObject({ code: 'SCHOOL_HAS_DEPENDENCIES' });
    expect(global.__workspaceSnapshot).toHaveLength(1);
    expect(global.__workspaceSnapshot[0].users).toHaveLength(1);
  });

  it('permanently removes an empty archived fallback aggregate', async () => {
    global.__workspaceSnapshot = [{
      ...createSchool(),
      users: [],
      classes: [],
      payments: [],
      subscriptions: [],
    }];
    await schoolService.archiveSchool(SCHOOL_ID);
    const deleted = await schoolService.permanentlyDeleteArchivedSchool(SCHOOL_ID);

    expect(deleted.schoolId).toBe(SCHOOL_ID);
    expect(global.__workspaceSnapshot).toEqual([]);
    expect(await schoolService.listSchools()).toEqual([]);
    expect(await schoolService.listArchivedSchools()).toEqual([]);
  });
});