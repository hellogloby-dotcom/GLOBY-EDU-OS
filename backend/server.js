// server.js
// Simple Express server that serves static frontend assets and backend API routes.

const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const apiRoutes = require('./routes/api');

// Load environment variables from .env file if available.
dotenv.config();

const app = express();

const allowedOrigins = [
  'http://localhost:4000',
  'http://127.0.0.1:4000',
  'http://localhost:4001',
  'http://127.0.0.1:4001',
  'http://localhost:4002',
  'http://127.0.0.1:4002',
  'http://localhost:4003',
  'http://127.0.0.1:4003',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
}));

// Allow the existing image data-url workflow to persist valid 2 MB images.
app.use(express.json({ limit: '12mb' }));

// Basic request logging middleware for development.
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Mount the API router under a versioned path.
app.use('/api/v1', apiRoutes);

// Expose only Firebase's public web configuration to the browser.
app.get('/config/firebase.js', (req, res) => {
  const publicConfig = {
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  };

  res.type('application/javascript').set('Cache-Control', 'no-store').send(
    `globalThis.__GLOBYEDU_FIREBASE_CONFIG__ = ${JSON.stringify(publicConfig)};`
  );
});

// Return a no-content response for favicon requests when no favicon asset is present.
app.get('/favicon.ico', (req, res) => res.sendStatus(204));

// Serve frontend static files from the sibling frontend folder.
// express.static serves files such as index.html, app.js, styles.css, and component modules.
// __dirname is the current file folder, backend, so we use path.join(__dirname, '../frontend')
// to resolve the frontend directory relative to the backend code.
const frontendPath = path.join(__dirname, '../frontend');
const marketingPath = path.join(frontendPath, 'marketing');
const publicPath = path.join(__dirname, '../public');
const rootAssetsPath = path.join(__dirname, '../src/assets/images');
const staticOptions = {
  setHeaders(res, filePath) {
    if (process.env.NODE_ENV !== 'production' && /\.(?:html|css|js)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'no-store, must-revalidate');
    }
  },
};
app.use(express.static(marketingPath, staticOptions));
app.use(express.static(frontendPath, staticOptions));
app.use('/src/assets/images', express.static(rootAssetsPath));
app.use('/root-assets/images', express.static(rootAssetsPath));
app.use('/images', express.static(path.join(publicPath, 'images')));

// Fallback route for client-side routing to load index.html.
// When a URL does not match any API or static file, the client-side router in app.js
// can take over and render the correct frontend view.
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

const DEFAULT_PORT = Number(process.env.PORT) || 4000;

const server = app.listen(DEFAULT_PORT, () => {
  console.log(`GlobyEdu OS backend is running on http://localhost:${DEFAULT_PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${DEFAULT_PORT} is already in use. Please stop the running process or set PORT to an unused value before starting the backend.`);
    process.exit(1);
  }

  console.error('Server error:', error);
  process.exit(1);
});
