const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config({ path: './config.env' });

const funcionariosRoutes = require('./routes/funcionarios');
const warehouseRoutes = require('./routes/warehouse');
const locationsRoutes = require('./routes/locations');
const locationProductRoutes = require('./routes/locationProduct');
const movementRoutes = require('./routes/movement');
const customersRoutes = require('./routes/customers');
const systemApplicationsRoutes = require('./routes/systemApplications');
const userApplicationsRoutes = require('./routes/userApplications');
const situationsRoutes = require('./routes/situations');
const pickingRoutes = require('./routes/picking');
const warehouseMapRoutes = require('./routes/warehouseMap');
const authRoutes = require('./routes/auth');
const companiesRoutes = require('./routes/companies');
const churchServiceOrderRoutes = require('./routes/churchServiceOrder');
const systemDocumentationRoutes = require('./routes/systemDocumentation');
const { isAuthenticated, protectPages, requireAuth } = require('./middleware/auth');
const funcionarioServiceDB = require('./services/funcionarioServiceDB');
const { initDatabase } = require('./scripts/init-database');

const app = express();
const PORT = process.env.PORT || 3000;

// Security and logging middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'img-src': ["'self'", 'data:', 'blob:']
    }
  }
}));
app.use(cors());
app.use(morgan('combined'));

// Allow larger JSON bodies to support base64 photos
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check route (public)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Server running correctly',
    timestamp: new Date().toISOString()
  });
});

// Home page: login or warehouse
app.get('/', (req, res) => {
  if (isAuthenticated(req)) {
    res.sendFile(path.join(__dirname, 'public', 'warehouse.html'));
  } else {
    res.redirect('/login.html');
  }
});

// Auth routes (public)
app.use('/api/auth', authRoutes);

// Protect HTML pages before static files
app.use(protectPages);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Protect API routes (except /api/auth, registered above)
app.use('/api', requireAuth);

// API Routes
app.use('/api/funcionarios', funcionariosRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/church-service-orders', churchServiceOrderRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/location-product', locationProductRoutes);
app.use('/api/movement', movementRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/system-applications', systemApplicationsRoutes);
app.use('/api/user-applications', userApplicationsRoutes);
app.use('/api/situations', situationsRoutes);
app.use('/api/picking', pickingRoutes);
app.use('/api/warehouse-map', warehouseMapRoutes);
app.use('/api/system-documentation', systemDocumentationRoutes);

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
    
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📋 User registration API available at http://localhost:${PORT}/api/funcionarios`);
      console.log(`📦 Warehouse API available at http://localhost:${PORT}/api/warehouse`);
      console.log(`📍 Locations API available at http://localhost:${PORT}/api/locations`);
      console.log(`🏥 Health check available at http://localhost:${PORT}/health`);
      console.log(`💾 Data saved in PostgreSQL database`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Stop the other server instance and run npm start again.`);
        console.error('   On Windows PowerShell: Get-NetTCPConnection -LocalPort 3000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }');
      } else {
        console.error('❌ Server error:', error.message);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Error initializing server:', error.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;

