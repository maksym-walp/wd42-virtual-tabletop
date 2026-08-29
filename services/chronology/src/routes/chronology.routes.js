const express = require('express');
const ChronologyController = require('../controllers/chronology.controller');
const ChronologyMonthController = require('../controllers/chronology-month.controller');
const ChronologyWeekdayController = require('../controllers/chronology-weekday.controller');
const ChronologySeasonController = require('../controllers/chronology-season.controller');
const ChronologyMoonController = require('../controllers/chronology-moon.controller');
const ChronologyEventController = require('../controllers/chronology-event.controller');
const { requireAuth, requireChronologyManager } = require('../middleware/auth.middleware');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// GET routes only need requireAuth; write routes only need
// requireChronologyManager (it calls requireAuth internally) — no route
// needs both, so there's no blanket router.use(requireAuth) here.

router.get('/',        requireAuth, wrap(ChronologyController.list));
router.post('/',       requireChronologyManager, wrap(ChronologyController.create));
router.get('/:id',     requireAuth, wrap(ChronologyController.getOne));
router.put('/:id',     requireChronologyManager, wrap(ChronologyController.update));
router.delete('/:id',  requireChronologyManager, wrap(ChronologyController.remove));

router.get('/:id/months',           requireAuth, wrap(ChronologyMonthController.list));
router.post('/:id/months',          requireChronologyManager, wrap(ChronologyMonthController.create));
router.put('/:id/months/:monthId',  requireChronologyManager, wrap(ChronologyMonthController.update));
router.delete('/:id/months/:monthId', requireChronologyManager, wrap(ChronologyMonthController.remove));

router.get('/:id/weekdays',             requireAuth, wrap(ChronologyWeekdayController.list));
router.post('/:id/weekdays',            requireChronologyManager, wrap(ChronologyWeekdayController.create));
router.put('/:id/weekdays/:weekdayId',  requireChronologyManager, wrap(ChronologyWeekdayController.update));
router.delete('/:id/weekdays/:weekdayId', requireChronologyManager, wrap(ChronologyWeekdayController.remove));

router.get('/:id/seasons',            requireAuth, wrap(ChronologySeasonController.list));
router.post('/:id/seasons',           requireChronologyManager, wrap(ChronologySeasonController.create));
router.put('/:id/seasons/:seasonId',  requireChronologyManager, wrap(ChronologySeasonController.update));
router.delete('/:id/seasons/:seasonId', requireChronologyManager, wrap(ChronologySeasonController.remove));

router.get('/:id/moons',          requireAuth, wrap(ChronologyMoonController.list));
router.post('/:id/moons',         requireChronologyManager, wrap(ChronologyMoonController.create));
router.put('/:id/moons/:moonId',  requireChronologyManager, wrap(ChronologyMoonController.update));
router.delete('/:id/moons/:moonId', requireChronologyManager, wrap(ChronologyMoonController.remove));

// ?campaign_id=... on the GET adds that campaign's own events on top of the
// global (campaign_id IS NULL) lore events — see ChronologyEventController.list.
router.get('/:id/events',           requireAuth, wrap(ChronologyEventController.list));
router.post('/:id/events',          requireChronologyManager, wrap(ChronologyEventController.create));
router.put('/:id/events/:eventId',  requireChronologyManager, wrap(ChronologyEventController.update));
router.delete('/:id/events/:eventId', requireChronologyManager, wrap(ChronologyEventController.remove));

module.exports = router;
