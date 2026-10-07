const { generateSchoolId, validateRegistrationPayload } = require('../registration.service');

describe('registration service', () => {
  test('generates a readable school id in the requested format', () => {
    const id = generateSchoolId('Bright Future Academy', [
      { schoolId: 'GLB-2025-00001' },
      { schoolId: 'GLB-2026-00001' },
    ], 2026);

    expect(id).toBe('GLB-2026-00002');
  });

  test('rejects duplicate emails and weak passwords with friendly messages', () => {
    const existingSchools = [
      {
        schoolId: 'GLB-2026-00001',
        name: 'Existing School',
        users: [{ username: 'head@existing.edu' }],
      },
    ];

    const result = validateRegistrationPayload(
      {
        schoolName: 'New School',
        email: 'contact@newschool.edu',
        phone: '+233200000000',
        schoolType: 'Primary',
        country: 'Ghana',
        state: 'Greater Accra',
        city: 'Accra',
        address: '123 Road',
        head: {
          fullName: 'Jane Doe',
          title: 'Principal',
          email: 'head@existing.edu',
          phone: '+233200000001',
          password: 'weakpass',
        },
        agreements: { terms: true, privacy: true, emailVerification: true },
      },
      existingSchools,
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain('email');
  });

  test('rejects registrations that do not acknowledge required email verification', () => {
    const result = validateRegistrationPayload({
      schoolName: 'New School',
      country: 'Ghana',
      head: {
        fullName: 'Jane Doe',
        email: 'jane@newschool.edu',
        phone: '+233200000002',
        password: 'StrongPass@123',
        confirmPassword: 'StrongPass@123',
      },
      agreements: { terms: true, privacy: true },
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('email verification is required');
  });

  test('rejects registrations that omit a supported country', () => {
    const result = validateRegistrationPayload({
      schoolName: 'Another School',
      country: 'Atlantis',
      head: {
        fullName: 'Jane Doe',
        email: 'jane@another.edu',
        phone: '+233200000002',
        password: 'StrongPass@123',
        confirmPassword: 'StrongPass@123',
      },
      agreements: { terms: true, privacy: true, emailVerification: true },
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('country');
  });
});
