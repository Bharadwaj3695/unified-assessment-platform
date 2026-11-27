const { createProvider } = require('../providers/providerFactory');
const { validateProctoringPipelineOutput } = require('../validators/outputSchema.validator');

async function runProctoringPipeline(input, providerOverride = null) {
  const provider = providerOverride || createProvider();
  const analysis = await provider.analyzeProctoringEvents({
    interviewId: input.interviewId,
    telemetrySignals: input.telemetrySignals || [],
  });

  return validateProctoringPipelineOutput({
    events: analysis.events || [],
    behavioralSummaryDraft: analysis.behavioralSummaryDraft || '',
    provider: provider.name,
  });
}

module.exports = {
  runProctoringPipeline,
};
