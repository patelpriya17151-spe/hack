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
      fuel_cost REAL DEFAULT 0,
      maintenance_cost REAL DEFAULT 0,
      operational_cost REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'In Progress',
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
      FOREIGN KEY (driver_id) REFERENCES drivers(id)
    )
  `);

});

app.post('/addVehicle', (req, res) => {
  const { name, max_capacity } = req.body;

  if (!name || max_capacity === undefined) {
    return res.status(400).json({ message: 'name and max_capacity required' });
  }

  db.run(
    `INSERT INTO vehicles (name, max_capacity, status) VALUES (?, ?, ?)`,
    [name, max_capacity, 'Available'],
    function (err) {
      if (err) return res.status(500).json({ message: 'Database error' });

      res.json({ message: 'Vehicle Added', id: this.lastID });
    }
  );
});

app.post('/addDriver', (req, res) => {
  const { name, license_expiry } = req.body;

  if (!name || !license_expiry) {
    return res.status(400).json({ message: 'name and license_expiry required' });
  }

  db.run(
    `INSERT INTO drivers (name, license_expiry) VALUES (?, ?)`,
    [name, license_expiry],
    function (err) {
      if (err) return res.status(500).json({ message: 'Database error' });

      res.json({ message: 'Driver Added', id: this.lastID });
    }
  );
});

app.post('/createTrip', (req, res) => {
  const { vehicle_id, driver_id, cargo_weight } = req.body;

  if (!vehicle_id || !driver_id || !cargo_weight) {
    return res.status(400).json({ message: 'vehicle_id, driver_id, cargo_weight required' });
  }

  db.get(`SELECT * FROM vehicles WHERE id = ?`, [vehicle_id], (err, vehicle) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
    if (vehicle.status === 'In Use') return res.status(400).json({ message: 'Vehicle already in use' });

    db.get(`SELECT * FROM drivers WHERE id = ?`, [driver_id], (err2, driver) => {
      if (err2) return res.status(500).json({ message: 'Database error' });
      if (!driver) return res.status(404).json({ message: 'Driver not found' });

      db.run(
        `INSERT INTO trips (vehicle_id, driver_id, cargo_weight, status)
         VALUES (?, ?, ?, ?)`,
        [vehicle_id, driver_id, cargo_weight, 'In Progress'],
        function (err3) {
          if (err3) return res.status(500).json({ message: 'Database error' });

          db.run(
            `UPDATE vehicles SET status = ? WHERE id = ?`,
            ['In Use', vehicle_id]
          );

          res.json({ message: 'Trip Created', id: this.lastID });
        }
      );
    });
  });
});

app.post('/completeTrip', (req, res) => {
  const { trip_id } = req.body;

  if (!trip_id) {
    return res.status(400).json({ message: 'trip_id required' });
  }

  db.get(`SELECT * FROM trips WHERE id = ?`, [trip_id], (err, trip) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    db.run(`UPDATE trips SET status = ? WHERE id = ?`, ['Completed', trip_id]);
    db.run(`UPDATE vehicles SET status = ? WHERE id = ?`, ['Available', trip.vehicle_id]);

    res.json({ message: 'Trip Completed' });
  });
});

app.get('/vehicles', (req, res) => {
  db.all(`SELECT * FROM vehicles ORDER BY id DESC`, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json(rows);
  });
});

app.get('/drivers', (req, res) => {
  db.all(`SELECT * FROM drivers ORDER BY id DESC`, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json(rows);
  });
});

app.get('/trips', (req, res) => {
  db.all(`
    SELECT t.*, v.name AS vehicle_name, d.name AS driver_name
    FROM trips t
    LEFT JOIN vehicles v ON v.id = t.vehicle_id
    LEFT JOIN drivers d ON d.id = t.driver_id
    ORDER BY t.id DESC
  `, (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json(rows);
  });
});

app.get('/dashboardStats', (req, res) => {
  db.get(`
    SELECT
      (SELECT COUNT(*) FROM vehicles) AS totalVehicles,
      (SELECT COUNT(*) FROM drivers) AS totalDrivers,
      (SELECT COUNT(*) FROM trips) AS totalTrips,
      (SELECT COUNT(*) FROM vehicles WHERE status = 'In Use') AS vehiclesInUse,
      (SELECT COUNT(*) FROM vehicles WHERE status = 'Available') AS vehiclesAvailable
  `, (err, row) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    res.json(row);
  });
});

app.listen(PORT, () => {
  console.log(`FleetFlow server running on http://localhost:${PORT}`);
});
