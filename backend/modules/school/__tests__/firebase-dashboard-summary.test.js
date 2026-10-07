const firebaseData = require('../../../firebase.data');
const firebaseCore = require('../../../firebase.core');
const schoolService = require('../school.service');

describe('Firebase dashboard summary', () => {
  afterEach(() => jest.restoreAllMocks());

  test('builds the tenant dashboard from the Firebase school aggregate', async () => {
    jest.spyOn(firebaseData, 'isFirebaseDataConfigured').mockReturnValue(true);
    jest.spyOn(firebaseCore, 'getSchoolAggregate').mockResolvedValue({
      id: 'globy-school',
      schoolId: 'globy-school',
      name: 'Globy IT School',
      status: 'active',
      schoolStatus: 'active',
      subscriptionStatus: 'active',
      users: [
        { id: 'user-1', role: 'school_authority', status: 'active' },
        { id: 'user-2', role: 'teacher', status: 'active' },
        { id: 'user-3', role: 'student', status: 'active' },
      ],
      teachers: [{ id: 'teacher-1', status: 'active', metadata: {} }],
      students: [{ id: 'student-1', status: 'active', metadata: {} }],
      classes: [{ id: 'class-1', name: 'Class 1', status: 'active' }],
      enrollments: [],
      departments: [],
      streams: [],
      subjects: [],
      academicYears: [],
      terms: [],
      semesters: [],
      attendanceRecords: [],
      payments: [],
      announcements: [],
      events: [],
      recentActivities: [],
    });

    const summary = await schoolService.getDashboardSummary('globy-school');

    expect(firebaseCore.getSchoolAggregate).toHaveBeenCalledWith('globy-school');
    expect(summary).toMatchObject({
      schoolId: 'globy-school',
      name: 'Globy IT School',
      teacherCount: 1,
      studentCount: 1,
      classCount: 1,
      schoolStatus: 'active',
    });
  });
});
