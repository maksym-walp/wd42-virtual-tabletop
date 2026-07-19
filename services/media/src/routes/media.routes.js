const express = require('express');
const requireAuth = require('../middleware/auth.middleware');
const { upload } = require('../config/upload');
const MediaController = require('../controllers/media.controller');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth);

router.post('/upload', upload.single('file'), wrap(MediaController.upload));

module.exports = router;
