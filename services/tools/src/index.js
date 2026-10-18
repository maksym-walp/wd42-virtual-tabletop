require('dotenv').config();

const express = require('express');
const cors = require('cors');
const constellationRoutes = require('./routes/constellation.routes');
const deckRoutes = require('./routes/deck.routes');

const app = express();

app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost',
  credentials: true,
}));
// Колода до 200 карток із підписами та URL — з запасом більша за дефолтні 100 КБ.
app.use(express.json({ limit: '1mb' }));

// Спільний сервіс допоміжних інструментів: кожен інструмент — власний префікс.
app.use('/constellations', constellationRoutes);
app.use('/decks', deckRoutes);

app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status < 500 ? err.message : 'Internal server error' });
});

const PORT = process.env.PORT || 3018;
app.listen(PORT, () => console.log(`[tools] running on :${PORT}`));
