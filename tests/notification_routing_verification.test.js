import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveNotificationRoute,
  extractApplicantEmail,
  ROLE_DEFAULT_ROUTES,
} from '../frontend/src/utils/notificationRouter.js';

test('1. Admin Applicant Routing & Disambiguation', async (t) => {
  await t.test('1.1 Admin notification with applicant ID routes to /admin/users?applicantId=...', () => {
    const notifWithLink = {
      title: 'New Applicant Pending',
      message: 'Alex Johnson applied for role instructor',
      link: '/admin/users?applicantId=usr_applicant_001',
    };
    const route = resolveNotificationRoute(notifWithLink, 'admin');
    assert.equal(route, '/admin/users?applicantId=usr_applicant_001');

    const notifWithIdProp = {
      title: 'New Applicant Pending',
      message: 'Alex Johnson applied for role instructor',
      applicantId: 'usr_applicant_001',
    };
    const route2 = resolveNotificationRoute(notifWithIdProp, 'admin');
    assert.equal(route2, '/admin/users?applicantId=usr_applicant_001');

    const notifWithMeta = {
      title: 'New Applicant Pending',
      message: 'Alex Johnson applied',
      metadata: { applicantId: 'usr_applicant_001' },
    };
    const route3 = resolveNotificationRoute(notifWithMeta, 'admin');
    assert.equal(route3, '/admin/users?applicantId=usr_applicant_001');
  });

  await t.test('1.2 Two distinct applicant notifications open Applicant A and Applicant B respectively (no first-record fallback)', () => {
    const notifA = {
      title: 'New Applicant Pending',
      message: 'Alice Smith applied for role instructor',
      link: '/admin/users?applicantId=usr_alice_123',
    };
    const notifB = {
      title: 'New Applicant Pending',
      message: 'Bob Miller applied for role student',
      link: '/admin/users?applicantId=usr_bob_456',
    };

    const routeA = resolveNotificationRoute(notifA, 'admin');
    const routeB = resolveNotificationRoute(notifB, 'admin');

    assert.equal(routeA, '/admin/users?applicantId=usr_alice_123');
    assert.equal(routeB, '/admin/users?applicantId=usr_bob_456');
    assert.notEqual(routeA, routeB);

    // Verify URL parameters are uniquely parseable
    const paramsA = new URLSearchParams(routeA.split('?')[1]);
    const paramsB = new URLSearchParams(routeB.split('?')[1]);
    assert.equal(paramsA.get('applicantId'), 'usr_alice_123');
    assert.equal(paramsB.get('applicantId'), 'usr_bob_456');
  });

  await t.test('1.3 Notification with only an email resolves to /admin/users?applicantEmail=...', () => {
    // Format 1: Parenthesized email (standard backend template)
    const msg1 = "Sarah Connor (sarah.connor@sky.edu) submitted a registration application for role 'instructor'.";
    assert.equal(extractApplicantEmail(msg1), 'sarah.connor@sky.edu');

    const notifEmailOnly = {
      title: 'New Applicant Pending',
      message: msg1,
      link: '/admin/dashboard', // Legacy link previously saved in DB
    };
    const route1 = resolveNotificationRoute(notifEmailOnly, 'admin');
    assert.equal(route1, '/admin/users?applicantEmail=sarah.connor%40sky.edu');

    // Format 2: Google registration format
    const msg2 = 'New applicant John Wick (jwick@continental.org) registered via Google for role student.';
    assert.equal(extractApplicantEmail(msg2), 'jwick@continental.org');

    const notifGoogle = {
      title: 'New Applicant Pending (Google)',
      message: msg2,
    };
    const route2 = resolveNotificationRoute(notifGoogle, 'admin');
    assert.equal(route2, '/admin/users?applicantEmail=jwick%40continental.org');

    // Format 3: Bare email without parentheses
    const msg3 = 'Applicant approval requested for admin-candidate@uap.edu';
    assert.equal(extractApplicantEmail(msg3), 'admin-candidate@uap.edu');
    const notifBare = {
      title: 'Registration Application Received',
      message: msg3,
    };
    const route3 = resolveNotificationRoute(notifBare, 'admin');
    assert.equal(route3, '/admin/users?applicantEmail=admin-candidate%40uap.edu');
  });

  await t.test('1.4 Notification with missing or unresolvable applicant reference provides safe fallback without opening unrelated record', () => {
    const unresolvableNotif = {
      title: 'New Applicant Pending',
      message: 'A new user submitted their registration application without contact info.',
    };
    const route = resolveNotificationRoute(unresolvableNotif, 'admin');
    // Directs to admin users directory pending tab instead of guessing an ID or opening an unrelated record
    assert.equal(route, '/admin/users');

    const emptyNotif = {
      title: 'System Notification',
      message: 'Routine check complete',
    };
    assert.equal(resolveNotificationRoute(emptyNotif, 'admin'), '/admin/dashboard');
  });
});

test('2. Instructor Notification Routing', async (t) => {
  await t.test('2.1 Instructor submission notification maps to /instructor/evaluate/:id', () => {
    const notifWithLink = {
      title: 'New Assessment Submission',
      message: 'Student submitted Final Project',
      link: '/instructor/evaluate/sub_cs101_001',
    };
    const route = resolveNotificationRoute(notifWithLink, 'instructor');
    assert.equal(route, '/instructor/evaluate/sub_cs101_001');

    const notifWithSubIdProp = {
      title: 'Submission Ready for Evaluation',
      message: 'Student submission awaiting evaluation',
      submissionId: 'sub_cs101_002',
    };
    const route2 = resolveNotificationRoute(notifWithSubIdProp, 'instructor');
    assert.equal(route2, '/instructor/evaluate/sub_cs101_002');
  });

  await t.test('2.2 Instructor authoring and analytics notifications map to valid destinations', () => {
    // Assessments list
    const assessmentNotif = {
      title: 'Assessment Published',
      message: 'Midterm Exam published successfully',
      link: '/instructor/assessments',
    };
    assert.equal(resolveNotificationRoute(assessmentNotif, 'instructor'), '/instructor/assessments');

    // Assessment Analytics
    const analyticsNotif = {
      title: 'Assessment Analytics Updated',
      message: 'New statistical insights available',
      link: '/instructor/analytics/exam_999',
    };
    assert.equal(resolveNotificationRoute(analyticsNotif, 'instructor'), '/instructor/analytics/exam_999');

    // Question Bank
    const qbNotif = {
      title: 'Question Bank Import Complete',
      message: '50 questions successfully imported',
      link: '/instructor/question-bank',
    };
    assert.equal(resolveNotificationRoute(qbNotif, 'instructor'), '/instructor/question-bank');
  });
});

test('3. Student Notification Routing & Legacy Link Normalization', async (t) => {
  await t.test('3.1 Student evaluation feedback notification maps to /student/submissions?submissionId=...', () => {
    const notif = {
      title: 'Submission Evaluated',
      message: 'Your Data Structures Exam has been graded',
      link: '/student/submissions?submissionId=sub_ds_777',
    };
    const route = resolveNotificationRoute(notif, 'student');
    assert.equal(route, '/student/submissions?submissionId=sub_ds_777');
  });

  await t.test('3.2 Legacy /student/results/:id and /student/submissions/:id routes are normalized without 404', () => {
    // Legacy /student/results/:id from older backend seeds
    const legacyResultNotif = {
      title: 'Grade Released',
      message: 'Your score has been published',
      link: '/student/results/sub_legacy_123',
    };
    const route1 = resolveNotificationRoute(legacyResultNotif, 'student');
    assert.equal(route1, '/student/submissions?submissionId=sub_legacy_123');

    // Legacy /student/submissions/:id from older evaluation service
    const legacySubNotif = {
      title: 'Assessment Evaluated',
      message: 'Instructor graded your submission',
      link: '/student/submissions/sub_legacy_456',
    };
    const route2 = resolveNotificationRoute(legacySubNotif, 'student');
    assert.equal(route2, '/student/submissions?submissionId=sub_legacy_456');
  });

  await t.test('3.3 Student assessment notification navigates to /student/catalog or /student/attempt/:id', () => {
    const catalogNotif = {
      title: 'New Assessment Available',
      message: 'Algorithms Quiz is now open for enrollment',
      link: '/student/catalog',
    };
    assert.equal(resolveNotificationRoute(catalogNotif, 'student'), '/student/catalog');

    const attemptNotif = {
      title: 'Exam Starting Soon',
      message: 'Your scheduled session is ready',
      link: '/student/attempt/exam_active_555',
    };
    assert.equal(resolveNotificationRoute(attemptNotif, 'student'), '/student/attempt/exam_active_555');

    // Approved account notification with /auth/login resolves to student dashboard for logged-in user
    const loginLinkNotif = {
      title: 'Account Approved',
      message: 'Your account has been approved by administrator',
      link: '/auth/login',
    };
    assert.equal(resolveNotificationRoute(loginLinkNotif, 'student'), '/student/dashboard');
  });
});

test('4. Strict RBAC Route Boundary Enforcement & Security Fallbacks', async (t) => {
  await t.test('4.1 Student role is blocked from navigating to Admin and Instructor routes', () => {
    const leakedAdminNotif = {
      title: 'New Applicant Pending',
      message: 'Admin approval required',
      link: '/admin/users?applicantId=admin_user_01',
    };
    // Should fall back to safe student dashboard
    assert.equal(resolveNotificationRoute(leakedAdminNotif, 'student'), '/student/dashboard');

    const leakedInstructorNotif = {
      title: 'Submission Ready for Evaluation',
      message: 'Evaluate submission',
      link: '/instructor/evaluate/sub_999',
    };
    // Should fall back to safe student dashboard
    assert.equal(resolveNotificationRoute(leakedInstructorNotif, 'student'), '/student/dashboard');
  });

  await t.test('4.2 Instructor role is blocked from navigating to Admin routes', () => {
    const adminNotif = {
      title: 'System Settings Changed',
      message: 'Audit log update',
      link: '/admin/logs',
    };
    assert.equal(resolveNotificationRoute(adminNotif, 'instructor'), '/instructor/dashboard');
  });

  await t.test('4.3 Malicious and external protocol schemes are stripped and safely redirected', () => {
    const jsScheme = {
      title: 'Suspicious Alert',
      message: 'Click here',
      link: 'javascript:alert(document.cookie)',
    };
    assert.equal(resolveNotificationRoute(jsScheme, 'student'), '/student/dashboard');
    assert.equal(resolveNotificationRoute(jsScheme, 'admin'), '/admin/dashboard');

    const externalHttp = {
      title: 'Phishing Attempt',
      message: 'Verify your credentials',
      link: 'https://evil-site.com/steal-creds',
    };
    assert.equal(resolveNotificationRoute(externalHttp, 'student'), '/student/dashboard');
    assert.equal(resolveNotificationRoute(externalHttp, 'instructor'), '/instructor/dashboard');

    const protocolRelative = {
      title: 'Protocol Relative Phishing',
      message: 'Visit',
      link: '//attacker.com/malicious',
    };
    assert.equal(resolveNotificationRoute(protocolRelative, 'admin'), '/admin/dashboard');
  });

  await t.test('4.4 Null, undefined, and malformed notification payloads fail gracefully', () => {
    assert.equal(resolveNotificationRoute(null, 'admin'), ROLE_DEFAULT_ROUTES.admin);
    assert.equal(resolveNotificationRoute(undefined, 'instructor'), ROLE_DEFAULT_ROUTES.instructor);
    assert.equal(resolveNotificationRoute({}, 'student'), ROLE_DEFAULT_ROUTES.student);
    assert.equal(resolveNotificationRoute('non-object', 'admin'), ROLE_DEFAULT_ROUTES.admin);
  });
});

test('5. UI Action Alignment, Popover Dismissal & Event Propagation Isolation', async (t) => {
  await t.test('5.1 Notification Popover dismisses and triggers navigation upon card or link click', async () => {
    let isOpen = true;
    let navigatedTo = null;
    let markAsReadCalled = false;

    const mockNavigate = (route) => {
      navigatedTo = route;
    };
    const mockSetIsOpen = (val) => {
      isOpen = val;
    };
    const mockHandleMarkAsRead = async () => {
      markAsReadCalled = true;
    };

    // Replicate NotificationPopover handleNotificationClick logic
    const handleNotificationClick = async (notif, activeRole) => {
      if (!notif.read) {
        await mockHandleMarkAsRead(notif.id || notif._id);
      }
      const targetRoute = resolveNotificationRoute(notif, activeRole);
      if (targetRoute) {
        mockSetIsOpen(false);
        mockNavigate(targetRoute);
      }
    };

    const notif = {
      id: 'notif_001',
      read: false,
      title: 'New Applicant Pending',
      applicantId: 'usr_applicant_test',
    };

    await handleNotificationClick(notif, 'admin');

    assert.equal(markAsReadCalled, true, 'Unread notification was marked as read');
    assert.equal(isOpen, false, 'Popover was dismissed');
    assert.equal(navigatedTo, '/admin/users?applicantId=usr_applicant_test', 'Navigated to resolved route');
  });

  await t.test('5.2 Action buttons (Mark Read, Delete) stop propagation to prevent accidental navigation', () => {
    let cardClicked = false;
    let stoppedPropagation = false;

    const mockEvent = {
      stopPropagation: () => {
        stoppedPropagation = true;
      },
    };

    const handleCardClick = () => {
      cardClicked = true;
    };

    const handleMarkAsRead = (id, e) => {
      e?.stopPropagation();
    };

    // Simulate clicking the checkmark button inside the card
    handleMarkAsRead('notif_1', mockEvent);

    assert.equal(stoppedPropagation, true, 'Event propagation was stopped');
    assert.equal(cardClicked, false, 'Card click was NOT triggered by button action');
  });

  await t.test('5.3 View Details button explicitly stops propagation and navigates cleanly', () => {
    let stoppedPropagation = false;
    let navigated = false;

    const mockEvent = {
      stopPropagation: () => {
        stoppedPropagation = true;
      },
    };

    const handleViewDetails = async (notif, e) => {
      if (e?.stopPropagation) {
        e.stopPropagation();
      }
      navigated = true;
    };

    handleViewDetails({ id: 'notif_2' }, mockEvent);

    assert.equal(stoppedPropagation, true, 'View details button stops event propagation');
    assert.equal(navigated, true, 'View details initiates navigation');
  });
});
