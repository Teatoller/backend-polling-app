# Backend Changes Summary

## Overview
The backend has been updated to work with the new registration form that includes detailed location fields with IDs and names for counties, sub-counties, and wards.

## Files Modified

### 1. Database Migration (`src/migrations/migrate.js`)
- ✅ Updated `users` table schema with new location fields
- ✅ Updated `candidates` table schema with location fields
- ✅ Updated `votes` table schema with new location fields
- ✅ Added password reset fields to users table

### 2. Authentication Routes (`src/routes/auth.js`)
- ✅ Updated registration endpoint to accept new location fields:
  - `countyId`, `countyName`
  - `subCountyId`, `subCountyName`
  - `wardId`, `wardName`
  - `pollingStation`
- ✅ Updated login endpoint to return new location fields
- ✅ All verification endpoints remain compatible

### 3. Polls Routes (`src/routes/polls.js`)
- ✅ Updated vote submission to use new location fields from users
- ✅ Vote records now store detailed location information

### 4. Admin Routes (`src/routes/admin.js`)
- ✅ Updated poll creation to accept location fields for candidates
- ✅ Updated poll editing to handle candidate location fields
- ✅ Updated user listing to show new location fields
- ✅ Updated user detail view with new location fields
- ✅ Updated user editing to support new location fields

### 5. Results Routes (`src/routes/results.js`)
- ✅ Updated location breakdown queries to use new field names

### 6. Validation Middleware (`src/middleware/validation.js`)
- ✅ Updated registration validation for new fields
- ✅ Updated poll creation validation to accept candidate location fields

### 7. Migration Script (`src/migrations/update_location_fields.js`)
- ✅ Created automated migration script for existing databases
- ✅ Safely adds new columns
- ✅ Migrates existing data
- ✅ Preserves old columns for safety

## New Features

### Location Tracking
- Candidates can now have location information (county, sub-county, ward, polling station)
- Votes are tracked with detailed location breakdown
- Users are identified by specific wards and polling stations

### Better Data Integrity
- Location IDs allow for proper foreign key relationships in the future
- Location names provide human-readable information
- Dual storage (ID + Name) ensures data consistency

## API Changes

### Registration Endpoint
**Endpoint:** `POST /api/auth/register`

**New Request Format:**
```json
{
  "email": "user@example.com",
  "phone": "+254712345678",
  "password": "securePassword123",
  "confirmPassword": "securePassword123",
  "countyId": 47,
  "countyName": "Nairobi",
  "subCountyId": 123,
  "subCountyName": "Westlands",
  "wardId": 456,
  "wardName": "Parklands",
  "pollingStation": "Central Primary School"
}
```

### Login Response
**Endpoint:** `POST /api/auth/login`

**New Response Format:**
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "countyId": 47,
    "countyName": "Nairobi",
    "subCountyId": 123,
    "subCountyName": "Westlands",
    "wardId": 456,
    "wardName": "Parklands",
    "pollingStation": "Central Primary School",
    "isEmailVerified": true
  },
  "token": "jwt_token_here"
}
```

### Poll Creation with Candidates
**Endpoint:** `POST /api/admin/polls`

**New Request Format:**
```json
{
  "officeName": "Governor",
  "description": "County Governor Election 2024",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-12-31T23:59:59Z",
  "candidates": [
    {
      "name": "John Doe",
      "party": "Democratic Party",
      "photoUrl": "https://example.com/photo.jpg",
      "description": "Experienced leader with vision",
      "countyId": 47,
      "countyName": "Nairobi",
      "subCountyId": 123,
      "subCountyName": "Westlands",
      "wardId": 456,
      "wardName": "Parklands",
      "pollingStation": "Central Primary School"
    }
  ]
}
```

Note: All location fields for candidates are optional.

## Admin RBAC

### Roles
- `superadmin`: full access; can manage admins and all resources.
- `admin`: manage polls, users, surveys; view analytics; export data.
- `editor`: manage polls and surveys; view analytics; read-only for users/polls.
- `viewer`: read-only for polls, users, analytics.

Roles and capabilities are defined in [src/middleware/authorization.js](src/middleware/authorization.js).

### Admin Management Endpoints
- `POST /api/admin/admins` (superadmin): create admin `{ email, password, role }`.
- `GET /api/admin/admins` (superadmin): list admins.
- `PUT /api/admin/admins/:id` (superadmin): update `email`, `password`, or `role`.
- `DELETE /api/admin/admins/:id` (superadmin): delete admin (cannot delete self).

### Capability-Protected Endpoints
- Polls: create/toggle require `managePolls`; list requires `viewPolls`.
- Users: list/detail require `viewUsers`; update/delete/bulk delete require `manageUsers`.
- Surveys: create/update/toggle/delete require `manageSurveys`.
- Analytics/Statistics: require `viewAnalytics`.
- Export: requires `exportData`.

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  national_id VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  county_id INTEGER,
  county_name VARCHAR(100) NOT NULL,
  sub_county_id INTEGER,
  sub_county_name VARCHAR(100) NOT NULL,
  ward_id INTEGER,
  ward_name VARCHAR(100) NOT NULL,
  polling_station VARCHAR(100) NOT NULL,
  is_email_verified BOOLEAN DEFAULT FALSE,
  is_phone_verified BOOLEAN DEFAULT FALSE,
  email_verification_token VARCHAR(255),
  phone_verification_code VARCHAR(6),
  phone_verification_expires TIMESTAMP,
  password_reset_token VARCHAR(255),
  password_reset_expires TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Candidates Table
```sql
CREATE TABLE candidates (
  id SERIAL PRIMARY KEY,
  poll_id INTEGER REFERENCES polls(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  party VARCHAR(255) NOT NULL,
  photo_url VARCHAR(500),
  description TEXT,
  county_id INTEGER,
  county_name VARCHAR(100),
  sub_county_id INTEGER,
  sub_county_name VARCHAR(100),
  ward_id INTEGER,
  ward_name VARCHAR(100),
  polling_station VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Votes Table
```sql
CREATE TABLE votes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  poll_id INTEGER REFERENCES polls(id) ON DELETE CASCADE,
  candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
  polling_station VARCHAR(100) NOT NULL,
  county_id INTEGER,
  county_name VARCHAR(100) NOT NULL,
  sub_county_id INTEGER,
  sub_county_name VARCHAR(100) NOT NULL,
  ward_id INTEGER,
  ward_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, poll_id)
);
```

## Migration Instructions

### For Existing Database
```bash
# Run migration script
cd backend-polling-app
node src/migrations/update_location_fields.js
```

### For New Database
```bash
# Drop and recreate database
psql -U your_username
DROP DATABASE polling_db;
CREATE DATABASE polling_db;
\q

# Run fresh migration
cd backend-polling-app
node src/migrations/migrate.js
```

## Testing Checklist

- [ ] User registration with new fields works
- [ ] User login returns correct data structure
- [ ] Votes are recorded with location details
- [ ] Poll creation with candidate locations works
- [ ] Poll editing preserves candidate locations
- [ ] Admin user management displays new fields
- [ ] Results show correct location breakdown
- [ ] Existing users can still log in (if migrating)

## Notes

- Location IDs are optional and can be null
- Location names are required for users and votes
- Candidate location fields are all optional
- The system maintains backward compatibility during migration
- Old field names (county, division) are preserved during migration for safety

## Support

If you encounter issues:
1. Check database connection in `.env`
2. Verify user has ALTER TABLE permissions
3. Check backend logs for detailed error messages
4. Refer to MIGRATION_GUIDE.md for detailed troubleshooting
