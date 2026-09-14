function buildSchoolEntityPayload(entityType, data = {}) {
  const payload = { ...data };
  if (!payload.status) {
    payload.status = 'active';
  }

  if (entityType === 'departments' || entityType === 'streams' || entityType === 'subjects') {
    payload.name = data.name || data.label || '';
    payload.code = data.code || payload.code || '';
  }

  if (entityType === 'classes') {
    payload.name = data.name || '';
    payload.grade = data.grade || '';
    payload.section = data.section || null;
  }

  if (entityType === 'teachers' || entityType === 'students') {
    payload.fullName = data.fullName || data.name || '';
    payload.email = data.email || '';
    payload.phone = data.phone || null;
    payload.profilePhoto = data.profilePhoto || null;
    if (entityType === 'students') {
      payload.grade = data.grade || null;
    }
  }

  if (entityType === 'academic-years' || entityType === 'terms' || entityType === 'semesters') {
    payload.label = data.label || '';
    payload.startDate = data.startDate || null;
    payload.endDate = data.endDate || null;
  }

  return payload;
}

function buildSchoolCollectionPayload(collectionName, data = {}) {
  const payload = { ...data };
  if (collectionName === 'attendanceRecords') {
    payload.date = data.date || '';
    payload.status = data.status || '';
    payload.note = data.note || '';
  }

  if (collectionName === 'payments') {
    payload.amount = data.amount || '';
    payload.student = data.student || '';
    payload.method = data.method || '';
    payload.note = data.note || '';
  }

  if (collectionName === 'announcements') {
    payload.title = data.title || '';
    payload.detail = data.detail || '';
    payload.audience = data.audience || '';
  }

  if (collectionName === 'messages') {
    payload.recipient = data.recipient || '';
    payload.subject = data.subject || '';
    payload.body = data.body || '';
  }

  if (collectionName === 'reports') {
    payload.title = data.title || '';
    payload.summary = data.summary || '';
  }

  return payload;
}

module.exports = {
  buildSchoolEntityPayload,
  buildSchoolCollectionPayload,
};
