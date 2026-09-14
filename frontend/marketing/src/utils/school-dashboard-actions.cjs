function buildSchoolEntityPayload(entityType, data = {}) {
  const payload = { ...data };
  if (!payload.status) {
    payload.status = 'active';
  }

  if (entityType === 'departments' || entityType === 'streams' || entityType === 'subjects') {
    payload.name = data.name || data.label || '';
    payload.code = data.code || payload.code || '';
    payload.description = data.description || payload.description || null;
  }

  if (entityType === 'classes') {
    payload.name = data.name || '';
    payload.grade = data.grade || data.year || '';
    payload.section = data.section || data.stream || null;
    payload.department = data.department || null;
    payload.capacity = data.capacity || null;
    payload.classTeacher = data.classTeacher || null;
    payload.subjects = Array.isArray(data.subjects) ? data.subjects : String(data.subjects || '').split(',').map((item) => item.trim()).filter(Boolean);
  }

  if (entityType === 'teachers' || entityType === 'students') {
    payload.fullName = data.fullName || data.name || '';
    payload.email = data.email || '';
    payload.phone = data.phone || null;
    payload.profilePhoto = data.profilePhoto || data.passportPhoto || null;
    payload.gender = data.gender || null;
    payload.dateOfBirth = data.dateOfBirth || data.birthDate || null;
    payload.nationalId = data.nationalId || data.nationalIdNumber || null;
    payload.address = data.address || data.homeAddress || null;
    payload.country = data.country || null;
    payload.region = data.region || null;
    payload.status = data.status || payload.status;

    if (entityType === 'students') {
      payload.gradeLevel = data.gradeLevel || data.grade || null;
      payload.className = data.className || data.className || null;
      payload.section = data.section || data.stream || null;
      payload.studentId = data.studentId || null;
      payload.admissionNumber = data.admissionNumber || null;
      payload.currentAcademicYear = data.currentAcademicYear || data.academicYear || null;
      payload.currentTerm = data.currentTerm || data.term || null;
      payload.guardian = data.guardian || data.parentName || null;
      payload.parentPhone = data.parentPhone || data.guardianPhone || null;
      payload.parentEmail = data.parentEmail || data.guardianEmail || null;
      payload.medical = data.medical || data.medicalNotes || null;
      payload.house = data.house || null;
      payload.transportMode = data.transportMode || null;
      payload.enrollmentDate = data.enrollmentDate || null;
      payload.documents = Array.isArray(data.documents) ? data.documents : String(data.documents || '').split(',').map((item) => item.trim()).filter(Boolean);
    }

    if (entityType === 'teachers') {
      payload.teacherId = data.teacherId || null;
      payload.employeeNumber = data.employeeNumber || null;
      payload.department = data.department || null;
      payload.position = data.position || data.jobTitle || null;
      payload.qualification = data.qualification || null;
      payload.yearsOfExperience = data.yearsOfExperience || data.experience || null;
      payload.currentAcademicYear = data.currentAcademicYear || data.academicYear || null;
      payload.currentTerm = data.currentTerm || data.term || null;
      payload.assignedClasses = Array.isArray(data.assignedClasses) ? data.assignedClasses : String(data.assignedClasses || data.classAssignments || '').split(',').map((item) => item.trim()).filter(Boolean);
      payload.assignedSubjects = Array.isArray(data.assignedSubjects) ? data.assignedSubjects : String(data.assignedSubjects || data.subjectAssignments || '').split(',').map((item) => item.trim()).filter(Boolean);
      payload.classTeacher = data.classTeacher !== undefined ? data.classTeacher : data.isClassTeacher || false;
      payload.houseMaster = data.houseMaster !== undefined ? data.houseMaster : data.isHouseMaster || false;
      payload.employmentDate = data.employmentDate || null;
      payload.employmentType = data.employmentType || null;
      payload.subjectSpecialty = data.subjectSpecialty || null;
      payload.documents = Array.isArray(data.documents) ? data.documents : String(data.documents || '').split(',').map((item) => item.trim()).filter(Boolean);
    }
  }

  if (entityType === 'academic-years' || entityType === 'terms' || entityType === 'semesters') {
    payload.label = data.label || data.name || '';
    payload.startDate = data.startDate || null;
    payload.endDate = data.endDate || null;
    payload.description = data.description || null;
  }

  return payload;
}

function buildSchoolCollectionPayload(collectionName, data = {}) {
  const payload = { ...data };
  if (collectionName === 'attendanceRecords') {
    payload.date = data.date || '';
    payload.status = data.status || '';
    payload.studentName = data.studentName || data.student || data.fullName || null;
    payload.studentId = data.studentId || null;
    payload.className = data.className || data.class || null;
    payload.teacher = data.teacher || null;
    payload.subject = data.subject || null;
    payload.note = data.note || '';
    payload.recordedAt = data.recordedAt || new Date().toISOString();
  }

  if (collectionName === 'payments') {
    payload.amount = data.amount || '';
    payload.student = data.student || '';
    payload.method = data.method || '';
    payload.feeType = data.feeType || data.category || null;
    payload.term = data.term || null;
    payload.reference = data.reference || null;
    payload.status = data.status || 'received';
    payload.note = data.note || '';
  }

  if (collectionName === 'announcements') {
    payload.title = data.title || '';
    payload.detail = data.detail || '';
    payload.audience = data.audience || '';
    payload.channel = data.channel || 'all';
    payload.priority = data.priority || 'normal';
    payload.attachments = Array.isArray(data.attachments) ? data.attachments : String(data.attachments || '').split(',').map((item) => item.trim()).filter(Boolean);
    payload.effectiveDate = data.effectiveDate || null;
    payload.expiryDate = data.expiryDate || null;
  }

  if (collectionName === 'messages') {
    payload.recipient = data.recipient || '';
    payload.subject = data.subject || '';
    payload.body = data.body || '';
    payload.channel = data.channel || 'workspace';
    payload.sendVia = data.sendVia || 'email';
    payload.priority = data.priority || 'normal';
    payload.attachments = Array.isArray(data.attachments) ? data.attachments : String(data.attachments || '').split(',').map((item) => item.trim()).filter(Boolean);
  }

  if (collectionName === 'reports') {
    payload.title = data.title || '';
    payload.summary = data.summary || '';
    payload.category = data.category || null;
    payload.author = data.author || null;
    payload.relatedStudents = Array.isArray(data.relatedStudents) ? data.relatedStudents : String(data.relatedStudents || '').split(',').map((item) => item.trim()).filter(Boolean);
  }

  return payload;
}

function buildChangedFieldsPayload(currentData = {}, updatedData = {}) {
  const changes = {};
  Object.entries(updatedData).forEach(([key, value]) => {
    if (currentData[key] !== value) {
      changes[key] = value;
    }
  });
  return changes;
}

module.exports = {
  buildSchoolEntityPayload,
  buildSchoolCollectionPayload,
  buildChangedFieldsPayload,
};
