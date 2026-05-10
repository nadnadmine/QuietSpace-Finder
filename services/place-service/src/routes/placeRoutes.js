const express = require('express');
const placeController = require('../controllers/placeController');
const reportController = require('../controllers/reportController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Places
router.get('/', placeController.getPlaces);
router.get('/:id', placeController.getPlaceById);
router.post('/', authenticate, placeController.createPlace);

// Bookmarks (handled in place-service under /api/bookmarks, but we mount it here or in index.js)
// Wait, the gateway maps /api/places to place-service, and /api/bookmarks also to place-service.
// We will export a separate router for bookmarks, or handle it in index.js.
// Let's create an object of routers to export.

const placeRouter = express.Router();
placeRouter.get('/', placeController.getPlaces);
placeRouter.get('/categories', placeController.getCategories);
placeRouter.get('/recommendations', placeController.getRecommendations);
placeRouter.get('/:id', placeController.getPlaceById);
placeRouter.post('/', authenticate, placeController.createPlace);
placeRouter.get('/:placeId/reports', reportController.getReports);
placeRouter.post('/:placeId/reports', authenticate, reportController.createReport);

const bookmarkRouter = express.Router();
bookmarkRouter.get('/', authenticate, placeController.getBookmarks);
bookmarkRouter.post('/:placeId', authenticate, placeController.addBookmark);
bookmarkRouter.delete('/:placeId', authenticate, placeController.removeBookmark);

const tagRouter = express.Router();
tagRouter.get('/', placeController.getTags);

const reportRouter = express.Router();
reportRouter.get('/:reportId', reportController.getReportById);
reportRouter.delete('/:reportId', authenticate, reportController.deleteReport);
reportRouter.post('/:reportId/vote', authenticate, reportController.voteReport);

module.exports = { placeRouter, bookmarkRouter, tagRouter, reportRouter };
