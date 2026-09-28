const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');
const seedDatabase = require('../src/config/seed');
const { User, Assessment, Question, Submission, Evaluation } = require('../src/models');
const submissionService = require('../src/services/submission.service');
const assessmentService = require('../src/services/assessment.service');
const evaluationService = require('../src/services/evaluation.service');
const storageService = require('../src/services/storage.service');

describe('Phase 5 Verification Suite: Document-Based Submissions & Storage Security', () => {
  let instructorUserA;
  let instructorUserB;
  let studentUserA;
  let studentUserB;
  let adminUser;
  let assessmentWithFile;
  let fileQuestion;
  let activeSubmissionA;

  before(async () => {
    await connectDB();
    await seedDatabase();

    // Fetch existing seeded users
    instructorUserA = await User.findOne({ email: 'ins01@uap.edu' });
    instructorUserB = await User.findOne({ email: 'ins02@uap.edu' });
    studentUserA = await User.findOne({ email: 'std01@uap.edu' });
    studentUserB = await User.findOne({ email: 'std02@uap.edu' });
    adminUser = await User.findOne({ email: 'admin01@uap.edu' });

    assert.ok(instructorUserA, 'Instructor A should exist');
    assert.ok(instructorUserB, 'Instructor B should exist');
    assert.ok(studentUserA, 'Student A should exist');
    assert.ok(studentUserB, 'Student B should exist');
    assert.ok(adminUser, 'Admin should exist');

    // Create an assessment owned by instructor A with a FILE_UPLOAD question
    assessmentWithFile = await assessmentService.createAssessment(instructorUserA._id, {
      title: 'Advanced System Architecture Research Submission',
      description: 'Submit your architectural research whitepaper as a PDF or Word document.',
      category: 'Software Engineering',
      durationMinutes: 90,
      passingScore: 60,
      status: 'published',
      accessType: 'public',
      questions: [
        {
          questionText: 'Which distributed consensus algorithm achieves leader election with log replication?',
          type: 'mcq',
          options: [
            { id: 'opt_1', text: 'Raft' },
            { id: 'opt_2', text: 'Round Robin' },
          ],
          correctAnswer: 'opt_1',
          points: 10,
        },
        {
          questionText: 'Upload your comprehensive architectural design document (PDF/DOCX max 10MB) or provide a Google Docs link.',
          type: 'file_upload',
          points: 40,
          fileUploadConfig: {
            allowedFileTypes: ['pdf', 'doc', 'docx'],
            maxFileSizeMb: 10,
            allowGoogleDocs: true,
            isRequired: true,
          },
        },
      ],
    });

    const questions = await Question.find({ assessmentId: assessmentWithFile._id });
    fileQuestion = questions.find((q) => q.type === 'file_upload');
    assert.ok(fileQuestion, 'FILE_UPLOAD question must be created');
  });

  after(async () => {
    // Cleanup created assessment and submissions
    if (assessmentWithFile) {
      await Submission.deleteMany({ assessmentId: assessmentWithFile._id });
      await Question.deleteMany({ assessmentId: assessmentWithFile._id });
      await Assessment.deleteOne({ _id: assessmentWithFile._id });
    }
    await disconnectDB();
  });

  describe('1. FILE_UPLOAD Question Type & Configuration', () => {
    it('1.1 should create FILE_UPLOAD question with default document configurations', async () => {
      assert.strictEqual(fileQuestion.type, 'file_upload');
      assert.strictEqual(fileQuestion.points, 40);
      assert.ok(Array.isArray(fileQuestion.fileUploadConfig.allowedFileTypes));
      assert.ok(fileQuestion.fileUploadConfig.allowedFileTypes.includes('pdf'));
      assert.ok(fileQuestion.fileUploadConfig.allowedFileTypes.includes('docx'));
      assert.strictEqual(fileQuestion.fileUploadConfig.maxFileSizeMb, 10);
      assert.strictEqual(fileQuestion.fileUploadConfig.allowGoogleDocs, true);
    });

    it('1.2 should allow updating assessment with FILE_UPLOAD question configs', async () => {
      const updated = await assessmentService.updateAssessment(
        assessmentWithFile._id,
        instructorUserA._id,
        {
          questions: [
            {
              questionText: 'Updated research submission prompt',
              type: 'file_upload',
              points: 50,
              fileUploadConfig: {
                allowedFileTypes: ['pdf'],
                maxFileSizeMb: 5,
                allowGoogleDocs: false,
                isRequired: true,
              },
            },
          ],
        },
        false
      );

      const qs = await Question.find({ assessmentId: assessmentWithFile._id });
      assert.strictEqual(qs.length, 1);
      assert.strictEqual(qs[0].type, 'file_upload');
      assert.strictEqual(qs[0].points, 50);
      assert.deepStrictEqual(qs[0].fileUploadConfig.allowedFileTypes, ['pdf']);
      assert.strictEqual(qs[0].fileUploadConfig.maxFileSizeMb, 5);
      assert.strictEqual(qs[0].fileUploadConfig.allowGoogleDocs, false);

      // Revert back for remaining tests
      await assessmentService.updateAssessment(
        assessmentWithFile._id,
        instructorUserA._id,
        {
          questions: [
            {
              questionText: 'Which distributed consensus algorithm achieves leader election?',
              type: 'mcq',
              options: [
                { id: 'opt_1', text: 'Raft' },
                { id: 'opt_2', text: 'Round Robin' },
              ],
              correctAnswer: 'opt_1',
              points: 10,
            },
            {
              questionText: 'Upload your research document (PDF/DOCX max 10MB)',
              type: 'file_upload',
              points: 40,
              fileUploadConfig: {
                allowedFileTypes: ['pdf', 'doc', 'docx'],
                maxFileSizeMb: 10,
                allowGoogleDocs: true,
                isRequired: true,
              },
            },
          ],
        },
        false
      );

      const restoredQs = await Question.find({ assessmentId: assessmentWithFile._id });
      fileQuestion = restoredQs.find((q) => q.type === 'file_upload');
    });
  });

  describe('2. Document File Submissions & Storage Security', () => {
    before(async () => {
      // Start student A attempt
      activeSubmissionA = await submissionService.startAttempt(studentUserA._id, assessmentWithFile._id);
      assert.strictEqual(activeSubmissionA.status, 'in_progress');
    });

    it('2.1 should accept valid PDF file upload and persist metadata without exposing internal path', async () => {
      const mockPdfBuffer = Buffer.from('%PDF-1.4 Mock PDF research content for testing');
      const mockFile = {
        buffer: mockPdfBuffer,
        originalname: 'architecture_report.pdf',
        mimetype: 'application/pdf',
        size: mockPdfBuffer.length,
      };

      const result = await submissionService.uploadAnswerFile(
        activeSubmissionA._id,
        studentUserA._id,
        fileQuestion._id,
        mockFile
      );

      assert.ok(result.success);
      assert.strictEqual(result.answer.type, 'file');
      assert.strictEqual(result.answer.originalFilename, 'architecture_report.pdf');
      assert.strictEqual(result.answer.mimeType, 'application/pdf');
      assert.ok(result.answer.fileKey);
      assert.ok(result.answer.uploadedAt);
      assert.strictEqual(result.answer.filePath, undefined, 'Internal filesystem path must NOT be exposed');

      // Verify attempt is still IN_PROGRESS (uploading does not submit assessment)
      const sub = await Submission.findById(activeSubmissionA._id);
      assert.strictEqual(sub.status, 'in_progress');
    });

    it('2.2 should accept valid DOCX file upload and safely replace previous file', async () => {
      const mockDocxBuffer = Buffer.from('Mock docx binary payload');
      const mockFile = {
        buffer: mockDocxBuffer,
        originalname: 'revised_report.docx',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: mockDocxBuffer.length,
      };

      const subBefore = await Submission.findById(activeSubmissionA._id);
      const oldKey = subBefore.answers.get(fileQuestion._id.toString()).fileKey;

      const result = await submissionService.uploadAnswerFile(
        activeSubmissionA._id,
        studentUserA._id,
        fileQuestion._id,
        mockFile
      );

      assert.ok(result.success);
      assert.strictEqual(result.answer.originalFilename, 'revised_report.docx');
      assert.notStrictEqual(result.answer.fileKey, oldKey, 'Should generate new secure key on replacement');

      // Verify old file was unlinked from disk
      assert.strictEqual(fs.existsSync(path.resolve(storageService.documentsDir, oldKey)), false);
    });

    it('2.3 should reject dangerous executable file (.exe / .sh) with 400', async () => {
      const badBuffer = Buffer.from('MZ executable binary');
      const badFile = {
        buffer: badBuffer,
        originalname: 'exploit.exe',
        mimetype: 'application/octet-stream',
        size: badBuffer.length,
      };

      await assert.rejects(
        async () => {
          await submissionService.uploadAnswerFile(
            activeSubmissionA._id,
            studentUserA._id,
            fileQuestion._id,
            badFile
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.ok(err.message.toLowerCase().includes('forbidden') || err.message.toLowerCase().includes('invalid'));
          return true;
        }
      );
    });

    it('2.4 should reject file with invalid document extension (.png / .zip)', async () => {
      const imgBuffer = Buffer.from('Fake image data');
      const imgFile = {
        buffer: imgBuffer,
        originalname: 'diagram.png',
        mimetype: 'image/png',
        size: imgBuffer.length,
      };

      await assert.rejects(
        async () => {
          await submissionService.uploadAnswerFile(
            activeSubmissionA._id,
            studentUserA._id,
            fileQuestion._id,
            imgFile
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.ok(err.message.includes('Allowed formats'));
          return true;
        }
      );
    });

    it('2.5 should reject oversized document exceeding question maxFileSizeMb with 413', async () => {
      const oversizedFile = {
        buffer: Buffer.alloc(100),
        originalname: 'huge_thesis.pdf',
        mimetype: 'application/pdf',
        size: 15 * 1024 * 1024, // 15MB > 10MB
      };

      await assert.rejects(
        async () => {
          await submissionService.uploadAnswerFile(
            activeSubmissionA._id,
            studentUserA._id,
            fileQuestion._id,
            oversizedFile
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 413);
          assert.ok(err.message.includes('exceeds maximum allowed size'));
          return true;
        }
      );
    });

    it('2.6 should sanitize malicious original filenames preventing directory traversal', async () => {
      const mockPdfBuffer = Buffer.from('%PDF-1.4 safe');
      const traversalFile = {
        buffer: mockPdfBuffer,
        originalname: '../../../../etc/passwd.pdf',
        mimetype: 'application/pdf',
        size: mockPdfBuffer.length,
      };

      const result = await submissionService.uploadAnswerFile(
        activeSubmissionA._id,
        studentUserA._id,
        fileQuestion._id,
        traversalFile
      );

      assert.strictEqual(result.answer.originalFilename, 'passwd.pdf');
      assert.strictEqual(result.answer.fileKey.includes('..'), false);
    });

    it('2.7 should block Student B from uploading to Student A submission (HTTP 403)', async () => {
      const mockPdfBuffer = Buffer.from('%PDF-1.4');
      const mockFile = {
        buffer: mockPdfBuffer,
        originalname: 'foreign.pdf',
        mimetype: 'application/pdf',
        size: mockPdfBuffer.length,
      };

      await assert.rejects(
        async () => {
          await submissionService.uploadAnswerFile(
            activeSubmissionA._id,
            studentUserB._id, // Foreign student!
            fileQuestion._id,
            mockFile
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          return true;
        }
      );
    });

    it('2.8 should accept valid legacy DOC (.doc) file upload with application/msword', async () => {
      const mockDocBuffer = Buffer.from('\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1 Legacy Word Document Content');
      const mockFile = {
        buffer: mockDocBuffer,
        originalname: 'legacy_specification.doc',
        mimetype: 'application/msword',
        size: mockDocBuffer.length,
      };

      const result = await submissionService.uploadAnswerFile(
        activeSubmissionA._id,
        studentUserA._id,
        fileQuestion._id,
        mockFile
      );

      assert.ok(result.success);
      assert.strictEqual(result.answer.originalFilename, 'legacy_specification.doc');
      assert.strictEqual(result.answer.mimeType, 'application/msword');
      assert.ok(result.answer.fileKey.endsWith('.doc'));
    });

    it('2.9 should reject file with mismatched or invalid MIME type with 400', async () => {
      const badMimeFile = {
        buffer: Buffer.from('%PDF-1.4 Fake PDF with HTML mime'),
        originalname: 'exploit_document.pdf',
        mimetype: 'text/html',
        size: 50,
      };

      await assert.rejects(
        async () => {
          await submissionService.uploadAnswerFile(
            activeSubmissionA._id,
            studentUserA._id,
            fileQuestion._id,
            badMimeFile
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.ok(err.message.includes('Invalid MIME type'));
          return true;
        }
      );
    });

    it('2.10 should reject upload to a question that is not a file_upload type (e.g. MCQ question)', async () => {
      const mcqQ = await Question.findOne({ assessmentId: assessmentWithFile._id, type: 'mcq' });
      const mockPdf = {
        buffer: Buffer.from('%PDF-1.4 Test'),
        originalname: 'answer.pdf',
        mimetype: 'application/pdf',
        size: 20,
      };

      await assert.rejects(
        async () => {
          await submissionService.uploadAnswerFile(
            activeSubmissionA._id,
            studentUserA._id,
            mcqQ._id,
            mockPdf
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.ok(err.message.includes('does not accept file uploads'));
          return true;
        }
      );
    });

    it('2.11 should reject upload to a question that does not belong to the assessment', async () => {
      const foreignQId = new mongoose.Types.ObjectId();
      const mockPdf = {
        buffer: Buffer.from('%PDF-1.4 Test'),
        originalname: 'answer.pdf',
        mimetype: 'application/pdf',
        size: 20,
      };

      await assert.rejects(
        async () => {
          await submissionService.uploadAnswerFile(
            activeSubmissionA._id,
            studentUserA._id,
            foreignQId,
            mockPdf
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.ok(err.message.includes('does not belong to this assessment'));
          return true;
        }
      );
    });

    it('2.12 should reject file upload and auto-close attempt when server deadline has expired', async () => {
      const expiredSub = await Submission.create({
        studentId: studentUserB._id,
        assessmentId: assessmentWithFile._id,
        startedAt: new Date(Date.now() - 3600000),
        deadlineAt: new Date(Date.now() - 100000),
        status: 'in_progress',
        answers: {},
      });

      const mockPdf = {
        buffer: Buffer.from('%PDF-1.4 Expired'),
        originalname: 'late.pdf',
        mimetype: 'application/pdf',
        size: 20,
      };

      await assert.rejects(
        async () => {
          await submissionService.uploadAnswerFile(
            expiredSub._id,
            studentUserB._id,
            fileQuestion._id,
            mockPdf
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.ok(err.message.includes('deadline has expired'));
          return true;
        }
      );

      const reloaded = await Submission.findById(expiredSub._id);
      assert.strictEqual(reloaded.status, 'submitted');
      assert.strictEqual(reloaded.submittedReason, 'TIME_EXPIRED');
      await Submission.deleteOne({ _id: expiredSub._id });
    });
  });

  describe('3. Google Docs URL Submission & Validation', () => {
    it('3.1 should accept valid HTTPS Google Docs URL and persist metadata without server-side fetching', async () => {
      const validDocUrl = 'https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing';

      const result = await submissionService.attachGoogleDocsUrl(
        activeSubmissionA._id,
        studentUserA._id,
        fileQuestion._id,
        validDocUrl
      );

      assert.ok(result.success);
      assert.strictEqual(result.answer.type, 'google_docs');
      assert.ok(result.answer.googleDocsUrl.startsWith('https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'));
      assert.ok(result.answer.submittedAt);

      // Verify attempt is still IN_PROGRESS
      const sub = await Submission.findById(activeSubmissionA._id);
      assert.strictEqual(sub.status, 'in_progress');
    });

    it('3.2 should reject arbitrary non-Google URL (SSRF prevention)', async () => {
      const maliciousUrls = [
        'http://localhost:5000/api/admin/users',
        'http://169.254.169.254/latest/meta-data/',
        'https://attacker-site.com/document/d/12345',
        'https://drive.google.com/file/d/12345',
      ];

      for (const url of maliciousUrls) {
        await assert.rejects(
          async () => {
            await submissionService.attachGoogleDocsUrl(
              activeSubmissionA._id,
              studentUserA._id,
              fileQuestion._id,
              url
            );
          },
          (err) => {
            assert.strictEqual(err.statusCode, 400);
            return true;
          }
        );
      }
    });

    it('3.3 should reject malformed or credential-bearing URLs', async () => {
      const invalidUrls = [
        'not-a-valid-url',
        'https://admin:secret@docs.google.com/document/d/12345',
        'https://docs.google.com/spreadsheets/d/12345',
      ];

      for (const url of invalidUrls) {
        await assert.rejects(
          async () => {
            await submissionService.attachGoogleDocsUrl(
              activeSubmissionA._id,
              studentUserA._id,
              fileQuestion._id,
              url
            );
          },
          (err) => {
            assert.strictEqual(err.statusCode, 400);
            return true;
          }
        );
      }
    });

    it('3.4 should reject Google Docs submission when allowGoogleDocs is false on question config (HTTP 400)', async () => {
      await Question.updateOne({ _id: fileQuestion._id }, { 'fileUploadConfig.allowGoogleDocs': false });

      await assert.rejects(
        async () => {
          await submissionService.attachGoogleDocsUrl(
            activeSubmissionA._id,
            studentUserA._id,
            fileQuestion._id,
            'https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit'
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.ok(err.message.includes('not allowed'));
          return true;
        }
      );

      await Question.updateOne({ _id: fileQuestion._id }, { 'fileUploadConfig.allowGoogleDocs': true });
    });

    it('3.5 should safely delete previously uploaded document file when replacing with Google Docs URL', async () => {
      const testBuffer = Buffer.from('%PDF-1.4 file before gdocs replacement');
      const uploadRes = await submissionService.uploadAnswerFile(
        activeSubmissionA._id,
        studentUserA._id,
        fileQuestion._id,
        {
          buffer: testBuffer,
          originalname: 'pre_gdocs.pdf',
          mimetype: 'application/pdf',
          size: testBuffer.length,
        }
      );
      const preKey = uploadRes.answer.fileKey;
      assert.strictEqual(fs.existsSync(path.resolve(storageService.documentsDir, preKey)), true);

      const gdocsRes = await submissionService.attachGoogleDocsUrl(
        activeSubmissionA._id,
        studentUserA._id,
        fileQuestion._id,
        'https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit'
      );
      assert.ok(gdocsRes.success);
      assert.strictEqual(gdocsRes.answer.type, 'google_docs');

      assert.strictEqual(fs.existsSync(path.resolve(storageService.documentsDir, preKey)), false);
    });

    it('3.6 should reject Google Docs attachment when attempt deadline has expired', async () => {
      const expiredSub = await Submission.create({
        studentId: studentUserB._id,
        assessmentId: assessmentWithFile._id,
        startedAt: new Date(Date.now() - 3600000),
        deadlineAt: new Date(Date.now() - 100000),
        status: 'in_progress',
        answers: {},
      });

      await assert.rejects(
        async () => {
          await submissionService.attachGoogleDocsUrl(
            expiredSub._id,
            studentUserB._id,
            fileQuestion._id,
            'https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit'
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.ok(err.message.includes('deadline has expired'));
          return true;
        }
      );

      await Submission.deleteOne({ _id: expiredSub._id });
    });
  });

  describe('4. Draft Answer File Removal & File Replacement', () => {
    it('4.1 should allow student to remove draft answer before final submission', async () => {
      // First upload a draft file
      const mockPdf = Buffer.from('%PDF-1.4 for removal');
      await submissionService.uploadAnswerFile(
        activeSubmissionA._id,
        studentUserA._id,
        fileQuestion._id,
        {
          buffer: mockPdf,
          originalname: 'to_be_deleted.pdf',
          mimetype: 'application/pdf',
          size: mockPdf.length,
        }
      );

      // Verify file answer exists
      let sub = await Submission.findById(activeSubmissionA._id);
      assert.ok(sub.answers.get(fileQuestion._id.toString()));

      // Remove it
      const removeResult = await submissionService.removeAnswerFile(
        activeSubmissionA._id,
        studentUserA._id,
        fileQuestion._id
      );
      assert.ok(removeResult.success);

      // Verify answer was removed from MongoDB
      sub = await Submission.findById(activeSubmissionA._id);
      assert.strictEqual(sub.answers.get(fileQuestion._id.toString()), undefined);
    });

    it('4.2 should block foreign student from removing draft answer (HTTP 403)', async () => {
      await assert.rejects(
        async () => {
          await submissionService.removeAnswerFile(
            activeSubmissionA._id,
            studentUserB._id,
            fileQuestion._id
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          return true;
        }
      );
    });

    it('4.3 should reject removing draft file if submission has already been submitted (HTTP 400)', async () => {
      // Create submitted submission
      const subAttempt = await Submission.create({
        studentId: studentUserB._id,
        assessmentId: assessmentWithFile._id,
        status: 'submitted',
        answers: {
          [fileQuestion._id.toString()]: { type: 'file', fileKey: 'mock.pdf' },
        },
      });

      await assert.rejects(
        async () => {
          await submissionService.removeAnswerFile(
            subAttempt._id,
            studentUserB._id,
            fileQuestion._id
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.ok(err.message.includes('after final submission'));
          return true;
        }
      );

      await Submission.deleteOne({ _id: subAttempt._id });
    });
  });

  describe('5. Access Control & Authorization on Submitted Files', () => {
    let finalKey;

    before(async () => {
      // Re-upload a valid PDF for evaluation and download tests
      const mockPdf = Buffer.from('%PDF-1.4 Final Research Report Content');
      const uploaded = await submissionService.uploadAnswerFile(
        activeSubmissionA._id,
        studentUserA._id,
        fileQuestion._id,
        {
          buffer: mockPdf,
          originalname: 'final_research_paper.pdf',
          mimetype: 'application/pdf',
          size: mockPdf.length,
        }
      );
      finalKey = uploaded.answer.fileKey;
    });

    it('5.1 student owner can retrieve their own submitted file', async () => {
      const fileData = await submissionService.getAnswerFile(
        activeSubmissionA._id,
        studentUserA._id,
        'student',
        fileQuestion._id
      );
      assert.ok(fileData.filePath);
      assert.strictEqual(fileData.originalFilename, 'final_research_paper.pdf');
      assert.strictEqual(fileData.mimeType, 'application/pdf');
    });

    it('5.2 foreign student cannot access submitted file (HTTP 403)', async () => {
      await assert.rejects(
        async () => {
          await submissionService.getAnswerFile(
            activeSubmissionA._id,
            studentUserB._id, // Foreign student
            'student',
            fileQuestion._id
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          return true;
        }
      );
    });

    it('5.3 instructor owner of assessment can access submitted file', async () => {
      const fileData = await submissionService.getAnswerFile(
        activeSubmissionA._id,
        instructorUserA._id, // Owner of assessment
        'instructor',
        fileQuestion._id
      );
      assert.ok(fileData.filePath);
      assert.strictEqual(fileData.originalFilename, 'final_research_paper.pdf');
    });

    it('5.4 foreign instructor who does not own assessment is blocked (HTTP 403)', async () => {
      await assert.rejects(
        async () => {
          await submissionService.getAnswerFile(
            activeSubmissionA._id,
            instructorUserB._id, // Non-owner instructor
            'instructor',
            fileQuestion._id
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.ok(err.message.includes('You do not own the assessment'));
          return true;
        }
      );
    });

    it('5.5 platform administrator can access submitted file for governance', async () => {
      const fileData = await submissionService.getAnswerFile(
        activeSubmissionA._id,
        adminUser._id,
        'admin',
        fileQuestion._id
      );
      assert.ok(fileData.filePath);
    });
  });

  describe('6. Final Submission, Immutability & Faculty Evaluation', () => {
    it('6.1 student submits assessment: status becomes submitted and requires evaluation', async () => {
      const mcqQ = await Question.findOne({ assessmentId: assessmentWithFile._id, type: 'mcq' });
      const submitted = await submissionService.submitAssessment(activeSubmissionA._id, studentUserA._id, {
        [mcqQ._id.toString()]: 'opt_1',
      });

      assert.strictEqual(submitted.status, 'submitted');
      assert.strictEqual(submitted.evaluationStatus, 'pending');
      assert.strictEqual(submitted.resultStatus, 'pending_evaluation');
      assert.strictEqual(submitted.autoScore, 10); // MCQ correct
    });

    it('6.2 file upload replacement is strictly blocked after final submission (HTTP 400)', async () => {
      const mockPdf = Buffer.from('%PDF-1.4 post submission attempt');
      await assert.rejects(
        async () => {
          await submissionService.uploadAnswerFile(
            activeSubmissionA._id,
            studentUserA._id,
            fileQuestion._id,
            {
              buffer: mockPdf,
              originalname: 'cheat.pdf',
              mimetype: 'application/pdf',
              size: mockPdf.length,
            }
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.ok(err.message.includes('finalized or submitted'));
          return true;
        }
      );
    });

    it('6.3 faculty evaluates FILE_UPLOAD question: score and feedback persist', async () => {
      const evalResult = await evaluationService.evaluateSubmission(
        instructorUserA._id,
        activeSubmissionA._id,
        {
          questionFeedback: {
            [fileQuestion._id.toString()]: {
              pointsAwarded: 35,
              comment: 'Exemplary architectural research paper with sound distributed systems methodology.',
            },
          },
          generalFeedback: 'Overall outstanding performance across both theoretical and document submissions.',
        }
      );

      assert.ok(evalResult);
      assert.strictEqual(evalResult.evaluation.status, 'completed');
      assert.strictEqual(evalResult.submission.status, 'evaluated');
      assert.strictEqual(evalResult.submission.manualScore, 35);
      assert.strictEqual(evalResult.submission.autoScore, 10);
      assert.strictEqual(evalResult.submission.finalScore, 45); // 10 + 35
      assert.strictEqual(evalResult.submission.percentage, 90); // 45 / 50 * 100
      assert.strictEqual(evalResult.submission.passed, true);
    });

    it('6.4 student can view their own document submission and faculty feedback', async () => {
      const studentView = await submissionService.getSubmissionById(
        activeSubmissionA._id,
        studentUserA._id,
        'student'
      );

      assert.strictEqual(studentView.status, 'evaluated');
      assert.strictEqual(studentView.finalScore, 45);
      assert.ok(studentView.evaluation);
      assert.strictEqual(
        studentView.evaluation.questionFeedback[fileQuestion._id.toString()].pointsAwarded,
        35
      );
      assert.strictEqual(
        studentView.evaluation.questionFeedback[fileQuestion._id.toString()].comment,
        'Exemplary architectural research paper with sound distributed systems methodology.'
      );
    });

    it('6.5 student cannot see another student submission or feedback (HTTP 403)', async () => {
      await assert.rejects(
        async () => {
          await submissionService.getSubmissionById(
            activeSubmissionA._id,
            studentUserB._id, // Different student
            'student'
          );
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          return true;
        }
      );
    });
  });

  describe('7. Mixed Assessment Regression: MCQ, SHORT, LONG & FILE_UPLOAD Lifecycle', () => {
    let mixedAssessment;
    let mcqQ;
    let shortQ;
    let longQ;
    let fileQ;
    let mixedSubmission;

    before(async () => {
      mixedAssessment = await assessmentService.createAssessment(instructorUserA._id, {
        title: 'Full Stack Distributed Systems Exam',
        description: 'Comprehensive evaluation covering multiple question types.',
        category: 'Computer Science',
        durationMinutes: 120,
        passingScore: 60,
        status: 'published',
        accessType: 'public',
        questions: [
          {
            questionText: 'Which protocol is connection-oriented?',
            type: 'mcq',
            options: [
              { id: 'opt_1', text: 'TCP' },
              { id: 'opt_2', text: 'UDP' },
            ],
            correctAnswer: 'opt_1',
            points: 10,
          },
          {
            questionText: 'Define eventual consistency.',
            type: 'short_answer',
            points: 15,
          },
          {
            questionText: 'Explain the Raft consensus protocol in detail.',
            type: 'long_answer',
            points: 25,
          },
          {
            questionText: 'Upload your distributed storage design architecture report.',
            type: 'file_upload',
            points: 50,
            fileUploadConfig: {
              allowedFileTypes: ['pdf', 'docx'],
              maxFileSizeMb: 15,
              allowGoogleDocs: true,
              isRequired: true,
            },
          },
        ],
      });

      const qs = await Question.find({ assessmentId: mixedAssessment._id });
      mcqQ = qs.find((q) => q.type === 'mcq');
      shortQ = qs.find((q) => q.type === 'short_answer');
      longQ = qs.find((q) => q.type === 'long_answer');
      fileQ = qs.find((q) => q.type === 'file_upload');

      assert.ok(mcqQ && shortQ && longQ && fileQ, 'All 4 question types must be present');
    });

    after(async () => {
      if (mixedAssessment) {
        await Submission.deleteMany({ assessmentId: mixedAssessment._id });
        await Question.deleteMany({ assessmentId: mixedAssessment._id });
        await Assessment.deleteOne({ _id: mixedAssessment._id });
      }
    });

    it('7.1 should start attempt and autosave answers for objective, subjective, and document questions', async () => {
      mixedSubmission = await submissionService.startAttempt(studentUserA._id, mixedAssessment._id);
      assert.strictEqual(mixedSubmission.status, 'in_progress');

      // Autosave MCQ
      await submissionService.autosaveAnswer(mixedSubmission._id, studentUserA._id, mcqQ._id, 'opt_1');

      // Autosave Short Answer
      await submissionService.autosaveAnswer(
        mixedSubmission._id,
        studentUserA._id,
        shortQ._id,
        'Eventual consistency guarantees all replicas converge over time.'
      );

      // Autosave Long Answer
      await submissionService.autosaveAnswer(
        mixedSubmission._id,
        studentUserA._id,
        longQ._id,
        'Raft uses leader election, log replication, and safety invariants.'
      );

      // Upload file answer
      const pdfBuffer = Buffer.from('%PDF-1.4 Distributed Systems Final Architecture Report');
      const uploadRes = await submissionService.uploadAnswerFile(
        mixedSubmission._id,
        studentUserA._id,
        fileQ._id,
        {
          buffer: pdfBuffer,
          originalname: 'distributed_systems_design.pdf',
          mimetype: 'application/pdf',
          size: pdfBuffer.length,
        }
      );
      assert.ok(uploadRes.success);
      assert.strictEqual(uploadRes.answer.originalFilename, 'distributed_systems_design.pdf');

      // Confirm upload did not trigger final submission
      const reloaded = await Submission.findById(mixedSubmission._id);
      assert.strictEqual(reloaded.status, 'in_progress');
    });

    it('7.2 should submit assessment, auto-score MCQ, and hold subjective/document answers for evaluation', async () => {
      const submitted = await submissionService.submitAssessment(mixedSubmission._id, studentUserA._id);
      assert.strictEqual(submitted.status, 'submitted');
      assert.strictEqual(submitted.evaluationStatus, 'pending');
      assert.strictEqual(submitted.resultStatus, 'pending_evaluation');
      assert.strictEqual(submitted.autoScore, 10);
      assert.strictEqual(submitted.manualScore, 0);
      assert.strictEqual(submitted.totalPoints, 100);
    });

    it('7.3 incomplete evaluation should not finalize grade or mark PASS/FAIL', async () => {
      const evalPartial = await evaluationService.evaluateSubmission(
        instructorUserA._id,
        mixedSubmission._id,
        {
          questionFeedback: {
            [shortQ._id.toString()]: {
              pointsAwarded: 15,
              comment: 'Precise and accurate definition.',
            },
          },
          generalFeedback: 'Partial grading in progress.',
        }
      );

      assert.strictEqual(evalPartial.submission.status, 'submitted');
      assert.strictEqual(evalPartial.submission.evaluationStatus, 'pending');
      assert.strictEqual(evalPartial.submission.resultStatus, 'pending_evaluation');
      assert.strictEqual(evalPartial.submission.manualScore, 15);
      assert.strictEqual(evalPartial.evaluation.status, 'pending');
    });

    it('7.4 full evaluation across all subjective and document questions finalizes score and PASS status', async () => {
      const fullEval = await evaluationService.evaluateSubmission(
        instructorUserA._id,
        mixedSubmission._id,
        {
          questionFeedback: {
            [shortQ._id.toString()]: {
              pointsAwarded: 15,
              comment: 'Precise and accurate definition.',
            },
            [longQ._id.toString()]: {
              pointsAwarded: 22,
              comment: 'Comprehensive explanation of leader election.',
            },
            [fileQ._id.toString()]: {
              pointsAwarded: 45,
              comment: 'Exceptional architectural design and high-level diagram.',
            },
          },
          generalFeedback: 'Outstanding demonstration of distributed systems principles.',
        }
      );

      assert.strictEqual(fullEval.submission.status, 'evaluated');
      assert.strictEqual(fullEval.submission.evaluationStatus, 'completed');
      assert.strictEqual(fullEval.submission.resultStatus, 'passed');
      assert.strictEqual(fullEval.submission.manualScore, 82); // 15 + 22 + 45
      assert.strictEqual(fullEval.submission.autoScore, 10);
      assert.strictEqual(fullEval.submission.finalScore, 92); // 10 + 82
      assert.strictEqual(fullEval.submission.percentage, 92);
      assert.strictEqual(fullEval.submission.passed, true);
    });

    it('7.5 student can inspect their complete result and faculty feedback for all question types', async () => {
      const view = await submissionService.getSubmissionById(
        mixedSubmission._id,
        studentUserA._id,
        'student'
      );

      assert.strictEqual(view.status, 'evaluated');
      assert.strictEqual(view.finalScore, 92);
      assert.strictEqual(view.percentage, 92);
      assert.strictEqual(view.passed, true);
      assert.ok(view.evaluation);
      assert.strictEqual(view.evaluation.questionFeedback[fileQ._id.toString()].pointsAwarded, 45);
      assert.strictEqual(view.evaluation.questionFeedback[shortQ._id.toString()].pointsAwarded, 15);
      assert.strictEqual(view.evaluation.questionFeedback[longQ._id.toString()].pointsAwarded, 22);
    });
  });
});
