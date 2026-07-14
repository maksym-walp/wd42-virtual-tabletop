require('dotenv').config();

const express = require('express');
const cors = require('cors');
const maneuverRoutes = require('./routes/maneuver.routes');
const collectionRoutes = require('./routes/collection.routes');

const app = express();

app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost',
  credentials: true,
}));
app.use(express.json());

// Must be mounted before maneuverRoutes: its GET /:id at root would
// otherwise swallow GET /collections (matching id='collections') since it's
// registered at the same '/' prefix.
app.use('/collections', collectionRoutes);
app.use('/', maneuverRoutes);

app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status < 500 ? err.message : 'Internal server error' });
});

const PORT = process.env.PORT || 3008;
app.listen(PORT, () => console.log(`[maneuvers] running on :${PORT}`));
