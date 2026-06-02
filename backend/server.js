const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config({ path: './config.env' });

const funcionariosRoutes = require('./routes/funcionarios');
const warehouseRoutes = require('./routes/warehouse');
const locationsRoutes = require('./routes/locations');
const locationProductRoutes = require('./routes/locationProduct');
const movementRoutes = require('./routes/movement');
const customersRoutes = require('./routes/customers');
const situationsRoutes = require('./routes/situations');
const pickingRoutes = require('./routes/picking');
const funcionarioServiceDB = require('./services/funcionarioServiceDB');
const { initDatabase } = require('./scripts/init-database');

const app = express();
const PORT = process.env.PORT || 3000;

// Security and logging middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));

// Allow larger JSON bodies to support base64 photos
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static('public'));

// Route for home page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// API Routes
app.use('/api/funcionarios', funcionariosRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/location-product', locationProductRoutes);
app.use('/api/movement', movementRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/situations', situationsRoutes);
app.use('/api/picking', pickingRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Server running correctly',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Middleware for routes not found
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    message: `The route ${req.originalUrl} does not exist`
  });
});

// Initialize server
async function startServer() {
  try {
    // Initialize database
    console.log('🔄 Initializing database...');
    await initDatabase();
    console.log('✅ Database initialized successfully');
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📋 User registration API available at http://localhost:${PORT}/api/funcionarios`);
      console.log(`📦 Warehouse API available at http://localhost:${PORT}/api/warehouse`);
      console.log(`📍 Locations API available at http://localhost:${PORT}/api/locations`);
      console.log(`🏥 Health check available at http://localhost:${PORT}/health`);
      console.log(`💾 Data saved in PostgreSQL database`);
    });
  } catch (error) {
    console.error('❌ Error initializing server:', error.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;

