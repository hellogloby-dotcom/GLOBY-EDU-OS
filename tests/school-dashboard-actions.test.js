const { buildSchoolEntityPayload, buildSchoolCollectionPayload, buildChangedFieldsPayload } = require('../frontend/marketing/src/utils/school-dashboard-actions.cjs');

describe('school dashboard action helpers', () => {
  it('builds academic entity payloads for new classes', () => {
    expect(buildSchoolEntityPayload('classes', { name: 'Grade 10A', grade: '10', section: 'A' })).toEqual({
      name: 'Grade 10A',
      grade: '10',
      section: 'A',
      status: 'active',
      capacity: null,
      classTeacher: null,
      department: null,
      subjects: [],
    });
  });

  it('builds collection payloads for report entries', () => {
    expect(buildSchoolCollectionPayload('reports', { title: 'Weekly report', summary: 'Done' })).toEqual({
      title: 'Weekly report',
      summary: 'Done',
      category: null,
      author: null,
      relatedStudents: [],
    });
  });

  it('builds a changed-fields payload for partial updates', () => {
    const payload = buildChangedFieldsPayload(
      { name: 'A', status: 'active', grade: '9' },
      { name: 'A', status: 'archived', grade: '10' },
    );

    expect(payload).toEqual({ status: 'archived', grade: '10' });
  });
});
