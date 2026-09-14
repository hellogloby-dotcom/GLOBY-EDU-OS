const express = require('express');
const authRouter = require('../../../routes/auth');

describe('school login route', () => {
  let app;
  let server;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/auth', authRouter);
    await new Promise((resolve) => {
      server = app.listen(0, resolve);
    });
  });

  afterAll(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  test('accepts a valid student login for the demo school', async () => {
    const port = server.address().port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/auth/school-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schoolId: 'globy-school',
        username: 'STU001',
        password: 'GlobyStudent@123',
        schoolName: 'Globy School',
        studentName: 'Test Student',
        className: 'JHS 3',
        loginType: 'student',
      }),
    });

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.status).toBe('ok');
    expect(payload.role).toBe('student');
    expect(payload.schoolId).toBe('globy-school');
    expect(payload.fullName).toBe('Test Student');
  });
});
