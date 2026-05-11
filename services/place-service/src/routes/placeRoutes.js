const express = require('express');
const placeController = require('../controllers/placeController');
const reportController = require('../controllers/reportController');
const { authenticate } = require('../middleware/auth');
const {
    globalApiLimiter,
    strictLimiter,
    readOnlyLimiter
} = require('./middleware/rateLimiter');

const router = express.Router();

// Places
router.get('/', readOnlyLimiter, placeController.getPlaces);
router.get('/:id', readOnlyLimiter,placeController.getPlaceById);
router.post('/', authenticate, strictLimiter, placeController.createPlace);

const placeRouter = express.Router();
placeRouter.get('/', readOnlyLimiter, placeController.getPlaces);
placeRouter.get('/categories', readOnlyLimiter, placeController.getCategories);
placeRouter.get('/recommendations',readOnlyLimiter, placeController.getRecommendations);
placeRouter.get('/:id', readOnlyLimiter, placeController.getPlaceById);
placeRouter.post('/', authenticate, strictLimiter, placeController.createPlace);
placeRouter.get('/:placeId/reports', readOnlyLimiter, reportController.getReports);
placeRouter.post('/:placeId/reports', authenticate, strictLimiter, reportController.createReport);

const bookmarkRouter = express.Router();
bookmarkRouter.get('/', authenticate, readOnlyLimiter, placeController.getBookmarks);
bookmarkRouter.post('/:placeId', authenticate, strictLimiter, placeController.addBookmark);
bookmarkRouter.delete('/:placeId', authenticate, strictLimiter, placeController.removeBookmark);

const tagRouter = express.Router();
tagRouter.get('/', readOnlyLimiter, placeController.getTags);

const reportRouter = express.Router();
reportRouter.get('/:reportId', readOnlyLimiter, reportController.getReportById);
reportRouter.delete('/:reportId', authenticate, strictLimiter, reportController.deleteReport);
reportRouter.post('/:reportId/vote', authenticate, strictLimiter, reportController.voteReport);

module.exports = { placeRouter, bookmarkRouter, tagRouter, reportRouter };
