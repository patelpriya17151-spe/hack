const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
    return;
  }
  console.log('Connected to SQLite database.');
});


function ensureColumn(table, column, definition) {
  db.all(`PRAGMA table_info(${table})`, (err, columns) => {
    if (err) {
      console.error(`Could not inspect ${table}:`, err.message);
      return;
    }
    const exists = columns.some((item) => item.name === column);
    if (!exists) {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  });
}


db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,

      max_capacity REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Available'

    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      license_expiry TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      driver_id INTEGER NOT NULL,
      cargo_weight REAL NOT NULL,

      fuel_cost REAL NOT NULL DEFAULT 0,
      maintenance_cost REAL NOT NULL DEFAULT 0,
      operational_cost REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'In Progress',
in
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
      FOREIGN KEY (driver_id) REFERENCES drivers(id)
    )
  `);

  ensureColumn('vehicles', 'status', "TEXT NOT NULL DEFAULT 'Available'");
  ensureColumn('trips', 'fuel_cost', 'REAL NOT NULL DEFAULT 0');
  ensureColumn('trips', 'maintenance_cost', 'REAL NOT NULL DEFAULT 0');
  ensureColumn('trips', 'operational_cost', 'REAL NOT NULL DEFAULT 0');
  ensureColumn('trips', 'status', "TEXT NOT NULL DEFAULT 'In Progress'");

});

app.post('/addVehicle', (req, res) => {
  const { name, max_capacity } = req.body;

  if (!name || max_capacity === undefined) {
    return res.status(400).json({ message: 'Error: name and max_capacity are required' });
  }

  db.run(

    'INSERT INTO vehicles (name, max_capacity, status) VALUES (?, ?, ?)',
    [name, max_capacity, 'Available'],

    function (err) {
      if (err) {
        return res.status(500).json({ message: 'Database error while adding vehicle' });
      }

      return res.json({ message: 'Vehicle Added Successfully', id: this.lastID });

    }
  );
});

app.post('/addDriver', (req, res) => {
  const { name, license_expiry } = req.body;

  if (!name || !license_expiry) {
    return res.status(400).json({ message: 'Error: name and license_expiry are required' });
  }

  db.run(
    'INSERT INTO drivers (name, license_expiry) VALUES (?, ?)',
    [name, license_expiry],
    function (err) {
      if (err) {
        return res.status(500).json({ message: 'Database error while adding driver' });
      }

      return res.json({ message: 'Driver Added Successfully', id: this.lastID });

    }
  );
});

app.post('/createTrip', (req, res) => {

  const { vehicle_id, driver_id, cargo_weight, fuel_cost = 0, maintenance_cost = 0 } = req.body;


  if (vehicle_id === undefined || driver_id === undefined || cargo_weight === undefined) {
    return res.status(400).json({ message: 'Error: vehicle_id, driver_id, and cargo_weight are required' });
  }

  db.get('SELECT * FROM vehicles WHERE id = ?', [vehicle_id], (vehicleErr, vehicle) => {
    if (vehicleErr) {
      return res.status(500).json({ message: 'Database error while checking vehicle' });
    }

    if (!vehicle) {
      return res.status(404).json({ message: 'Error: Vehicle Not Found!' });
    }
    if (vehicle.status === 'In Use') {
      return res.status(400).json({ message: 'Error: Vehicle Already In Use!' });
    }


    db.get('SELECT * FROM drivers WHERE id = ?', [driver_id], (driverErr, driver) => {
      if (driverErr) {
        return res.status(500).json({ message: 'Database error while checking driver' });
      }

      if (!driver) {
        return res.status(404).json({ message: 'Error: Driver Not Found!' });
      }

      if (Number(cargo_weight) > Number(vehicle.max_capacity)) {
        return res.status(400).json({ message: 'Error: Over Capacity!' });
      }

      const today = new Date();
      const expiryDate = new Date(driver.license_expiry);
      today.setHours(0, 0, 0, 0);
      expiryDate.setHours(0, 0, 0, 0);

      if (today > expiryDate) {
        return res.status(400).json({ message: 'Error: License Expired!' });
      }

      const operationalCost = Number(fuel_cost) + Number(maintenance_cost);

      db.run(
        `INSERT INTO trips
         (vehicle_id, driver_id, cargo_weight, fuel_cost, maintenance_cost, operational_cost, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [vehicle_id, driver_id, cargo_weight, fuel_cost, maintenance_cost, operationalCost, 'In Progress'],

        function (insertErr) {
          if (insertErr) {
            return res.status(500).json({ message: 'Database error while creating trip' });
          }

          db.run('UPDATE vehicles SET status = ? WHERE id = ?', ['In Use', vehicle_id], (updateErr) => {
            if (updateErr) {
              return res.status(500).json({ message: 'Trip created but failed to update vehicle status' });
            }
            return res.json({ message: 'Trip Created Successfully', id: this.lastID, operational_cost: operationalCost });
          });
        }
      );
    });
  });
});

app.post('/completeTrip', (req, res) => {
  const { trip_id } = req.body;
  if (trip_id === undefined) {
    return res.status(400).json({ message: 'Error: trip_id is required' });
  }

  db.get('SELECT * FROM trips WHERE id = ?', [trip_id], (tripErr, trip) => {
    if (tripErr) {
      return res.status(500).json({ message: 'Database error while checking trip' });
    }
    if (!trip) {
      return res.status(404).json({ message: 'Error: Trip Not Found!' });
    }
    if (trip.status === 'Completed') {
      return res.status(400).json({ message: 'Error: Trip Already Completed!' });
    }

    db.run('UPDATE trips SET status = ? WHERE id = ?', ['Completed', trip_id], (updateTripErr) => {
      if (updateTripErr) {
        return res.status(500).json({ message: 'Database error while updating trip status' });
      }
      db.run('UPDATE vehicles SET status = ? WHERE id = ?', ['Available', trip.vehicle_id], (updateVehicleErr) => {
        if (updateVehicleErr) {
          return res.status(500).json({ message: 'Trip completed but failed to update vehicle status' });
        }
        return res.json({ message: 'Trip Completed Successfully' });
      });
    });
  });
});

app.get('/vehicles', (_req, res) => {
  db.all('SELECT id, name, max_capacity, status FROM vehicles ORDER BY id DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error while loading vehicles' });
    }
    return res.json(rows);
  });
});

app.get('/drivers', (_req, res) => {
  db.all('SELECT id, name, license_expiry FROM drivers ORDER BY id DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ message: 'Database error while loading drivers' });
    }
    return res.json(rows);
  });
});

app.get('/trips', (_req, res) => {
  db.all(
    `SELECT t.id, t.vehicle_id, t.driver_id, t.cargo_weight, t.fuel_cost, t.maintenance_cost, t.operational_cost, t.status,
            v.name AS vehicle_name, d.name AS driver_name
     FROM trips t
     LEFT JOIN vehicles v ON v.id = t.vehicle_id
     LEFT JOIN drivers d ON d.id = t.driver_id
     ORDER BY t.id DESC`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ message: 'Database error while loading trips' });
      }
      return res.json(rows);
    }
  );
});

app.get('/dashboardStats', (_req, res) => {
  db.get(
    `SELECT
      (SELECT COUNT(*) FROM vehicles) AS totalVehicles,
      (SELECT COUNT(*) FROM drivers) AS totalDrivers,
      (SELECT COUNT(*) FROM trips) AS totalTrips,
      (SELECT COUNT(*) FROM vehicles WHERE status = 'In Use') AS vehiclesInUse,
      (SELECT COUNT(*) FROM vehicles WHERE status = 'Available') AS vehiclesAvailable`,
    (err, row) => {
      if (err) {
        return res.status(500).json({ message: 'Database error while loading dashboard stats' });
      }
      return res.json(row);
    }
  );
});


app.listen(PORT, () => {
  console.log(`FleetFlow server running on http://localhost:${PORT}`);
});
