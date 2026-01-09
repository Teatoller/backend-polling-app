# Location Fields Migration Guide

## Overview
This migration updates the database schema to use more detailed location information with IDs and names for counties, sub-counties, and wards instead of the previous simple county/division fields.

## Changes Made

### Database Schema Updates

#### Users Table
**Old Fields:**
- `county` (VARCHAR)
- `division` (VARCHAR)
- `polling_station` (VARCHAR)

**New Fields:**
- `county_id` (INTEGER)
- `county_name` (VARCHAR)
- `sub_county_id` (INTEGER)
- `sub_county_name` (VARCHAR)
- `ward_id` (INTEGER)
- `ward_name` (VARCHAR)
- `polling_station` (VARCHAR) - kept as is
- `password_reset_token` (VARCHAR) - added
- `password_reset_expires` (TIMESTAMP) - added

#### Candidates Table
**Added Fields:**
- `county_id` (INTEGER)
- `county_name` (VARCHAR)
- `sub_county_id` (INTEGER)
- `sub_county_name` (VARCHAR)
- `ward_id` (INTEGER)
- `ward_name` (VARCHAR)
- `polling_station` (VARCHAR)

#### Votes Table
**Old Fields:**
- `county` (VARCHAR)
- `division` (VARCHAR)

**New Fields:**
- `county_id` (INTEGER)
- `county_name` (VARCHAR)
- `sub_county_id` (INTEGER)
- `sub_county_name` (VARCHAR)
- `ward_id` (INTEGER)
- `ward_name` (VARCHAR)

### Backend API Updates

#### Routes Updated:
1. **auth.js**
   - Registration endpoint now accepts new location fields
   - Login endpoint returns new location fields
   
2. **polls.js**
   - Vote submission now stores new location fields from user
   
3. **admin.js**
   - Poll creation now accepts location fields for candidates
   - Poll update now handles location fields for candidates
   - User management endpoints updated to use new fields
   
4. **results.js**
   - Location breakdown queries updated to use new field names

5. **validation.js**
   - Registration validation updated for new fields
   - Poll creation validation updated for candidate location fields

## Migration Steps

### For Existing Database

1. **Run the migration script:**
   ```bash
   cd backend-polling-app
   node src/migrations/update_location_fields.js
   ```

   This script will:
   - Add new columns to existing tables
   - Migrate existing data from old fields to new fields
   - Set NOT NULL constraints on new fields
   - Preserve old columns (can be dropped manually later)

### For New Database

1. **Drop existing database and recreate:**
   ```bash
   # Connect to PostgreSQL
   psql -U your_username

   # Drop and recreate database
   DROP DATABASE polling_db;
   CREATE DATABASE polling_db;
   ```

2. **Run the updated migration:**
   ```bash
   cd backend-polling-app
   node src/migrations/migrate.js
   ```

## Frontend Changes Required

The frontend Register component already uses the new fields:
- `countyId`, `countyName`
- `subCountyId`, `subCountyName`
- `wardId`, `wardName`
- `pollingStation`

Make sure to update any other components that:
- Display user location information
- Create or edit candidates
- Display voting results by location

### Example Frontend Updates:

**Old:**
```typescript
user.county
user.division
```

**New:**
```typescript
user.countyName
user.subCountyName
user.wardName
```

## API Request/Response Changes

### Registration Request
**Old:**
```json
{
  "nationalId": "12345678",
  "email": "user@example.com",
  "password": "password123",
  "county": "Nairobi",
  "division": "Westlands",
  "pollingStation": "Station A"
}
```

**New:**
```json
{
  "nationalId": "12345678",
  "email": "user@example.com",
  "password": "password123",
  "countyId": 1,
  "countyName": "Nairobi",
  "subCountyId": 10,
  "subCountyName": "Westlands",
  "wardId": 100,
  "wardName": "Parklands",
  "pollingStation": "Station A"
}
```

### Login Response
**Old:**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "county": "Nairobi",
    "division": "Westlands",
    "pollingStation": "Station A"
  }
}
```

**New:**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "countyId": 1,
    "countyName": "Nairobi",
    "subCountyId": 10,
    "subCountyName": "Westlands",
    "wardId": 100,
    "wardName": "Parklands",
    "pollingStation": "Station A"
  }
}
```

### Poll Creation with Candidates
**New candidate structure:**
```json
{
  "officeName": "President",
  "description": "Presidential Election 2024",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "candidates": [
    {
      "name": "John Doe",
      "party": "Party A",
      "photoUrl": "https://...",
      "description": "Candidate bio",
      "countyId": 1,
      "countyName": "Nairobi",
      "subCountyId": 10,
      "subCountyName": "Westlands",
      "wardId": 100,
      "wardName": "Parklands",
      "pollingStation": "Station A"
    }
  ]
}
```

Note: Location fields for candidates are optional and can be null.

## Testing

After migration, test the following:

1. ✅ User registration with new location fields
2. ✅ User login returns correct location data
3. ✅ Vote submission stores correct location data
4. ✅ Poll creation with candidate location fields
5. ✅ Poll updates preserve candidate location fields
6. ✅ Results display shows correct location breakdown
7. ✅ User management in admin panel displays new fields
8. ✅ User updates in admin panel work with new fields

## Rollback

If you need to rollback:

1. The old columns (`county`, `division`) are preserved during migration
2. Uncomment the DROP COLUMN statements in the migration script and run again to clean up old columns
3. Or restore from database backup

## Notes

- Location IDs (`countyId`, `subCountyId`, `wardId`) are optional and can be null
- Location names are required for users and votes
- Candidate location fields are all optional
- The migration preserves old data by copying values to new fields
- Old columns are kept for safety but can be dropped after verification

## Support

If you encounter any issues during migration, check:
1. Database connection settings
2. User permissions for ALTER TABLE operations
3. Data consistency in existing tables
4. Backend logs for any errors
