# FleetFlow


FleetFlow is a hackathon-ready fleet and logistics MVP built with **Node.js, Express, SQLite, and vanilla HTML/CSS/JavaScript**. It helps teams manage vehicles, drivers, and trips with practical business validation and cost tracking.


## Features

- Express backend with SQLite persistence
- Automatic database setup on server start (`database.db`)
- Vehicle management endpoint: `POST /addVehicle`
- Driver management endpoint: `POST /addDriver`
- Trip management endpoint: `POST /createTrip`

- Trip completion endpoint: `POST /completeTrip`
- Dashboard endpoint: `GET /dashboardStats`
- Listing endpoints: `GET /vehicles`, `GET /drivers`, `GET /trips`

- Validation rules:
  - Blocks over-capacity cargo
  - Blocks expired driver licenses
  - Verifies vehicle and driver existence

  - Prevents assigning a vehicle already in use
- Status logic:
  - Trip creation sets vehicle status to `In Use`
  - Trip completion sets vehicle status to `Available`
- Cost logic:
  - Stores fuel cost and maintenance cost
  - Auto-calculates operational cost = fuel + maintenance
- Static frontend pages served from `public/`
- Modern dark glassmorphism UI with responsive layout and visible data tables


## Project Structure

```text
FleetFlow/
├── server.js
├── package.json
├── database.db (auto created by server)
├── public/
│   ├── dashboard.html
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


- `http://localhost:3000/dashboard.html`

- `http://localhost:3000/vehicles.html`
- `http://localhost:3000/drivers.html`
- `http://localhost:3000/trips.html`

## Validation Logic

When creating a trip (`POST /createTrip`):

1. The server checks if the selected vehicle exists.
   - If not: `Error: Vehicle Not Found!`
2. The server checks if the selected driver exists.
   - If not: `Error: Driver Not Found!`

3. The server checks if vehicle is already in use.
   - If yes: `Error: Vehicle Already In Use!`
4. The server compares `cargo_weight` with `vehicle.max_capacity`.
   - If cargo is larger: `Error: Over Capacity!`
5. The server compares today’s date with `driver.license_expiry`.
   - If expired: `Error: License Expired!`
6. If all checks pass:
   - Trip is inserted into the `trips` table
   - Vehicle status becomes `In Use`
   - Operational cost is calculated and stored
   - Response: `Trip Created Successfully`

## Future Scope

- GPS integration
- AI-based route optimization
- Predictive maintenance alerts

