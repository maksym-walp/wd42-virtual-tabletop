const express = require('express');
const CalendarController = require('../controllers/calendar.controller');
const CalendarMonthController = require('../controllers/calendar-month.controller');
const CalendarWeekdayController = require('../controllers/calendar-weekday.controller');
const CalendarSeasonController = require('../controllers/calendar-season.controller');
const CalendarMoonController = require('../controllers/calendar-moon.controller');
const CalendarEventController = require('../controllers/calendar-event.controller');
const { requireAuth, requireCalendarManager } = require('../middleware/auth.middleware');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// GET routes only need requireAuth; write routes only need
// requireCalendarManager (it calls requireAuth internally) — no route
// needs both, so there's no blanket router.use(requireAuth) here.

router.get('/',        requireAuth, wrap(CalendarController.list));
router.post('/',       requireCalendarManager, wrap(CalendarController.create));
router.get('/:id',     requireAuth, wrap(CalendarController.getOne));
router.put('/:id',     requireCalendarManager, wrap(CalendarController.update));
router.delete('/:id',  requireCalendarManager, wrap(CalendarController.remove));

router.get('/:id/months',           requireAuth, wrap(CalendarMonthController.list));
router.post('/:id/months',          requireCalendarManager, wrap(CalendarMonthController.create));
router.put('/:id/months/:monthId',  requireCalendarManager, wrap(CalendarMonthController.update));
router.delete('/:id/months/:monthId', requireCalendarManager, wrap(CalendarMonthController.remove));

router.get('/:id/weekdays',             requireAuth, wrap(CalendarWeekdayController.list));
router.post('/:id/weekdays',            requireCalendarManager, wrap(CalendarWeekdayController.create));
router.put('/:id/weekdays/:weekdayId',  requireCalendarManager, wrap(CalendarWeekdayController.update));
router.delete('/:id/weekdays/:weekdayId', requireCalendarManager, wrap(CalendarWeekdayController.remove));

router.get('/:id/seasons',            requireAuth, wrap(CalendarSeasonController.list));
router.post('/:id/seasons',           requireCalendarManager, wrap(CalendarSeasonController.create));
router.put('/:id/seasons/:seasonId',  requireCalendarManager, wrap(CalendarSeasonController.update));
router.delete('/:id/seasons/:seasonId', requireCalendarManager, wrap(CalendarSeasonController.remove));

router.get('/:id/moons',          requireAuth, wrap(CalendarMoonController.list));
router.post('/:id/moons',         requireCalendarManager, wrap(CalendarMoonController.create));
router.put('/:id/moons/:moonId',  requireCalendarManager, wrap(CalendarMoonController.update));
router.delete('/:id/moons/:moonId', requireCalendarManager, wrap(CalendarMoonController.remove));

// ?campaign_id=... on the GET adds that campaign's own events on top of the
// global (campaign_id IS NULL) lore events — see CalendarEventController.list.
router.get('/:id/events',           requireAuth, wrap(CalendarEventController.list));
router.post('/:id/events',          requireCalendarManager, wrap(CalendarEventController.create));
router.put('/:id/events/:eventId',  requireCalendarManager, wrap(CalendarEventController.update));
router.delete('/:id/events/:eventId', requireCalendarManager, wrap(CalendarEventController.remove));

module.exports = router;
