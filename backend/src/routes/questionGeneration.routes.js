const express = require('express');
const router = express.Router();
const aiQuestionGenerationController = require('../controllers/aiQuestionGeneration.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(authenticate, authorize('instructor', 'admin'));

router.post('/', aiQuestionGenerationController.createJob);
router.get('/:jobId', aiQuestionGenerationController.getJob);
router.post('/:jobId/approve', aiQuestionGenerationController.approveQuestion);
router.post('/:jobId/reject', aiQuestionGenerationController.rejectQuestion);

module.exports = router;
