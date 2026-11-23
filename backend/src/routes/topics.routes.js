const express = require('express');
const router = express.Router();
const subjectTopicController = require('../controllers/subjectTopic.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(authenticate);

router.get('/', subjectTopicController.getTopics);
router.post('/', authorize('instructor', 'admin'), subjectTopicController.createTopic);

module.exports = router;
