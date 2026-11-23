const express = require('express');
const router = express.Router();

const assessmentRoutes = require('./assessment.routes');
const mockTestRoutes = require('./mockTest.routes');

// Domain sub-namespaces
router.use('/assessments', assessmentRoutes);
router.use('/mock-tests', mockTestRoutes);

// Extensible future architectural placeholders
router.use('/ai-interviews', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'AI Mock Interviews API domain is planned for a future release.',
  });
});

router.use('/faculty-interviews', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Faculty Face-to-Face Interviews API domain is planned for a future release.',
  });
});

module.exports = router;
