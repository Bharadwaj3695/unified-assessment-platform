const express = require('express');
const router = express.Router();
const subjectTopicController = require('../controllers/subjectTopic.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(authenticate);

// Subjects routes
router.get('/', subjectTopicController.getSubjects);
router.post('/', authorize('instructor', 'admin'), subjectTopicController.createSubject);
router.get('/:id', subjectTopicController.getSubjectById);
router.patch('/:id', authorize('instructor', 'admin'), subjectTopicController.updateSubject);

// Topics under subject
router.get('/:subjectId/topics', subjectTopicController.getTopics);
router.post('/:subjectId/topics', authorize('instructor', 'admin'), subjectTopicController.createTopic);
router.get('/:subjectId/hierarchy', subjectTopicController.getTopicHierarchy);

module.exports = router;
