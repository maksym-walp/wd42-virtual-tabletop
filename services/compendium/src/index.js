require('dotenv').config();

const express = require('express');
const cors = require('cors');
const speciesRoutes = require('./routes/species.routes');
const subspeciesRoutes = require('./routes/subspecies.routes');
const raceRoutes = require('./routes/race.routes');
const peopleRoutes = require('./routes/people.routes');
const factionRoutes = require('./routes/faction.routes');
const entryRoutes = require('./routes/entry.routes');
const collectionRoutes = require('./routes/collection.routes');

const app = express();

app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost',
  credentials: true,
}));
app.use(express.json());

app.use('/species', speciesRoutes);
app.use('/subspecies', subspeciesRoutes);
app.use('/races', raceRoutes);
app.use('/peoples', peopleRoutes);
app.use('/factions', factionRoutes);
app.use('/entries', entryRoutes);
app.use('/collections', collectionRoutes);

app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status < 500 ? err.message : 'Internal server error' });
});

const PORT = process.env.PORT || 3014;
app.listen(PORT, () => console.log(`[compendium] running on :${PORT}`));
