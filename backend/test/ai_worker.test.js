const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createProvider, LocalOpenWeightProvider } = require('../src/ai-worker/providers/providerFactory');
const { runTranscriptPipeline } = require('../src/ai-worker/pipelines/transcript.pipeline');
const { runProctoringPipeline } = require('../src/ai-worker/pipelines/proctoring.pipeline');
const {
  validateTranscriptPipelineOutput,
  validateProctoringPipelineOutput,
} = require('../src/ai-worker/validators/outputSchema.validator');

describe('UAP AI Worker Service — Provider Abstraction & Schema Validation', () => {
  it('switches providers via factory without hardcoded model coupling', () => {
    const stub = createProvider('deterministic_stub');
    assert.equal(stub.name, 'deterministic_stub');

    const local = createProvider('local_open_weight');
    assert.ok(local instanceof LocalOpenWeightProvider);
    assert.equal(local.name, 'local_open_weight');
  });

  it('runs transcript pipeline and marks empty/unclear utterances as [unclear]', async () => {
    const result = await runTranscriptPipeline({
      interviewId: 'iv-1',
      interviewType: 'technical',
      utterances: [
        { speakerRole: 'faculty', text: 'Please introduce yourself.', confidence: 0.96 },
        { speakerRole: 'student', text: '', status: 'unclear', confidence: 0.25 },
      ],
    });

    assert.equal(result.segments.length, 2);
    assert.equal(result.segments[0].speakerRole, 'faculty');
    assert.equal(result.segments[1].text, '[unclear]');
    assert.equal(result.segments[1].status, 'unclear');
  });

  it('runs event-based proctoring pipeline cleanly', async () => {
    const result = await runProctoringPipeline({
      interviewId: 'iv-1',
      telemetrySignals: [
        { eventType: 'face_not_detected', durationSeconds: 12, confidence: 0.91 },
        { eventType: 'multiple_faces_detected', faceCount: 2, confidence: 0.87 },
      ],
    });

    assert.equal(result.events.length, 2);
    assert.equal(result.events[0].eventType, 'face_not_detected');
    assert.equal(result.events[1].faceCount, 2);
  });

  it('rejects malformed or unsafe AI outputs (forbidden score overrides, XSS, bad confidence)', () => {
    assert.throws(() =>
      validateTranscriptPipelineOutput({
        segments: [{ speakerRole: 'student', text: '<script>alert(1)</script>' }],
      })
    );

    assert.throws(() =>
      validateTranscriptPipelineOutput({
        officialScore: 100,
        segments: [{ speakerRole: 'faculty', text: 'Hello' }],
      })
    );

    assert.throws(() =>
      validateProctoringPipelineOutput({
        events: [{ eventType: 'face_not_detected', confidence: 1.5 }],
      })
    );

    assert.throws(() =>
      validateProctoringPipelineOutput({
        events: [{ eventType: 'personality_dishonest' }],
      })
    );
  });
});
