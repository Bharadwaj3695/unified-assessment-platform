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

describe('1. Persistent Announcement Model & Backend Contracts', () => {
  test('1.1 Announcement schema enforces lifecycle enum, duration tracking, and composite indexes', () => {
    const modelSrc = readProjectFile('backend/src/models/Announcement.js');
    assert.match(modelSrc, /enum:\s*\['draft',\s*'scheduled',\s*'published',\s*'expired',\s*'cancelled'\]/, 'Must enforce all 5 lifecycle states');
    assert.match(modelSrc, /startDate:\s*\{[\s\S]*?type:\s*Date/, 'Must have UTC startDate');
    assert.match(modelSrc, /expiryDate:\s*\{[\s\S]*?type:\s*Date/, 'Must have UTC expiryDate');
    assert.match(modelSrc, /durationDays:\s*\{[\s\S]*?type:\s*Number/, 'Must track durationDays');
    assert.match(modelSrc, /durationHours:\s*\{[\s\S]*?type:\s*Number/, 'Must track durationHours');
    assert.match(modelSrc, /durationMinutes:\s*\{[\s\S]*?type:\s*Number/, 'Must track durationMinutes');
    assert.match(modelSrc, /targetAudience:\s*\{[\s\S]*?enum:\s*\['all',\s*'students',\s*'instructors',\s*'admins'\]/, 'Must support audience scoping');
    assert.match(modelSrc, /announcementSchema\.index\(\{\s*status:\s*1,\s*startDate:\s*1,\s*expiryDate:\s*1\s*\}\)/, 'Must have compound index for active window querying');
  });

  test('1.2 Announcement model is registered in backend models index', () => {
    const indexSrc = readProjectFile('backend/src/models/index.js');
    assert.match(indexSrc, /const\s+Announcement\s*=\s*require\('\.\/Announcement'\)/, 'Must import Announcement model');
    assert.match(indexSrc, /Announcement,/, 'Must export Announcement model');
  });

  test('1.3 Announcement service enforces server-side time, sanitization, and audit logging', () => {
    const serviceSrc = readProjectFile('backend/src/services/announcement.service.js');
    assert.match(serviceSrc, /getActiveAnnouncement/, 'Must implement getActiveAnnouncement');
    assert.match(serviceSrc, /publishImmediate/, 'Must implement publishImmediate');
    assert.match(serviceSrc, /scheduleAnnouncement/, 'Must implement scheduleAnnouncement');
    assert.match(serviceSrc, /saveDraft/, 'Must implement saveDraft');
    assert.match(serviceSrc, /cancelAnnouncement/, 'Must implement cancelAnnouncement');
    assert.match(serviceSrc, /deriveEffectiveStatus/, 'Must implement deriveEffectiveStatus');
    assert.match(serviceSrc, /SystemSetting\.findOneAndUpdate/, 'Must mirror to SystemSetting for backward compatibility');
    assert.match(serviceSrc, /AuditLog\.create/, 'Must record immutable audit logs');
  });

  test('1.4 Announcement routes are mounted in app.js and admin.routes.js', () => {
    const appSrc = readProjectFile('backend/src/app.js');
    assert.match(appSrc, /require\('\.\/routes\/announcement\.routes'\)/, 'Must import announcement routes');
    assert.match(appSrc, /app\.use\('\/api\/announcements',\s*announcementRoutes\)/, 'Must mount announcement routes');

    const adminRoutesSrc = readProjectFile('backend/src/routes/admin.routes.js');
    assert.match(adminRoutesSrc, /\/announcements\/current/, 'Must define current announcement route');
    assert.match(adminRoutesSrc, /\/announcements\/draft/, 'Must define draft route');
    assert.match(adminRoutesSrc, /\/announcements\/publish/, 'Must define publish route');
    assert.match(adminRoutesSrc, /\/announcements\/schedule/, 'Must define schedule route');
    assert.match(adminRoutesSrc, /\/announcements\/cancel/, 'Must define cancel route');
  });
});

describe('2. Accessible Scrolling Marquee Banner Contract', () => {
  test('2.1 NavbarAnnouncementTicker implements semantic accessibility and session dismissal', () => {
    const tickerSrc = readProjectFile('frontend/src/components/common/NavbarAnnouncementTicker.jsx');
    assert.match(tickerSrc, /role="region"/, 'Ticker must have role="region"');
    assert.match(tickerSrc, /aria-label="Platform Announcement"/, 'Ticker must have aria-label="Platform Announcement"');
    assert.match(tickerSrc, /sessionStorage\.setItem\(`uap_dismissed_announcement_/, 'Dismissal must be stored in sessionStorage per item');
    assert.match(tickerSrc, /setTimeout\(/, 'Must schedule auto-hide timer for expiryDate');
    assert.match(tickerSrc, /if\s*\(!announcement\s*\|\|\s*isDismissed\)\s*\{\s*return\s+null;\s*\}/, 'Zero layout shift when inactive or dismissed');
  });

  test('2.2 CSS globals support smooth marquee, pause-on-hover, and prefers-reduced-motion', () => {
    const cssSrc = readProjectFile('frontend/src/styles/globals.css');
    assert.match(cssSrc, /@keyframes marquee-scroll/, 'Must define @keyframes marquee-scroll');
    assert.match(cssSrc, /\.animate-marquee/, 'Must define .animate-marquee');
    assert.match(cssSrc, /\.pause-on-hover:hover/, 'Must pause animation on hover');
    assert.match(cssSrc, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'Must respect prefers-reduced-motion media query');
  });

  test('2.3 Header mounts NavbarAnnouncementTicker in global navbar between brand logo and search', () => {
    const headerSrc = readProjectFile('frontend/src/components/common/Header.jsx');
    assert.match(headerSrc, /import\s+NavbarAnnouncementTicker\s+from\s+'\.\/NavbarAnnouncementTicker'/, 'Header must import NavbarAnnouncementTicker');
    assert.match(headerSrc, /Unified Assessment[\s\S]*?<NavbarAnnouncementTicker\s*\/>[\s\S]*?<PortalSearchBar/, 'NavbarAnnouncementTicker must be positioned between Brand and PortalSearchBar');
    const layoutSrc = readProjectFile('frontend/src/layouts/MainLayout.jsx');
    assert.doesNotMatch(layoutSrc, /<AnnouncementBanner\s*\/>/, 'MainLayout must not mount separate banner under Header');
  });
});

describe('3. Admin Announcement Management Panel Contract', () => {
  test('3.1 AnnouncementEditorSection provides full scheduling, duration, preview, and lifecycle controls', () => {
    const editorSrc = readProjectFile('frontend/src/components/admin/AnnouncementEditorSection.jsx');
    assert.match(editorSrc, /Live Scrolling Banner Preview/, 'Must display live banner preview');
    assert.match(editorSrc, /Announcement Message/, 'Must have message textarea');
    assert.match(editorSrc, /500/, 'Must enforce 500 max length');
    assert.match(editorSrc, /Publication Mode/, 'Must support immediate and scheduled publication modes');
    assert.match(editorSrc, /datetime-local/, 'Must have datetime-local input for scheduling');
    assert.match(editorSrc, /durationDays/, 'Must provide durationDays control');
    assert.match(editorSrc, /durationHours/, 'Must provide durationHours control');
    assert.match(editorSrc, /durationMinutes/, 'Must provide durationMinutes control');
    assert.match(editorSrc, /Calculated Expiration Time:/, 'Must display live calculated expiration confirmation');
    assert.match(editorSrc, /Save Draft/, 'Must have Save Draft action');
    assert.match(editorSrc, /Publish Announcement/, 'Must have Publish action');
    assert.match(editorSrc, /Schedule Announcement/, 'Must have Schedule action');
    assert.match(editorSrc, /Cancel Announcement/, 'Must have Cancel action for active announcements');
  });

  test('3.2 Admin Dashboard integrates AnnouncementEditorSection and synchronizes settings form', () => {
    const dashboardSrc = readProjectFile('frontend/src/pages/admin/Dashboard.jsx');
    assert.match(dashboardSrc, /import AnnouncementEditorSection from '\.\.\/\.\.\/components\/admin\/AnnouncementEditorSection'/, 'Dashboard must import AnnouncementEditorSection');
    assert.match(dashboardSrc, /<AnnouncementEditorSection[\s\S]*?initialMessage=\{settingsForm\.announcementBanner\}/, 'Must mount AnnouncementEditorSection with message sync');
  });

  test('3.3 Announcement service handles canonical /announcements and /admin/announcements endpoints seamlessly', () => {
    const serviceSrc = readProjectFile('frontend/src/services/announcement.service.js');
    assert.match(serviceSrc, /\/announcements\/publish/, 'Must call /announcements/publish');
    assert.match(serviceSrc, /\/announcements\/draft/, 'Must call /announcements/draft');
    assert.match(serviceSrc, /\/announcements\/schedule/, 'Must call /announcements/schedule');
    assert.match(serviceSrc, /\/announcements\/cancel/, 'Must call /announcements/cancel');
    assert.match(serviceSrc, /\/announcements\/current/, 'Must call /announcements/current');
    assert.match(serviceSrc, /\/announcements\/active/, 'Must call /announcements/active');
    assert.match(serviceSrc, /\/admin\/announcements\/publish/, 'Must support fallback to /admin/announcements/publish');
  });

  test('3.4 Shared display across Student, Instructor, Admin, and Public layouts', () => {
    const studentLayoutSrc = readProjectFile('frontend/src/layouts/StudentLayout.jsx');
    const instructorLayoutSrc = readProjectFile('frontend/src/layouts/InstructorLayout.jsx');
    const adminLayoutSrc = readProjectFile('frontend/src/layouts/AdminLayout.jsx');
    const publicLayoutSrc = readProjectFile('frontend/src/layouts/PublicLayout.jsx');
    assert.match(studentLayoutSrc, /<MainLayout/, 'StudentLayout must mount MainLayout');
    assert.match(instructorLayoutSrc, /<MainLayout/, 'InstructorLayout must mount MainLayout');
    assert.match(adminLayoutSrc, /<MainLayout/, 'AdminLayout must mount MainLayout');
    assert.match(publicLayoutSrc, /<MainLayout/, 'PublicLayout must mount MainLayout');
  });

  test('3.5 Navbar layout protects Brand and Search controls with flex-shrink-0', () => {
    const headerSrc = readProjectFile('frontend/src/components/common/Header.jsx');
    assert.match(headerSrc, /flex items-center space-x-1\.5 xs:space-x-2 sm:space-x-3 min-w-0 flex-shrink-0/, 'Brand container must have flex-shrink-0');
    assert.match(headerSrc, /flex items-center space-x-1 xs:space-x-2 sm:space-x-3 flex-shrink-0/, 'Right controls container must have flex-shrink-0');
  });
});

describe('4. Loading States, Error Handling & 404 Resilience Contract', () => {
  test('4.1 AnnouncementEditorSection handles loading states, spinners, and button state in finally', () => {
    const editorSrc = readProjectFile('frontend/src/components/admin/AnnouncementEditorSection.jsx');
    assert.match(editorSrc, /isAnyActionLoading\s*=\s*isSavingDraft\s*\|\|\s*isPublishing\s*\|\|\s*isScheduling\s*\|\|\s*isCancelling/, 'Must track composite action loading state');
    assert.match(editorSrc, /disabled=\{isAnyActionLoading\}/, 'Must disable duplicate submissions across all action buttons');
    assert.match(editorSrc, /loadingText="Publishing\.\.\."/, 'Must display meaningful loading text while publishing');
    assert.match(editorSrc, /loadingText="Saving Draft\.\.\."/, 'Must display meaningful loading text while saving draft');
    assert.match(editorSrc, /loadingText="Scheduling\.\.\."/, 'Must display meaningful loading text while scheduling');
    assert.match(editorSrc, /finally\s*\{[\s\S]*?setIsPublishing\(false\)/, 'Must reset publishing state in finally');
    assert.match(editorSrc, /finally\s*\{[\s\S]*?setIsSavingDraft\(false\)/, 'Must reset saving draft state in finally');
  });

  test('4.2 404 error handler provides helpful diagnostic message and preserves validation errors', () => {
    const editorSrc = readProjectFile('frontend/src/components/admin/AnnouncementEditorSection.jsx');
    assert.match(editorSrc, /err\.status\s*===\s*404\s*\|\|\s*err\.response\?\.status\s*===\s*404/, 'Must detect 404 status');
    assert.match(editorSrc, /Announcement service endpoint was not found \(404\)/, 'Must provide helpful 404 message without raw stack traces');
    assert.match(editorSrc, /err\.errors/, 'Must inspect backend field validation errors');
  });
});

describe('5. System Settings & Regression Verification', () => {
  test('5.1 SystemSetting model retains announcementBanner schema field', () => {
    const settingModelSrc = readProjectFile('backend/src/models/SystemSetting.js');
    assert.match(settingModelSrc, /announcementBanner:\s*\{[\s\S]*?type:\s*String/, 'SystemSetting must maintain announcementBanner field');
  });

  test('5.2 Navbar layout preserves all key interactive controls', () => {
    const headerSrc = readProjectFile('frontend/src/components/common/Header.jsx');
    assert.match(headerSrc, /PortalSearchBar/, 'PortalSearchBar must remain present in Header');
    assert.match(headerSrc, /toggleTheme/, 'Theme toggle must remain functional');
    assert.match(headerSrc, /NotificationPopover/, 'NotificationPopover must remain functional');
  });
});
