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
const newsRoutes = require('./routes/news');
const systemSettingsRoutes = require('./routes/systemSettings');
const loggedInUsersRoutes = require('./routes/loggedInUsers');
const improvementsCorrectionsRoutes = require('./routes/improvementsCorrections');
const testCasesRoutes = require('./routes/testCases');
const systemSettingsService = require('./services/systemSettingsService');
const { isAuthenticated, protectPages, requireAuth } = require('./middleware/auth');
const funcionarioServiceDB = require('./services/funcionarioServiceDB');
const { initDatabase } = require('./scripts/init-database');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// Security and logging middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'img-src': ["'self'", 'data:', 'blob:', 'https://cdn.jsdelivr.net'],
      // Local html5-qrcode first; allow jsDelivr for barcode scanner / model-viewer
      'script-src': ["'self'", 'https://cdn.jsdelivr.net', "'unsafe-inline'"],
      'script-src-elem': ["'self'", 'https://cdn.jsdelivr.net', "'unsafe-inline'"],
      'worker-src': ["'self'", 'blob:'],
      'media-src': ["'self'", 'blob:', 'mediastream:'],
      'connect-src': ["'self'", 'blob:', 'data:', 'https://cdn.jsdelivr.net']
    }
  }
}));

// Allow WebXR / camera for AR (iPhone ARKit Quick Look / Android ARCore)
app.use((req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(self), microphone=(self), xr-spatial-tracking=(self)'
  );
  next();
});
app.use(cors());
app.use(morgan('combined'));

// Allow larger JSON bodies to support base64 photos
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

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

// Public read-only system settings (background on login page)
app.get('/api/system-settings', async (req, res) => {
  try {
    const data = await systemSettingsService.getSettings();
    res.json({ success: true, data });
  } catch (error) {
    console.error('System settings read error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error loading system settings'
    });
  }
});

// Protect HTML pages before static files
app.use(protectPages);

// Public AR model for Scene Viewer / ARCore (no auth cookies — UUID is the access key)
app.get('/public-ar/:id.glb', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).send('Invalid product id');
    }

    const warehouseArGlbService = require('./services/warehouseArGlbService');
    const cached = warehouseArGlbService.findLatestCachedModel(id);
    if (cached && cached.full) {
      res.setHeader('Content-Type', 'model/gltf-binary');
      res.setHeader('Content-Disposition', `inline; filename="${id}.glb"`);
      res.setHeader('Cache-Control', 'public, max-age=120');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.sendFile(cached.full);
    }

    const warehouseService = require('./services/warehouseService');
    const item = await warehouseService.buscarPorId(id);
    if (!item) {
      return res.status(404).send('Product not found');
    }

    let glb = null;
    if (item.photo) {
      const parsed = warehouseArGlbService.parseDataUrl(item.photo);
      if (parsed && parsed.buffer && parsed.buffer.length <= 750000) {
        glb = warehouseArGlbService.buildProductPhotoGlb(item.photo, {
          maxSideMeters: 0.42,
          depthMeters: 0.012,
          cutout: true
        });
      }
    }
    if (!glb) {
      const fs = require('fs');
      const path = require('path');
      const fallback = path.join(__dirname, 'public', 'models', 'product-box.glb');
      if (!fs.existsSync(fallback)) {
        return res.status(404).send('AR model unavailable');
      }
      glb = fs.readFileSync(fallback);
    }

    res.setHeader('Content-Type', 'model/gltf-binary');
    res.setHeader('Content-Disposition', `inline; filename="${id}.glb"`);
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(glb);
  } catch (error) {
    console.error('Public AR model error:', error);
    return res.status(500).send('Error building AR model');
  }
});

// Serve AR cache with explicit GLB content-type for Scene Viewer / ARCore
app.use('/ar-cache', express.static(path.join(__dirname, 'public', 'ar-cache'), {
  setHeaders(res, filePath) {
    if (String(filePath).toLowerCase().endsWith('.glb')) {
      res.setHeader('Content-Type', 'model/gltf-binary');
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  }
}));

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
app.use('/api/news', newsRoutes);
app.use('/api/improvements-corrections', improvementsCorrectionsRoutes);
app.use('/api/test-cases', testCasesRoutes);
app.use('/api/system-settings', systemSettingsRoutes);
app.use('/api/logged-in-users', loggedInUsersRoutes);

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

