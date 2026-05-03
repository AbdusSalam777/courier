const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const app = express();

// Ensure upload directories exist
const uploadDirs = [
  'uploads',
  'uploads/bulk',
  'uploads/labels',
  'uploads/receipts'
];

uploadDirs.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use('/uploads', express.static('uploads'));
app.use('/uploads/receipts', express.static('uploads/receipts'));
app.use('/uploads/labels', express.static('uploads/labels'));
app.use('/uploads/bulk', express.static('uploads/bulk'));

// Basic Route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Courier Management System API' });
});

// Import Routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const branchRoutes = require('./routes/branch.routes');
const shipmentRoutes = require('./routes/shipment.routes');
const warehouseRoutes = require('./routes/warehouse.routes');
const loadingRoutes = require('./routes/loading.routes');
const runsheetRoutes = require('./routes/runsheet.routes');
const financialRoutes = require('./routes/financial.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const tariffRoutes = require('./routes/tariff.routes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/loading-sheets', loadingRoutes);
app.use('/api/runsheets', runsheetRoutes);
app.use('/api/financials', financialRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/tariffs', tariffRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error'
    }
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
