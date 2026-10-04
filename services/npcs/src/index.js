require('dotenv').config();

const express = require('express');
const cors = require('cors');
const npcRoutes = require('./routes/npc.routes');
const factionRoutes = require('./routes/faction.routes');
const collectionRoutes = require('./routes/collection.routes');

const app = express();

app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost',
  credentials: true,
}));
app.use(express.json());

app.use('/npcs', npcRoutes);
app.use('/factions', factionRoutes);
app.use('/collections', collectionRoutes);

app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status < 500 ? err.message : 'Internal server error' });
});

const PORT = process.env.PORT || 3017;
app.listen(PORT, () => console.log(`[npcs] running on :${PORT}`));
