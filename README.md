# FleetFlow

FleetFlow is a hackathon-ready fleet and logistics MVP built with **Node.js, Express, SQLite, and vanilla HTML/CSS/JavaScript**. It helps teams manage vehicles, drivers, and trip creation with essential safety and capacity validation.

## Features

- Express backend with SQLite persistence
- Automatic database setup on server start (`database.db`)
- Vehicle management endpoint: `POST /addVehicle`
- Driver management endpoint: `POST /addDriver`
- Trip management endpoint: `POST /createTrip`
- Validation rules:
  - Blocks over-capacity cargo
  - Blocks expired driver licenses
  - Verifies vehicle and driver existence
- Static frontend pages served from `public/`
- Modern dark glassmorphism UI with responsive layout

## Project Structure

```text
FleetFlow/
├── server.js
├── package.json
├── database.db (auto created by server)
├── public/
│   ├── vehicles.html
│   ├── drivers.html
│   └── trips.html
└── README.md
```

## Installation

```bash
npm install
```

## Run

```bash
npm install
node server.js
```

Then open:

- `http://localhost:3000/vehicles.html`
- `http://localhost:3000/drivers.html`
- `http://localhost:3000/trips.html`

## Validation Logic

When creating a trip (`POST /createTrip`):

1. The server checks if the selected vehicle exists.
   - If not: `Error: Vehicle Not Found!`
2. The server checks if the selected driver exists.
   - If not: `Error: Driver Not Found!`
3. The server compares `cargo_weight` with `vehicle.max_capacity`.
   - If cargo is larger: `Error: Over Capacity!`
4. The server compares today’s date with `driver.license_expiry`.
   - If expired: `Error: License Expired!`
5. If all checks pass:
   - Trip is inserted into the `trips` table
   - Response: `Trip Created Successfully`
