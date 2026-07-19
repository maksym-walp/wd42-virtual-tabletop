require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mediaRoutes = require('./routes/media.routes');

const app = express();

app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost',
  credentials: true,
}));
app.use(express.json());

app.use('/', mediaRoutes);

app.use((err, req, res, next) => {
  // Помилки multer приходять із власними кодами, а не statusCode.
  // Зауваж: при завеликому тілі nginx зазвичай відхиляє запит сам (413 з
  // HTML-тілом) ще до Node — сюди доходить лише те, що пролізло крізь нього.
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'Файл завеликий — максимум 10 МБ' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ message: 'Очікується одне поле файлу з назвою "file"' });
  }
  const status = err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status < 500 ? err.message : 'Internal server error' });
});

const PORT = process.env.PORT || 3012;
app.listen(PORT, () => console.log(`[media] running on :${PORT}`));
