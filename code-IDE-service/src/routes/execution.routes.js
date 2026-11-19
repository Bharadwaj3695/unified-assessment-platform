const express = require('express');
const router = express.Router();
const executionController = require('../controllers/execution.controller');
const { requireInternalAuth } = require('../middleware/auth.middleware');

// Public probe routes (for Docker compose / orchestration healthchecks)
router.get('/health', executionController.health);
router.get('/health/live', (req, res) => res.status(200).send('OK'));

// Authenticated internal API routes
router.post('/api/v1/execute', requireInternalAuth, executionController.executeSingle);
router.post('/api/v1/execute-sql', requireInternalAuth, executionController.executeSql);
router.post('/api/v1/execute-suite', requireInternalAuth, executionController.executeSuite);
router.get('/api/v1/runtimes', requireInternalAuth, executionController.getRuntimes);

module.exports = router;
