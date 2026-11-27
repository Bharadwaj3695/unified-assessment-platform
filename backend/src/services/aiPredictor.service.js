/**
 * Integration-ready AI Performance Predictor service.
 *
 * Strictly separated from authoritative evaluation, scoring, grading, and certification logic.
 * Currently acts as an integration contract / placeholder until an external or trained
 * prediction model is enabled. Never fabricates predictions and never consumes pending attempts.
 */

const MIN_EVALUATED_EXAMS_FOR_ANALYSIS = 3;

class AiPredictorService {
  /**
   * Build an integration-ready AI performance analysis payload strictly from
   * finalized evaluated exam records.
   *
   * @param {Object} params
   * @param {Array<Object>} params.evaluatedExams - Finalized evaluated exams only
   * @param {Array<Object>} [params.topicBreakdown] - Real topic performance items if available
   * @returns {Object} Integration payload clearly labeled as non-operational estimate contract
   */
  buildIntegrationPayload({ evaluatedExams = [], topicBreakdown = [] } = {}) {
    // Strictly guard against any pending or non-finalized records entering historical inputs
    const finalizedOnly = (Array.isArray(evaluatedExams) ? evaluatedExams : []).filter(
      (item) => item && item.status === 'evaluated' && typeof item.percentage === 'number' && !Number.isNaN(item.percentage)
    );

    const observedSubjects = [
      ...new Set(finalizedOnly.map((e) => e.subject).filter((s) => Boolean(s && String(s).trim()))),
    ];

    const observedTopics = [
      ...new Set(
        (Array.isArray(topicBreakdown) ? topicBreakdown : [])
          .map((t) => t.topicName || t.topic)
          .filter(Boolean)
      ),
    ];

    const recentScores = finalizedOnly
      .slice(0, 10)
      .map((e) => ({
        attemptId: e.attemptId,
        attemptType: e.attemptType,
        examName: e.examName,
        subject: e.subject,
        percentage: e.percentage,
        evaluatedAt: e.evaluatedAt || e.submittedAt || null,
      }));

    return {
      status: 'NOT_IMPLEMENTED',
      isOperational: false,
      isEstimateOnly: true,
      label: 'Performance Analysis',
      badge: 'Coming Soon · Not Available',
      disclaimer:
        'Performance Analysis is coming soon and is not currently available. Future estimates will never modify official scores, pass/fail outcomes, or certification.',
      minimumEvaluatedRequired: MIN_EVALUATED_EXAMS_FOR_ANALYSIS,
      evaluatedHistoryCount: finalizedOnly.length,
      hasSufficientHistory: finalizedOnly.length >= MIN_EVALUATED_EXAMS_FOR_ANALYSIS,
      inputContract: {
        historicalEvaluatedCount: finalizedOnly.length,
        recentScores,
        observedSubjects,
        observedTopics,
      },
      // Always null until an actual predictor model is implemented and validated
      prediction: null,
      plannedCapabilities: [
        'Estimated performance range based on finalized historical attempts',
        'Topic and subject-level areas needing practice',
        'Personalized study recommendations',
      ],
    };
  }
}

module.exports = new AiPredictorService();
module.exports.MIN_EVALUATED_EXAMS_FOR_ANALYSIS = MIN_EVALUATED_EXAMS_FOR_ANALYSIS;
