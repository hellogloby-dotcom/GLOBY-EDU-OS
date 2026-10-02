jest.mock('../../../firebase.data', () => ({
  isFirebaseDataConfigured: jest.fn(),
  getFirestore: jest.fn(),
}));

const firebaseData = require('../../../firebase.data');
const firebaseCore = require('../../../firebase.core');

const SCHOOL_ID = 'firebase-archive-school-001';

function createFirestore({ archivedAt = '2026-10-02T00:00:00.000Z', childCollections = [], populatedRootCollection = null } = {}) {
  const tenantDocument = {
    id: SCHOOL_ID,
    listCollections: jest.fn(async () => childCollections),
  };
  const transaction = {
    get: jest.fn(async (target) => {
      if (target === tenantDocument) {
        return { exists: true, data: () => ({ schoolId: SCHOOL_ID, name: 'Archived school', archivedAt }) };
      }
      return { empty: target.collectionName !== populatedRootCollection };
    }),
    delete: jest.fn(),
  };
  const firestore = {
    collection: jest.fn((name) => {
      if (name === 'tenants') return { doc: jest.fn(() => tenantDocument) };
      const query = {
        collectionName: name,
        where() { return this; },
        limit() { return this; },
      };
      return query;
    }),
    runTransaction: jest.fn((callback) => callback(transaction)),
  };
  return { firestore, tenantDocument, transaction };
}

describe('Firebase school archive deletion guard', () => {
  beforeEach(() => {
    firebaseData.isFirebaseDataConfigured.mockReturnValue(true);
  });

  it('deletes an archived tenant only when its root collections and subcollections are empty', async () => {
    const { firestore, transaction } = createFirestore();
    firebaseData.getFirestore.mockReturnValue(firestore);

    const result = await firebaseCore.deleteArchivedTenantIfEmpty(SCHOOL_ID);

    expect(result.schoolId).toBe(SCHOOL_ID);
    expect(transaction.delete).toHaveBeenCalledTimes(1);
  });

  it('blocks deletion when a tenant subcollection contains school data', async () => {
    const childCollection = { id: 'attendanceRecords' };
    const { firestore, transaction } = createFirestore({ childCollections: [childCollection] });
    firebaseData.getFirestore.mockReturnValue(firestore);

    await expect(firebaseCore.deleteArchivedTenantIfEmpty(SCHOOL_ID))
      .rejects.toMatchObject({ code: 'SCHOOL_HAS_DEPENDENCIES' });
    expect(transaction.delete).not.toHaveBeenCalled();
  });

  it('blocks deletion when a root school-scoped collection contains records', async () => {
    const { firestore, transaction } = createFirestore({ populatedRootCollection: 'users' });
    firebaseData.getFirestore.mockReturnValue(firestore);

    await expect(firebaseCore.deleteArchivedTenantIfEmpty(SCHOOL_ID))
      .rejects.toMatchObject({ code: 'SCHOOL_HAS_DEPENDENCIES' });
    expect(transaction.delete).not.toHaveBeenCalled();
  });

  it('independently rejects a tenant that is not archived', async () => {
    const { firestore, transaction } = createFirestore({ archivedAt: null });
    firebaseData.getFirestore.mockReturnValue(firestore);

    await expect(firebaseCore.deleteArchivedTenantIfEmpty(SCHOOL_ID))
      .rejects.toMatchObject({ code: 'SCHOOL_NOT_ARCHIVED' });
    expect(transaction.delete).not.toHaveBeenCalled();
  });
});