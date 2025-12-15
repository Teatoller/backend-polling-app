# Polling App Backend

A secure, scalable Express.js backend for a polling application with real-time vote updates, email/SMS verification, and admin management features.

## Description

This is a comprehensive backend service for a polling application built with TypeScript and Express.js. It provides user authentication, poll management, voting functionality, and real-time updates via Socket.io. The application includes features like email verification, SMS notifications via Twilio, and role-based admin access.

### Key Features

- **User Authentication**: Registration with email and phone verification
- **Poll Management**: Create, manage, and track polls with multiple candidates
- **Voting System**: Secure voting with duplicate prevention and geographic tracking
- **Real-time Updates**: Socket.io integration for live vote count updates
- **Admin Dashboard**: Manage polls and view comprehensive statistics
- **SMS Notifications**: Twilio integration for verification codes and login alerts
- **Email Verification**: Nodemailer integration for email verification
- **Security**: JWT authentication, rate limiting, helmet protection, bcrypt password hashing
- **Database**: PostgreSQL with connection pooling

## Dependencies

### Production Dependencies

- **express** (^5.1.0) - Web framework
- **pg** (^8.16.3) - PostgreSQL database client
- **jsonwebtoken** (^9.0.2) - JWT authentication
- **bcryptjs** (^3.0.3) - Password hashing
- **dotenv** (^17.2.3) - Environment variables
- **cors** (^2.8.5) - Cross-origin requests
- **helmet** (^8.1.0) - Security headers
- **express-rate-limit** (^8.2.1) - Rate limiting
- **socket.io** (^4.8.1) - Real-time communication
- **nodemailer** (^7.0.11) - Email service
- **twilio** (^5.10.6) - SMS service
- **joi** (^18.0.2) - Data validation
- **express-validator** (^7.3.1) - Request validation

### Dev Dependencies

- **@types/node** (^24.10.1)
- **@types/express** (^5.0.5)
- **@types/pg** (^8.15.6)
- **@types/jsonwebtoken** (^9.0.10)
- **typescript** - TypeScript support
- **nodemon** (^3.1.11) - Development auto-restart

## Installation & Setup

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+
- Git

### Clone the Repository

```bash
git clone https://github.com/yourusername/backend-polling-app.git
cd backend-polling-app
```

### Install Dependencies

```bash
npm install
```

### Environment Configuration

1. Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

2. Configure the following variables in `.env`:

```env
# Server
NODE_ENV=development
PORT=5000
HOST=0.0.0.0

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=polling_app
DB_USER=postgres
DB_PASSWORD=your_db_password

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# Email (Optional)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Twilio SMS (Optional)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=your-twilio-number

# Frontend
FRONTEND_URL=http://localhost:5173
```

### Setup Database

1. Create PostgreSQL database:

```bash
createdb polling_app
```

2. Run migrations:

```bash
npm run migrate
```

This will create all necessary tables and a default admin user:
- **Email**: `admin@pollingapp.com`
- **Password**: `newadmin@123`

## Running the Application

### Development Mode

```bash
npm run dev
```

The server will start on `http://localhost:5000`

### Production Build

```bash
npm run build
npm start
```

### Available Scripts

- `npm run dev` - Start development server with auto-reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server
- `npm run migrate` - Run database migrations

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/verify-email/:token` - Verify email
- `POST /api/auth/verify-phone` - Verify phone number

### Polls
- `GET /api/polls/active` - Get active polls
- `POST /api/polls/vote` - Submit a vote
- `GET /api/polls/has-voted/:pollId` - Check if user voted

### Results
- `GET /api/results/poll/:pollId` - Get poll results
- `GET /api/results/polling-station/:pollingStation` - Get station results
- `GET /api/results/statistics` - Get overall statistics

### Admin
- `POST /api/admin/login` - Admin login
- `POST /api/admin/polls` - Create poll
- `GET /api/admin/polls` - Get all polls with results
- `PATCH /api/admin/polls/:id/toggle` - Toggle poll status

### Health Check
- `GET /api/health` - Server health status
- `GET /api/health/db` - Database health status

## Project Structure

```
src/
├── config/
│   ├── database.js      # Database configuration and pool
│   └── environment.js   # Environment variables
├── middleware/
│   ├── auth.js          # JWT authentication
│   └── validation.js    # Request validation
├── migrations/
│   └── migrate.js       # Database migrations
├── routes/
│   ├── admin.js         # Admin routes
│   ├── auth.js          # Authentication routes
│   ├── polls.js         # Poll routes
│   └── results.js       # Results routes
├── services/
│   ├── emailService.js  # Email functionality
│   ├── smsService.js    # SMS functionality
│   └── socketService.js # WebSocket functionality
├── types/
│   ├── index.js         # TypeScript interfaces
│   └── twilio.js        # Twilio types
└── server.js            # Main server file
```

## License

MIT

## Support

For issues or questions, please open an issue on the repository.