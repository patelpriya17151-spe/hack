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

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      max_capacity REAL NOT NULL
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
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
      FOREIGN KEY (driver_id) REFERENCES drivers(id)
    )
  `);
});

app.post('/addVehicle', (req, res) => {
  const { name, max_capacity } = req.body;

  if (!name || max_capacity === undefined) {
    return res.status(400).json({ message: 'Error: name and max_capacity are required' });
  }

  db.run(
    'INSERT INTO vehicles (name, max_capacity) VALUES (?, ?)',
    [name, max_capacity],
    function (err) {
      if (err) {
        return res.status(500).json({ message: 'Database error while adding vehicle' });
      }
      res.json({ message: 'Vehicle Added Successfully', id: this.lastID });
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
      res.json({ message: 'Driver Added Successfully', id: this.lastID });
    }
  );
});

app.post('/createTrip', (req, res) => {
  const { vehicle_id, driver_id, cargo_weight } = req.body;

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

      db.run(
        'INSERT INTO trips (vehicle_id, driver_id, cargo_weight) VALUES (?, ?, ?)',
        [vehicle_id, driver_id, cargo_weight],
        function (insertErr) {
          if (insertErr) {
            return res.status(500).json({ message: 'Database error while creating trip' });
          }

          res.json({ message: 'Trip Created Successfully', id: this.lastID });
        }
      );
    });
  });
});

app.listen(PORT, () => {
  console.log(`FleetFlow server running on http://localhost:${PORT}`);
});
