const express = require('express');
const router = express.Router();
const questionBankGroupController = require('../controllers/questionBankGroup.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(authenticate, authorize('instructor', 'admin'));

router.get('/', questionBankGroupController.getBanks);
router.post('/', questionBankGroupController.createBank);
router.get('/:id', questionBankGroupController.getBankById);
router.post('/:id/questions', questionBankGroupController.addQuestions);

module.exports = router;
