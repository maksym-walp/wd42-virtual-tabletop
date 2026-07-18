require('dotenv').config();

const express = require('express');
const cors = require('cors');
const artifactRoutes = require('./routes/artifact.routes');
const collectionRoutes = require('./routes/collection.routes');

const app = express();

app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost',
  credentials: true,
}));
app.use(express.json());

// Must be mounted before artifactRoutes: artifactRoutes' GET /:id at root would
// otherwise swallow GET /collections (matching id='collections') since it's
// registered at the same '/' prefix.
app.use('/collections', collectionRoutes);
app.use('/', artifactRoutes);

app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status < 500 ? err.message : 'Internal server error' });
});

const PORT = process.env.PORT || 3011;
app.listen(PORT, () => console.log(`[artifacts] running on :${PORT}`));
