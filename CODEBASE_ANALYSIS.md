# GlobyEdu OS Codebase Analysis
## Complete Authentication, Routing, Module Structure, Data Flow & Error Handling

---

## 1. AUTHENTICATION FLOW

### 1.1 Super Admin Login Flow

**Entry Point:** `frontend/marketing/src/pages/login.js` → "Super Admin Login" link
**Frontend Handler:** `frontend/marketing/src/main.js` → `attachLoginHandlers()`
**API Endpoint:** `POST /api/v1/auth/platform-login`
**Backend Handler:** `backend/routes/auth.js` → `router.post('/platform-login')`

**Flow Steps:**
1. User selects "Super Admin Login" from role selection card
2. Redirected to `#/platform-admin` route
3. Platform admin login form displays (dedicated form in `platform-admin.js`)
4. User enters email and password
5. **Frontend submits:** `POST /api/v1/auth/platform-login`
   ```json
   {
     "username": "admin@globy.com",
     "password": "password123"
   }
   ```
6. **Backend validation:**
   - Searches fallback data in `backend/data/schools.json` for platformAdmin flag
   - Verifies password against stored hash using bcrypt
   - Checks user status is "active"
   - Validates email is verified
7. **Success Response:**
   ```json
   {
     "status": "ok",
     "token": "jwt-access-token",
     "accessToken": "jwt-access-token",
     "role": "super_admin",
     "platformAdmin": true,
     "fullName": "Benjamin Admin",
     "schoolName": "Platform Admin",
     "emailVerified": true,
     "subscriptionStatus": "active"
   }
   ```
8. **Frontend stores tokens:** 
   - `globyedu_accessToken`
   - `globyedu_userRole` = "super_admin"
   - `globyedu_platformAdmin` = true
   - `globyedu_userFullName`
9. **Redirect:** `location.hash = '#/admin/overview'`

**Session Persistence:**
- Access token stored in `localStorage.globyedu_accessToken`
- Platform admin flag stored as `globyedu_platformAdmin`
- With "Remember Me": Session persists 7 days
- Without "Remember Me": Session persists 1 hour

---

### 1.2 School Authority Login Flow

**Entry Point:** `frontend/marketing/src/pages/login.js` → "School Authority" role card
**Frontend Handler:** `frontend/marketing/src/main.js` → `attachLoginHandlers()`
**API Endpoint:** `POST /api/v1/auth/school-login`
**Backend Handler:** `backend/routes/auth.js` → `router.post('/school-login')`

**Flow Steps:**
1. User selects "School Authority" role card
2. Login form displays with fields:
   - School ID input (`#school-id`)
   - School Email input (`#student-id`)
   - School Name input (`#school-name`)
   - Remember Me checkbox
3. User enters credentials
4. **Frontend submits:**
   ```json
   {
     "schoolId": "globy-school",
     "username": "head@school.edu",
     "password": "BENJAMIN@123",
     "loginType": "school_authority",
     "schoolName": "Globy School"
   }
   ```
5. **Backend validation:**
   - Loads school from `backend/data/schools.json` by schoolId
   - Finds user in school.users array by email
   - Validates password hash matches
   - Checks user role equals "school_authority"
   - Verifies user status is "active"
6. **Success Response:**
   ```json
   {
     "status": "ok",
     "token": "jwt-access-token",
     "accessToken": "jwt-access-token",
     "role": "school_authority",
     "username": "head@school.edu",
     "fullName": "School Head Name",
     "schoolId": "globy-school",
     "schoolName": "Globy School",
     "emailVerified": true,
     "accountStatus": "active",
     "subscriptionPlan": "5-Day Trial",
     "subscriptionStatus": "trial"
   }
   ```
7. **Frontend stores:**
   - `globyedu_accessToken`
   - `globyedu_userRole` = "school_authority"
   - `globyedu_userEmail` = "head@school.edu"
   - `globyedu_userFullName`
   - `globyedu_schoolId` = "globy-school"
   - `globyedu_schoolName` = "Globy School"
8. **Redirect:** `location.hash = '#/school/overview'`

**Session Duration:**
- With "Remember Me": `1000 * 60 * 60 * 24 * 7` (7 days)
- Without "Remember Me": `1000 * 60 * 60` (1 hour)
- Stored in `globyedu_sessionExpiresAt`

---

### 1.3 Teacher Login Flow

**Entry Point:** `frontend/marketing/src/pages/login.js` → "Teacher" role card
**Frontend Handler:** `frontend/marketing/src/main.js` → `attachLoginHandlers()`
**API Endpoint:** `POST /api/v1/auth/school-login` with `loginType: 'teacher'`
**Backend Handler:** `backend/routes/auth.js` → Teacher-specific validation

**Flow Steps:**
1. User selects "Teacher" role card
2. Login form displays with fields:
   - School Name input (`#school-name`)
   - Teacher Name input (`#teacher-name`)
   - Teacher ID input (placeholder: "T001")
   - Password input
   - Remember Me checkbox
   - Additional teacher details section shows dynamically
3. User enters: `schoolId`, `teacherId`, `teacherName`, `password`
4. **Frontend submits:**
   ```json
   {
     "schoolId": "globy-school",
     "username": "T001",
     "password": "BENJAMIN@123",
     "loginType": "teacher",
     "schoolName": "Globy School",
     "teacherName": "Demo Teacher"
   }
   ```
5. **Backend validation:**
   - Loads school by schoolId
   - Finds user by teacherId matching username
   - **Additional check:** Validates `user.role === 'teacher'`
   - Verifies teacher name matches `user.fullName` (if provided)
   - Validates password hash
   - Checks user status is "active"
6. **Success Response:**
   ```json
   {
     "status": "ok",
     "token": "jwt-access-token",
     "accessToken": "jwt-access-token",
     "role": "teacher",
     "username": "T001",
     "fullName": "Demo Teacher",
     "schoolId": "globy-school",
     "schoolName": "Globy School",
     "emailVerified": true,
     "accountStatus": "active"
   }
   ```
7. **Frontend stores:**
   - `globyedu_accessToken`
   - `globyedu_userRole` = "teacher"
   - `globyedu_userEmail` = "T001" (teacher ID)
   - `globyedu_userFullName` = "Demo Teacher"
   - `globyedu_schoolId`
   - `globyedu_schoolName`
8. **Redirect:** `location.hash = '#/role/teacher'`

**Teacher Form Fields (Dynamic):**
- Hidden by default for other roles
- Shown when role = "teacher"
- Element ID: `#teacher-details`
- Fields: Teacher name, teacher ID

---

### 1.4 Student Login Flow

**Entry Point:** `frontend/marketing/src/pages/login.js` → "Student" role card
**Frontend Handler:** `frontend/marketing/src/main.js` → `attachLoginHandlers()`
**API Endpoint:** `POST /api/v1/auth/school-login` with `loginType: 'student'`
**Backend Handler:** `backend/routes/auth.js` → Student-specific validation

**Flow Steps:**
1. User selects "Student" role card
2. Login form displays with fields:
   - School Name input (`#school-name`)
   - Student Name input (`#student-name`)
   - Class input (`#student-class`)
   - Student ID input (placeholder: "STD-001")
   - Password input
   - Remember Me checkbox
   - Additional student details section shows dynamically
3. User enters: `schoolId`, `studentId`, `studentName`, `className`, `password`
4. **Frontend submits:**
   ```json
   {
     "schoolId": "globy-school",
     "username": "STD-001",
     "password": "BENJAMIN@123",
     "loginType": "student",
     "schoolName": "Globy School",
     "studentName": "Demo Student",
     "className": "JHS 1A"
   }
   ```
5. **Backend validation:**
   - Loads school by schoolId
   - Finds user by studentId matching username
   - **Additional checks:**
     - Validates `user.role === 'student'`
     - **Verifies student name matches** `user.fullName` or `user.studentName`
     - **Verifies class matches** `user.className` or `user.class`
   - Validates password hash
   - Checks user status is "active"
6. **Success Response:**
   ```json
   {
     "status": "ok",
     "token": "jwt-access-token",
     "accessToken": "jwt-access-token",
     "role": "student",
     "username": "STD-001",
     "fullName": "Demo Student",
     "grade": "JHS 1A",
     "schoolId": "globy-school",
     "schoolName": "Globy School",
     "emailVerified": true,
     "accountStatus": "active"
   }
   ```
7. **Frontend stores:**
   - `globyedu_accessToken`
   - `globyedu_userRole` = "student"
   - `globyedu_userEmail` = "STD-001" (student ID)
   - `globyedu_userFullName` = "Demo Student"
   - `globyedu_grade` = "JHS 1A"
   - `globyedu_schoolId`
   - `globyedu_schoolName`
8. **Redirect:** `location.hash = '#/role/student'`

**Student Form Fields (Dynamic):**
- Hidden by default for other roles
- Shown when role = "student"
- Element ID: `#student-details`
- Fields: Student name, class

---

### 1.5 Session Persistence Mechanism

**localStorage Keys for All Roles:**
```javascript
{
  'globyedu_accessToken': 'jwt-token-value',           // JWT access token
  'globyedu_refreshToken': 'refresh-token-value',      // Refresh token (if Prisma enabled)
  'globyedu_userRole': 'super_admin|school_authority|teacher|student',
  'globyedu_platformAdmin': 'true|false',              // Only for super admin
  'globyedu_userEmail': 'user@school.edu',
  'globyedu_userFullName': 'Full Name',
  'globyedu_schoolId': 'school-id',                    // All except super admin
  'globyedu_schoolName': 'School Name',                // All except super admin
  'globyedu_grade': 'JHS 1A',                          // Students only
  'globyedu_sessionActive': 'true',
  'globyedu_sessionExpiresAt': 'timestamp-ms',
  'globyedu_sessionRemembered': 'true|false',
  'globyedu_sessionHistory': '[{id, timestamp, role}]' // Session tracking
}
```

**Token Retrieval Logic:**
- Function: `getAccessToken()` in main.js
- Returns: `localStorage.getItem('globyedu_accessToken')`
- Used in all API calls with: `Authorization: Bearer {token}`

**Session Expiration Check:**
```javascript
// Read from storage on every page load
const session = getStoredSession();
if (session.token && session.role && session.username) {
  // Session valid - render dashboard
  renderDashboard(session);
} else {
  // Session invalid - show login
  renderLoginPage();
}
```

**Session Timeout:**
- Checked via `globyedu_sessionExpiresAt` timestamp
- If expired: Auto-logout and redirect to `#/login`
- Client-side expiration tracking (backend validation via JWT expiry)

**Remember Me Implementation:**
```javascript
if (remember) {
  localStorage.setItem('globyedu_sessionActive', 'true');
  localStorage.setItem('globyedu_sessionExpiresAt', Date.now() + 7*24*60*60*1000);
  localStorage.setItem('globyedu_sessionRemembered', 'true');
} else {
  sessionStorage.setItem('globyedu_sessionActive', 'true');
  localStorage.setItem('globyedu_sessionExpiresAt', Date.now() + 1*60*60*1000);
  localStorage.removeItem('globyedu_sessionRemembered');
}
```

---

## 2. DASHBOARD ROUTING

### 2.1 Route Structure by Role

**Super Admin Routes:**
```
#/admin/overview              → Platform Dashboard
#/admin/schools               → School Management
#/admin/users                 → User Directory
#/admin/subscriptions         → Subscription Analytics
#/admin/payments              → Payments Management
#/admin/pricing               → Pricing Management
#/admin/website-cms           → Website Content Management
#/admin/ai-settings           → AI Provider Configuration
#/admin/analytics             → Analytics Studio
#/admin/reports               → Reports & Insights
#/admin/messages              → Platform Messaging
#/admin/announcements         → Platform Announcements
#/admin/support               → Support Center
#/admin/plugins               → Plugin Marketplace
#/admin/audit-logs            → Audit Logs
#/admin/settings              → Platform Settings
#/admin/backups               → Backups Management
#/admin/security              → Security Overview
```

**School Authority Routes:**
```
#/school/overview             → School Dashboard
#/school/profile              → School Profile Management
#/school/students             → Student Directory
#/school/teachers             → Teacher Directory
#/school/attendance           → Attendance Management
#/school/finance              → Finance & Billing
#/school/exams                → Examination & Grading
#/school/announcements        → School Announcements
#/school/notifications        → Notifications Center
#/school/messages             → School Messaging
#/school/reports              → School Reports
#/school/settings             → School Settings
```

**Teacher Routes:**
```
#/role/teacher                → Teacher Dashboard
#/role/teacher/classes        → Classes Management
#/role/teacher/lessons        → Lessons & Curriculum
#/role/teacher/attendance     → Student Attendance
#/role/teacher/notifications  → Notifications
#/role/teacher/messages       → Messages
#/role/teacher/reports        → Reports
#/role/teacher/support        → Support
#/role/teacher/settings       → Profile Settings
```

**Student Routes:**
```
#/role/student                → Student Dashboard
#/role/student/classes        → My Classes
#/role/student/assignments    → Assignments
#/role/student/results        → Academic Results
#/role/student/notifications  → Notifications
#/role/student/messages       → Messages
#/role/student/support        → Support
#/role/student/settings       → Profile Settings
```

### 2.2 Routing Implementation

**File:** `frontend/marketing/src/main.js`
**Function:** `route()` (lines ~4420-4470)

**Routing Logic:**
```javascript
function route() {
  const navigationId = ++routeGeneration;
  const { path: current, params } = parseHash();

  // Super Admin routes
  if (current === 'admin' || current.startsWith('admin/')) {
    if (!requireAuth()) return;
    if (getUserRole() !== 'super_admin' && !getPlatformAdminFlag()) {
      location.hash = '#/school/overview';
      return;
    }
    const section = current === 'admin' ? 'overview' : current.split('/')[1];
    return renderAdminPage(section, navigationId);
  }

  // School Authority routes
  if (current === 'school' || current.startsWith('school/')) {
    if (!requireAuth()) return;
    const section = current === 'school' ? 'overview' : current.split('/')[1];
    return renderSchoolDashboardPage(section, navigationId);
  }

  // Teacher/Student role routes
  if (current.startsWith('role/')) {
    if (!requireAuth()) return;
    const [, role, section] = current.split('/');
    return renderRolePage(role || 'super_admin', section || 'overview', navigationId);
  }
}
```

**Post-Login Redirect Logic:**
```javascript
if (role === 'platform_admin') {
  location.hash = '#/admin/overview';
} else if (role === 'school_authority') {
  location.hash = '#/school/overview';
} else if (role === 'teacher') {
  location.hash = '#/role/teacher';
} else if (role === 'student') {
  location.hash = '#/role/student';
}
```

---

## 3. MODULE AVAILABILITY

### 3.1 School Authority Dashboard Modules

**File:** `frontend/marketing/src/components/sidebar.js`
**Total Modules:** 12 sections

**Navigation Menu Items:**
```javascript
[
  { id: 'overview', icon: '🏠', label: 'Dashboard' },
  { id: 'profile', icon: '👤', label: 'Profile' },
  { id: 'students', icon: '👥', label: 'Students' },
  { id: 'teachers', icon: '🧑‍🏫', label: 'Teachers' },
  { id: 'attendance', icon: '✅', label: 'Attendance' },
  { id: 'finance', icon: '💰', label: 'Finance & Billing' },
  { id: 'exams', icon: '📝', label: 'Examination & Grading' },
  { id: 'announcements', icon: '📣', label: 'Announcements' },
  { id: 'notifications', icon: '🔔', label: 'Notifications' },
  { id: 'messages', icon: '💬', label: 'Messaging' },
  { id: 'reports', icon: '📄', label: 'Reports' },
  { id: 'settings', icon: '⚙️', label: 'Settings' }
]
```

### 3.2 School Dashboard Overview (Overview Section)

**File:** `frontend/marketing/src/pages/school-dashboard.js`
**Components Rendered:**

**Dashboard Summary Cards:**
- Total Students
- Total Teachers
- Total Staff
- Active Classes
- Today's Attendance
- Today's Revenue
- Outstanding Fees
- Recent Activity Count

**Quick Actions:**
- Add Student
- Add Teacher
- Create Announcement
- Send Message
- Create Class
- Generate Report

**Charts & Analytics:**
- Attendance Trend Chart
- Fee Collection Chart
- Monthly Revenue Chart
- Teacher Attendance Chart
- Student Growth Chart

**Content Sections:**
- School Profile (editable fields)
- Recent Activities (event list)
- Upcoming Events (calendar events)
- Recent Announcements (notice board)
- Messages (inbox management)
- Notifications (alert system)
- Reports (analytics exports)
- Support Tickets (help desk)
- Settings (preferences)
- Activity Log (audit trail)
- AI Assistant (if enabled)

### 3.3 Super Admin Dashboard Modules

**File:** `frontend/marketing/src/pages/admin.js`

**Admin Navigation (18 sections):**
```javascript
[
  { id: 'overview', label: 'Dashboard' },
  { id: 'schools', label: 'Schools' },
  { id: 'users', label: 'Users' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'payments', label: 'Payments' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'website-cms', label: 'Website CMS' },
  { id: 'ai-settings', label: 'AI Settings' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'reports', label: 'Reports' },
  { id: 'messages', label: 'Messages' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'support', label: 'Support' },
  { id: 'plugins', label: 'Plugin Marketplace' },
  { id: 'audit-logs', label: 'Audit Logs' },
  { id: 'settings', label: 'Settings' },
  { id: 'backups', label: 'Backups' },
  { id: 'security', label: 'Security' }
]
```

### 3.4 Teacher Dashboard Modules

**Navigation Menu (8 sections):**
- Dashboard
- Classes
- Lessons
- Attendance
- Notifications
- Messages
- Support
- Settings

### 3.5 Student Dashboard Modules

**Navigation Menu (8 sections):**
- Dashboard
- Classes
- Assignments
- Results
- Notifications
- Messages
- Support
- Settings

---

## 4. DATA PERSISTENCE

### 4.1 API Architecture

**Base Endpoint:** `/api/v1`

**Data Flow Pattern:**
```
Frontend Form → API Call → Backend Validation → Database/Fallback → Response → Frontend Storage/UI Update
```

### 4.2 School Data Retrieval APIs

**File:** `frontend/marketing/src/api/school.js`

**Key Functions:**

#### fetchSchoolSummary(token, schoolId)
```javascript
// Returns dashboard summary metrics
GET /api/v1/schools/{schoolId}/summary
// Response: { status: 'ok', summary: {...} }
```
**Used by:**
- `renderSchoolDashboardPage()` - loads summary metrics on page load
- Dashboard components - displays stats cards

**Response Structure:**
```json
{
  "status": "ok",
  "summary": {
    "name": "School Name",
    "studentCount": 150,
    "teacherCount": 15,
    "staffCount": 5,
    "classCount": 6,
    "attendanceSummary": {
      "attendanceToday": "142",
      "presentRatio": 95
    },
    "feesSummary": {
      "collectedToday": "$2,500",
      "outstanding": "$5,000"
    },
    "recentActivities": [],
    "upcomingEvents": []
  }
}
```

#### fetchSchoolDetails(token, schoolId)
```javascript
// Returns complete school data
GET /api/v1/schools/{schoolId}
// Response: { status: 'ok', school: {...} }
```
**Used by:**
- `renderSchoolDashboardPage()` - loads complete school object
- School profile page - displays and allows editing
- Other modules - accesses nested data (students, teachers, etc.)

**Response Structure:**
```json
{
  "status": "ok",
  "school": {
    "id": "school-uuid",
    "schoolId": "globy-school",
    "name": "Globy School",
    "logo": "data-url",
    "email": "head@school.edu",
    "phone": "0201234567",
    "students": [{...}],
    "teachers": [{...}],
    "classes": [{...}],
    "announcements": [{...}],
    "payments": [{...}],
    "attendanceRecords": [{...}],
    "messages": [{...}],
    "reports": [{...}]
  }
}
```

#### updateSchoolDetails(token, schoolId, payload)
```javascript
// Updates school data
PUT /api/v1/schools/{schoolId}
// Body: { field: value, ... }
// Response: { status: 'ok', school: {...} }
```
**Used by:**
- School profile save handlers
- Quick action handlers (add student, add teacher)
- Dashboard modifications

#### fetchAdminDashboardSummary(token)
```javascript
// Returns platform-wide analytics
GET /api/v1/schools/summary
// Response: { status: 'ok', summary: {...} }
```
**Used by:**
- Admin dashboard - displays platform metrics
- Platform analytics

#### fetchAdminSchoolList(token, search)
```javascript
// Lists all schools with optional search
GET /api/v1/schools?search={term}
// Response: { status: 'ok', schools: [...] }
```
**Used by:**
- Admin schools management page
- School directory
- School selection dropdowns

### 4.3 Form Submission Flow

**Example: Add Student Quick Action**
**File:** `frontend/marketing/src/main.js` → `handleQuickAction()`

```javascript
async function handleQuickAction(action) {
  const schoolId = localStorage.getItem('globyedu_schoolId');
  const token = getAccessToken();
  
  if (action === 'add-student') {
    // 1. Fetch current school details
    const schoolDetailsResult = await fetchSchoolDetails(token, schoolId);
    
    // 2. Show form dialog
    const formData = await showAdminForm('Register student', [
      { name: 'fullName', label: 'Student full name', required: true },
      { name: 'profilePhoto', label: 'Student photo', type: 'file' },
      { name: 'className', label: 'Class', type: 'select', options: classOptions }
    ]);
    
    // 3. Create payload
    const payload = buildSchoolEntityPayload('students', {
      fullName: formData.fullName,
      className: formData.className,
      studentId: generateStudentId(),
      status: 'active',
      profilePhoto: formData.profilePhoto
    });
    
    // 4. Submit to backend
    const result = await createSchoolEntity(token, schoolId, 'students', payload);
    
    // 5. Update school summary with activity log
    await appendSchoolCollectionData(
      token, 
      schoolId, 
      'students', 
      payload, 
      'Student registered', 
      `${formData.fullName} added to the school.`
    );
    
    // 6. Reload dashboard
    location.hash = '#/school/students';
  }
}
```

### 4.4 School Entity APIs

**File:** `frontend/marketing/src/api/school.js`

#### createSchoolEntity(token, schoolId, entityType, payload)
```javascript
POST /api/v1/schools/{schoolId}/entities/{entityType}
// entityType: 'students', 'teachers', 'classes', 'announcements', etc.
```

#### updateSchoolEntity(token, schoolId, entityType, entityId, payload)
```javascript
PUT /api/v1/schools/{schoolId}/entities/{entityType}/{entityId}
```

#### deleteSchoolEntity(token, schoolId, entityType, entityId)
```javascript
DELETE /api/v1/schools/{schoolId}/entities/{entityType}/{entityId}
```

#### fetchSchoolEntities(token, schoolId, entityType, query)
```javascript
GET /api/v1/schools/{schoolId}/entities/{entityType}?search={term}&status={status}&page={page}
```

### 4.5 Backend Data Operations

**File:** `backend/modules/school/school.service.js`

**Database Integration:**

**With Prisma (Production):**
- Uses Prisma Client to connect to database
- Models: Tenant, User, UserRole, Role, Permission, Department, Class, Subject, etc.
- Transactions for multi-step operations
- Relationship queries with includes

**Fallback Mode (Development):**
- JSON file stored at `backend/data/schools.json`
- In-memory array operations
- File write on modifications
- No transaction support

**Example: getDashboardSummary(schoolId)**
```javascript
async function getDashboardSummary(schoolId) {
  // Fallback mode
  if (prisma && prisma.__stub) {
    const schools = loadSchoolData(); // Load from JSON
    const school = findSchoolBySchoolId(schools, schoolId);
    return buildDashboardSnapshot(school, school.users || []);
  }
  
  // Prisma mode
  const tenant = await prisma.tenant.findUnique({
    where: { schoolId },
    include: {
      users: true,
      departments: true,
      classes: true,
      academicYears: true,
      announcements: true
    }
  });
  
  // Build summary from tenant data
  return {
    name: tenant.name,
    studentCount: studentUsers.length,
    teacherCount: teacherUsers.length,
    classCount: tenant.classes.length,
    // ... more fields
  };
}
```

### 4.6 Data Caching Strategy

**Frontend Caching:**

**localStorage:**
- Session tokens
- User profile data
- School directory (from admin API)
- Workspace settings

**In-Memory:**
- Dashboard summary (re-fetched on page load)
- Form data (cleared on submit)

**Cache Update Triggers:**
- Manual refresh button
- Page navigation
- Form submission success
- Logout/login

---

## 5. ERROR HANDLING

### 5.1 Frontend Error Handling Patterns

**File:** `frontend/marketing/src/main.js`

#### Try/Catch Pattern

```javascript
// Generic try-catch with user feedback
try {
  const result = await loginAPI(credentials);
  if (!result.ok || result.data?.status !== 'ok') {
    messageSlot.innerHTML = `<div class="rounded-3xl border border-rose-100 bg-rose-50 p-4 text-rose-800">
      ${result.data?.message || 'Unable to sign in. Please check your details.'}
    </div>`;
  } else {
    // Success handling
    saveSession(result.data);
    location.hash = '#/school/overview';
  }
} catch (error) {
  messageSlot.innerHTML = `<div class="rounded-3xl border border-rose-100 bg-rose-50 p-4 text-rose-800">
    Unable to sign in. Try again later.
  </div>`;
}
```

#### API Response Validation

```javascript
// Check both HTTP status and response status field
if (!response.ok || response.data?.status !== 'ok') {
  // Handle error
  const errorMessage = response.data?.message || 'Operation failed';
  showErrorMessage(errorMessage);
  return;
}
// Handle success
```

### 5.2 Validation Error Handling

**File:** `frontend/marketing/src/pages/register-wizard.js`

#### Client-Side Form Validation

```javascript
function validateCurrentStep() {
  clearFieldErrors();
  const elements = Array.from(steps[current].querySelectorAll('[data-required]'));
  
  for (const element of elements) {
    if (!element.value.trim()) {
      setFieldError(element.id, `${label} is required.`);
      return false;
    }
  }
  
  // Email validation
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    setFieldError('email', 'Please enter a valid email.');
    return false;
  }
  
  // Password validation
  const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
  if (!passwordPattern.test(password)) {
    setFieldError('password', 'Password must include uppercase, lowercase, number and symbol.');
    return false;
  }
  
  return true;
}

function setFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  field.classList.add('border-rose-300', 'bg-rose-50');
  const error = document.createElement('div');
  error.className = 'mt-2 text-sm text-rose-600';
  error.textContent = message;
  field.parentNode.appendChild(error);
}
```

### 5.3 API Error Responses

**Backend Error Format:**
```json
{
  "status": "error",
  "message": "Human-readable error message"
}
```

**Common Error Messages:**

| Error | Status | Message |
|-------|--------|---------|
| Missing credentials | 400 | "Missing credentials" |
| Invalid password | 401 | "Invalid credentials" |
| Inactive account | 401 | "User account is not active" |
| Email not verified | 401 | "Email must be verified before signing in." |
| School not found | 400 | "School not found" |
| Teacher name mismatch | 401 | "Invalid credentials" |
| Student name/class mismatch | 401 | "Invalid credentials" |
| Firebase not configured | 401 | "Firebase authentication is not configured." |
| Invalid token | 401 | "Invalid or expired token." |

### 5.4 Session Expiration Handling

**Backend JWT Expiration:**
- Access tokens: 15 minutes (default)
- Refresh tokens: 30 days
- Verified on each request via `authMiddleware`

**Frontend Session Check:**
```javascript
// On every page load
function requireAuth() {
  const token = getAccessToken();
  const expiresAt = Number(localStorage.getItem('globyedu_sessionExpiresAt') || 0);
  
  if (!token || Date.now() > expiresAt) {
    clearAuthenticationState();
    location.hash = '#/login';
    return false;
  }
  return true;
}
```

### 5.5 Offline Error Handling

**File:** `frontend/marketing/src/api/school.js`

**Offline Queue Implementation:**
```javascript
async function queueRequest(method, url, body) {
  if (!isOnline()) {
    const signature = makeOfflineQueueSignature(method, url, body);
    const existing = await findOfflineQueueEntry(signature);
    
    if (existing) {
      return { 
        ok: false, 
        offline: true, 
        queued: true, 
        message: 'A matching request is already queued.' 
      };
    }
    
    await addOfflineQueueEntry({ 
      method, 
      url, 
      body, 
      signature, 
      timestamp: Date.now() 
    });
    
    await scheduleBackgroundSync();
    
    return { 
      ok: false, 
      offline: true, 
      queued: true, 
      message: 'Offline request queued. It will synchronize automatically once online.' 
    };
  }
  return null;
}
```

### 5.6 User Feedback Mechanisms

#### Alert Components
```javascript
// Basic alert helper
export function createAlert(message, type = 'info') {
  const classes = {
    info: 'bg-sky-50 border-sky-100 text-sky-800',
    success: 'bg-emerald-50 border-emerald-100 text-emerald-800',
    warning: 'bg-amber-50 border-amber-100 text-amber-800',
    danger: 'bg-rose-50 border-rose-100 text-rose-800'
  };
  
  return `<div class="rounded-3xl border ${classes[type]} p-4">
    ${message}
  </div>`;
}
```

#### Form Status Messages
- **Success:** Green background (emerald-50) with checkmark
- **Error:** Red background (rose-50) with error icon
- **Warning:** Amber background (amber-50) with caution icon
- **Info:** Blue background (sky-50) with info icon

#### Real-Time Feedback
- Button disabled state during submission
- Loading overlay with progress indicator
- Status messages in message slots
- Toast-style notifications (top of page)

### 5.7 Backend Error Handling

**File:** `backend/modules/auth/auth.controller.js`

**Try-Catch Pattern:**
```javascript
router.post('/login', async (req, res) => {
  try {
    const { schoolId, username, password } = req.body || {};
    
    if (!schoolId || !username || !password) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Missing credentials' 
      });
    }
    
    const result = await authService.login(schoolId, username, password);
    return res.json({ 
      status: 'ok', 
      accessToken: result.accessToken, 
      refreshToken: result.refreshToken, 
      user: { id: result.user.id, email: result.user.email, roles: result.user.roles } 
    });
  } catch (err) {
    return res.status(401).json({ 
      status: 'error', 
      message: err.message 
    });
  }
});
```

**Service Layer Error Handling:**
```javascript
async function login(tenantId, email, password) {
  const user = await validateUserByEmail(tenantId, email, password);
  if (!user) throw new Error('Invalid credentials');
  if (!user.isVerified) throw new Error('Email must be verified before signing in.');
  if (user.status !== 'active') throw new Error('User account is not active');
  
  return createSessionForUser(user);
}
```

---

## 6. SUMMARY TABLE

| Aspect | Super Admin | School Authority | Teacher | Student |
|--------|-------------|------------------|---------|---------|
| **Login Endpoint** | `/api/v1/auth/platform-login` | `/api/v1/auth/school-login` | `/api/v1/auth/school-login` | `/api/v1/auth/school-login` |
| **Required Fields** | Email, Password | School ID, Email, Password | School ID, Teacher ID, Name, Password | School ID, Student ID, Name, Class, Password |
| **Route After Login** | `#/admin/overview` | `#/school/overview` | `#/role/teacher` | `#/role/student` |
| **Module Count** | 18 sections | 12 sections | 8 sections | 8 sections |
| **Data Retrieval** | Platform-wide APIs | School-scoped APIs | Teacher-scoped endpoints | Student-scoped endpoints |
| **Token Storage** | `globyedu_accessToken` | `globyedu_accessToken` | `globyedu_accessToken` | `globyedu_accessToken` |
| **Session Duration** | 7 days (with Remember Me) | 7 days (with Remember Me) | 7 days (with Remember Me) | 7 days (with Remember Me) |
| **Primary API Base** | `/api/v1/schools` | `/api/v1/schools/{schoolId}` | `/api/v1/schools/{schoolId}` | `/api/v1/schools/{schoolId}` |
| **Error Type** | Platform-level errors | School-level errors | Access denied if not teacher | Access denied if not student |

---

## 7. KEY FILES REFERENCE

**Frontend:**
- `frontend/marketing/src/main.js` - Router, auth handlers, renderers
- `frontend/marketing/src/pages/login.js` - Login form UI
- `frontend/marketing/src/pages/admin.js` - Admin dashboard
- `frontend/marketing/src/pages/school-dashboard.js` - School dashboard
- `frontend/marketing/src/api/auth.js` - Auth API wrappers
- `frontend/marketing/src/api/school.js` - School data API wrappers
- `frontend/marketing/src/components/sidebar.js` - Navigation sidebar

**Backend:**
- `backend/modules/auth/auth.controller.js` - Auth route handlers
- `backend/modules/auth/auth.service.js` - Auth business logic
- `backend/modules/auth/middleware/auth.middleware.js` - JWT verification
- `backend/modules/school/school.controller.js` - School routes
- `backend/modules/school/school.service.js` - School business logic
- `backend/routes/auth.js` - Legacy auth routes
- `backend/config/auth.config.js` - JWT secrets, bcrypt config
- `backend/data/schools.json` - Fallback school data

---

## 8. CONCLUSION

The GlobyEdu OS application implements a **multi-role, multi-tenant authentication system** with:

✅ **4 distinct login flows** (Super Admin, School Authority, Teacher, Student)
✅ **Role-based dashboard routing** with 12-18 modules per role
✅ **Comprehensive data persistence** with API-driven architecture
✅ **Robust error handling** with client/server validation
✅ **Session management** with token-based authentication and expiration
✅ **Offline-first queue system** for background synchronization
✅ **Fallback support** for development without Prisma/database

All flows follow RESTful API conventions with consistent error handling and user feedback mechanisms throughout the application stack.
