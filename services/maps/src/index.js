require('dotenv').config();

const express = require('express');
const cors = require('cors');
const locationRoutes = require('./routes/location.routes');
const mapRoutes = require('./routes/map.routes');

const app = express();

app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost',
  credentials: true,
}));
app.use(express.json());

// /locations must be mounted before the map router — the map router owns the
// root `/:id` route, which would otherwise swallow /locations/... requests.
app.use('/locations', locationRoutes);
app.use('/', mapRoutes);

app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status < 500 ? err.message : 'Internal server error' });
});

const PORT = process.env.PORT || 3013;
app.listen(PORT, () => console.log(`[maps] running on :${PORT}`));
