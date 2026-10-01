require('dotenv').config();

const express = require('express');
const cors = require('cors');
const configRoutes = require('./routes/config.routes');
const userRoutes = require('./routes/user.routes');
const backupRoutes = require('./routes/backup.routes');

const app = express();

app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost',
  credentials: true,
}));
app.use(express.json());

app.use('/configs', configRoutes);
app.use('/users', userRoutes);
app.use('/backup', backupRoutes);

app.use((err, req, res, next) => {
  const status = err.statusCode || (err.name === 'MulterError' ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status < 500 ? err.message : 'Internal server error' });
});

const PORT = process.env.PORT || 3011;
app.listen(PORT, () => console.log(`[admin] running on :${PORT}`));
