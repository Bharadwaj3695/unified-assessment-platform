const { createProvider } = require('../providers/providerFactory');
const { validateTranscriptPipelineOutput } = require('../validators/outputSchema.validator');

async function runTranscriptPipeline(input, providerOverride = null) {
  const provider = providerOverride || createProvider();
  const sttResult = await provider.transcribeAndDiarize({
    interviewId: input.interviewId,
    mediaRef: input.mediaRef || null,
    utterances: input.utterances || [],
  });

  let summaryText = '';
  if (input.generateSummary !== false) {
    const sumResult = await provider.summarizeTranscript({
      segments: sttResult.segments || [],
      interviewType: input.interviewType || 'technical',
    });
    summaryText = sumResult.summary || '';
  }

  return validateTranscriptPipelineOutput({
    segments: sttResult.segments || [],
    summary: summaryText,
    provider: provider.name,
  });
}

module.exports = {
  runTranscriptPipeline,
};
