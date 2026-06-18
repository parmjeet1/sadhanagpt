# Tripa Backend Information

This document provides a comprehensive overview of the Tripa RideConnect backend architecture, directory structure, and API schema.

## 1. Technology Stack
The backend is a standalone REST API designed to serve the Tripa mobile application.
- **Runtime:** Node.js
- **Framework:** Express.js (`^4.19.2`)
- **Database:** MySQL (managed via remote Hostinger, interfaced using `mysql2`)
- **Authentication:** JSON Web Tokens (`jsonwebtoken`) and password hashing (`bcryptjs`)
- **Validation:** `express-validator`

## 2. Directory Structure (`backend/src/`)
The source code follows a standard MVC-like pattern:
- **`/config`**: Database connections and environment variables setup (`db.js`).
- **`/controllers`**: Core business logic. Handlers for routes (e.g., handling ride creation, user login).
- **`/middleware`**: Express middlewares (e.g., JWT token verification `requireAuth`).
- **`/migrations`**: Database schema creation scripts (`run.js` creates tables).
- **`/models`**: SQL query wrappers and database interaction layers (`Ride.js`, `User.js`, `Vehicle.js`).
- **`/routes`**: Express route definitions mapping HTTP verbs/paths to controllers.
- **`/seeds`**: Scripts to populate the database with initial/dummy data for testing.
- **`app.js`**: The main entry point that wires up middlewares, routes, and starts the server.

## 3. Database Models
The database consists of three primary entities:
1. **User (`User.js`)**: Stores rider and driver profiles.
   - Includes fields like `id` (UUID), `name`, `mobile`, `password`, `role`, and timestamps.
2. **Ride (`Ride.js`)**: Stores ride publications.
   - Includes details like `from_location`, `to_location`, `travel_date`, `travel_time`, `price`, `price_mode` (fixed/negotiable), `booking_frequency` (today_only, every_day, specific_date, week_days).
3. **Vehicle (`Vehicle.js`)**: Likely tracks driver vehicles (e.g., `vehicle_number`, capacity).

## 4. API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/register`: Registers a new user (rider or driver).
- `POST /api/auth/login`: Authenticates a user and returns a JWT.
- `GET /api/auth/me`: Fetches the authenticated user's profile.

### Rides (`/api/rides`)
- `GET /api/rides`: Lists and searches active rides. Supports pagination and filtering by `fromLocation`, `toLocation`, and `travelDate`.
- `GET /api/rides/locations`: Fetches a list of unique locations currently available in the active rides database (used for autocomplete).
- `GET /api/rides/:id`: Retrieves details for a specific ride.
- `POST /api/rides`: Publishes a new ride (requires Authentication).
- `PUT /api/rides/:id`: Updates an existing ride owned by the user.
- `DELETE /api/rides/:id`: Deletes a ride owned by the user.

### Driver (`/api/driver`)
- `GET /api/driver/profile`: Fetches the driver's profile and ride statistics.
- `GET /api/driver/rides`: Lists rides published specifically by the authenticated driver.
- `GET /api/driver/call-meta/:rideId`: Fetches metadata required when calling a driver.

## 5. Development Scripts
The `package.json` provides standard run scripts:
- `npm run dev`: Starts the server with `nodemon` for hot-reloading.
- `npm run migrate`: Executes the schema definitions to build tables.
- `npm run seed`: Injects sample data.
- `npm start`: Standard production start using Node directly.
