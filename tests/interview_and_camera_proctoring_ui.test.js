import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function readProjectFile(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

describe('UAP Interview & Camera Proctoring Frontend Contract Verification', () => {
  const routesSrc = readProjectFile('frontend/src/routes/AppRoutes.jsx');
  const navSrc = readProjectFile('frontend/src/config/navigationConfig.js');
  const proctorPanelSrc = readProjectFile('frontend/src/components/proctoring/CameraProctoringPanel.jsx');
  const floatingPreviewSrc = readProjectFile('frontend/src/components/proctoring/FloatingCameraPreview.jsx');
  const facultyInterviewsSrc = readProjectFile('frontend/src/pages/instructor/FacultyInterviews.jsx');
  const facultySessionSrc = readProjectFile('frontend/src/pages/instructor/FacultyInterviewSession.jsx');
  const studentRoomSrc = readProjectFile('frontend/src/pages/student/StudentInterviewRoom.jsx');
  const videoRoomSrc = readProjectFile('frontend/src/components/interviews/InterviewVideoRoom.jsx');
  const mediaUtilSrc = readProjectFile('frontend/src/utils/interviewMedia.js');
  const reportSrc = readProjectFile('frontend/src/pages/common/InterviewReport.jsx');
  const attemptSrc = readProjectFile('frontend/src/pages/student/Attempt.jsx');
  const studioSrc = readProjectFile('frontend/src/pages/instructor/TestCreatorStudio.jsx');

  test('1. Routes and navigation register faculty and student interview views', () => {
    assert.match(routesSrc, /path="interviews"\s+element=\{<FacultyInterviews\s*\/>\}/);
    assert.match(routesSrc, /path="interviews\/:id\/session"\s+element=\{<FacultyInterviewSession\s*\/>\}/);
    assert.match(routesSrc, /path="interviews"\s+element=\{<StudentInterviews\s*\/>\}/);
    assert.match(routesSrc, /path="interviews\/:id"\s+element=\{<StudentInterviewRoom\s*\/>\}/);
    assert.match(routesSrc, /path="interviews\/:id\/report"\s+element=\{<InterviewReport\s*\/>\}/);
    assert.match(navSrc, /'\/instructor\/interviews'/);
    assert.match(navSrc, /'\/student\/interviews'/);
  });

  test('2. CameraProctoringPanel separates Camera Proctoring and AI Proctoring toggles', () => {
    assert.match(proctorPanelSrc, /toggle-camera-proctoring/);
    assert.match(proctorPanelSrc, /toggle-ai-proctoring/);
    assert.match(proctorPanelSrc, /toggle-live-monitoring/);
    assert.match(proctorPanelSrc, /toggle-camera-permission-required/);
    assert.match(proctorPanelSrc, /input-proctoring-disclosure/);
    assert.match(studioSrc, /CameraProctoringPanel/);
  });

  test('3. FloatingCameraPreview handles permission errors, disconnects, repositionable UI, and track cleanup', () => {
    assert.match(floatingPreviewSrc, /navigator\.mediaDevices/);
    assert.match(floatingPreviewSrc, /NotAllowedError/);
    assert.match(floatingPreviewSrc, /NotFoundError/);
    assert.match(floatingPreviewSrc, /NotReadableError/);
    assert.match(floatingPreviewSrc, /track\.onended/);
    assert.match(floatingPreviewSrc, /track\.stop\(\)/);
    assert.match(floatingPreviewSrc, /floating-camera-preview/);
    assert.match(floatingPreviewSrc, /camera-permission-gate/);
    assert.match(attemptSrc, /FloatingCameraPreview/);
    assert.match(studentRoomSrc, /FloatingCameraPreview/);
  });

  test('4. Faculty Interview Studio reuses QuestionBankPickerModal and supports custom questions', () => {
    assert.match(facultyInterviewsSrc, /QuestionBankPickerModal/);
    assert.match(facultyInterviewsSrc, /btn-pick-from-bank/);
    assert.match(facultyInterviewsSrc, /btn-add-custom-question/);
    assert.match(facultyInterviewsSrc, /CameraProctoringPanel/);
  });

  test('5. InterviewReport enforces role-based visibility split', () => {
    assert.match(reportSrc, /getStudentPerformanceReport/);
    assert.match(reportSrc, /getFacultyReport/);
    assert.match(reportSrc, /isFacultyOrAdmin && \(/);
    assert.match(reportSrc, /behavioral-report-section/);
    assert.match(reportSrc, /transcript-report-section/);
  });

  test('6. Faculty and Student interview rooms extend existing pages with role-separated two-way WebRTC video', () => {
    assert.match(facultySessionSrc, /InterviewVideoRoom/);
    assert.match(facultySessionSrc, /role="faculty"/);
    assert.match(studentRoomSrc, /InterviewVideoRoom/);
    assert.match(studentRoomSrc, /role="student"/);

    // Faculty controls distinguish own media vs student remote controls
    assert.match(videoRoomSrc, /faculty-own-media-controls/);
    assert.match(videoRoomSrc, /btn-faculty-camera-toggle/);
    assert.match(videoRoomSrc, /btn-faculty-mic-toggle/);
    assert.match(videoRoomSrc, /faculty-student-media-controls/);
    assert.match(videoRoomSrc, /btn-student-camera-control/);
    assert.match(videoRoomSrc, /btn-student-mic-control/);
    assert.match(videoRoomSrc, /STUDENT_CAMERA_ENABLE/);
    assert.match(videoRoomSrc, /STUDENT_CAMERA_DISABLE/);
    assert.match(videoRoomSrc, /STUDENT_MIC_ENABLE/);
    assert.match(videoRoomSrc, /STUDENT_MIC_DISABLE/);

    // Student sees locked faculty-controlled status and no interactive toggles
    assert.match(videoRoomSrc, /student-locked-media-status/);
    assert.match(videoRoomSrc, /student-media-disclosure/);

    // Handles connection lifecycle states & stream cleanup
    assert.match(videoRoomSrc, /connecting/);
    assert.match(videoRoomSrc, /connected/);
    assert.match(videoRoomSrc, /reconnecting/);
    assert.match(videoRoomSrc, /disconnected/);
    assert.match(videoRoomSrc, /ended/);
    assert.match(videoRoomSrc, /stopMediaStream/);
    assert.match(mediaUtilSrc, /track\.stop\(\)/);
  });
});
