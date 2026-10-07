function generateSchoolId(name, existingSchools = [], year = new Date().getFullYear()) {
  const nextSequence = (existingSchools || []).reduce((max, school) => {
    const match = String(school?.schoolId || '').match(/-(\d{5})$/);
    if (match) {
      const parsed = Number(match[1]);
      return Math.max(max, parsed);
    }
    return max;
  }, 0);
  const serial = String(nextSequence + 1).padStart(5, '0');
  return `GLB-${year}-${serial}`;
}

function isStrongPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(String(password || ''));
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function isValidPhone(phone) {
  return /^\+?[0-9\s().-]{7,15}$/.test(String(phone || '').trim());
}

function validateRegistrationPayload(payload, existingSchools = []) {
  const errors = [];
  const supportedCountries = [
    'ghana', 'nigeria', 'kenya', 'uganda', 'south africa', 'united kingdom', 'united states', 'canada', 'india', 'australia', 'rwanda', 'tanzania', 'zambia', 'egypt', 'morocco',
  ];

  if (!String(payload?.schoolName || '').trim()) {
    errors.push('School name is required.');
  }

  const normalizedSchoolName = String(payload?.schoolName || '').trim().toLowerCase();
  const duplicateSchoolName = (existingSchools || []).some((school) => String(school?.name || '').trim().toLowerCase() === normalizedSchoolName);
  if (duplicateSchoolName) {
    errors.push('A school with that name already exists.');
  }

  const normalizedCountry = String(payload?.country || '').trim().toLowerCase();
  if (!normalizedCountry || !supportedCountries.includes(normalizedCountry)) {
    errors.push('Please choose a supported country.');
  }

  if (!payload?.head?.fullName) {
    errors.push('The school authority full name is required.');
  }

  if (!payload?.head?.email || !isValidEmail(payload.head.email)) {
    errors.push('Please enter a valid authority email.');
  } else {
    const duplicateEmail = (existingSchools || []).some((school) => {
      const users = Array.isArray(school?.users) ? school.users : [];
      const email = String(payload.head.email).trim().toLowerCase();
      return String(school?.headEmail || '').trim().toLowerCase() === email ||
        users.some((user) => [user?.username, user?.email]
          .filter(Boolean)
          .some((value) => String(value).trim().toLowerCase() === email));
    });
    if (duplicateEmail) {
      errors.push('An account already exists for this email.');
    }
  }

  if (!payload?.head?.phone || !isValidPhone(payload.head.phone)) {
    errors.push('Please enter a valid phone number.');
  }

  if (!payload?.head?.password || !isStrongPassword(payload.head.password)) {
    errors.push('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.');
  }

  if (payload?.head?.password && payload?.head?.password !== payload?.head?.confirmPassword) {
    errors.push('Passwords do not match.');
  }

  if (!payload?.agreements?.terms || !payload?.agreements?.privacy) {
    errors.push('You must accept the Terms of Service and Privacy Policy.');
  }

  if (!payload?.agreements?.emailVerification) {
    errors.push('You must acknowledge that email verification is required before sign-in.');
  }

  return {
    ok: errors.length === 0,
    message: errors[0] || null,
    errors,
  };
}

module.exports = {
  generateSchoolId,
  isStrongPassword,
  isValidEmail,
  isValidPhone,
  validateRegistrationPayload,
};
