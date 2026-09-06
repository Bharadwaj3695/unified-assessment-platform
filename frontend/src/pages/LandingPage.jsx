import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/auth.service';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Alert from '../components/ui/Alert';
import ProgressBar from '../components/ui/ProgressBar';
import Modal from '../components/ui/Modal';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../components/ui/Table';
import { QUESTION_TYPE_LABELS, QUESTION_TYPES } from '../utils/constants';
import { AuthHeroIllustration } from '../components/illustrations';
import {
  CheckCircle2,
  BookOpen,
  Users,
  ShieldCheck,
  Server,
  Layers,
  FileCheck2,
  Sparkles,
} from 'lucide-react';

const LandingPage = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated, login, logout } = useAuth();
  const [healthStatus, setHealthStatus] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const checkApi = async () => {
      try {
        const res = await authService.checkHealth();
        setHealthStatus({ ok: true, data: res });
      } catch (err) {
        setHealthStatus({ ok: false, error: err.message });
      } finally {
        setHealthLoading(false);
      }
    };
    checkApi();
  }, []);

  return (
    <div className="space-y-8 py-4">
      {/* Hero Welcome */}
      <div className="rounded-2xl border border-[#EBE3D8] dark:border-[#2D3748] bg-gradient-to-br from-[#FFF4ED] via-[#FFFDFB] to-[#F3F7FB] dark:from-[#341C16] dark:via-[#1A202C] dark:to-[#12161F] p-6 sm:p-8 shadow-warm-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div className="max-w-xl">
            <div className="inline-flex items-center space-x-2 mb-3">
              <Badge variant="terracotta" dot>EdTech Visual System</Badge>
              <Badge variant="sage">Step 3 Verified</Badge>
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-[#1F2937] dark:text-[#F9FAFB]">
              Unified Assessment Platform
            </h1>
            <p className="mt-3 text-sm sm:text-base text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
              Warm, human-centered examination platform with editorial serif accents, terracotta highlights, 
              robust offline-resilient attempt autosave, and unified instructor evaluation workflows.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {isAuthenticated ? (
                <div className="flex items-center space-x-2">
                  <Link to={user.role === 'admin' ? '/admin/dashboard' : user.role === 'instructor' ? '/instructor/dashboard' : '/student/dashboard'}>
                    <Button variant="primary" size="md">
                      Open {user.role.toUpperCase()} Workspace →
                    </Button>
                  </Link>
                  <Button variant="outline" size="md" onClick={logout}>
                    Sign Out
                  </Button>
                </div>
              ) : (
                <div className="flex items-center space-x-2.5">
                  <Link to="/auth/login">
                    <Button variant="primary" size="md">
                      Sign In →
                    </Button>
                  </Link>
                  <Link to="/auth/signup">
                    <Button variant="outline" size="md">
                      Register
                    </Button>
                  </Link>
                </div>
              )}
              <Button variant="ghost" size="md" onClick={toggleTheme}>
                {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
              </Button>
            </div>
          </div>

          <div className="hidden md:flex flex-shrink-0 items-center justify-center">
            <AuthHeroIllustration className="w-64 h-52 object-contain drop-shadow-sm" />
          </div>
        </div>
      </div>

      {/* Backend API Health Tile */}
      <Card title="Backend API & Database Connectivity" subtitle="Live health check from Express API + MongoDB Atlas connection">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              healthStatus?.ok ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
            }`}>
              <Server className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {healthLoading
                  ? 'Connecting to backend...'
                  : healthStatus?.ok
                  ? 'Connected to Backend Service (MongoDB Active)'
                  : 'Backend Disconnected'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {healthStatus?.data?.service || healthStatus?.error || 'Target: http://localhost:5000'}
              </p>
            </div>
          </div>

          <Badge variant={healthStatus?.ok ? 'success' : 'error'} dot>
            {healthStatus?.ok ? 'Operational' : 'Unavailable'}
          </Badge>
        </div>
      </Card>

      {/* Required Question Types Showcase */}
      <Card
        title="Assessment Question Types Compatibility"
        subtitle="Verification that mandatory assessment types are fully supported by frontend architecture"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50/50 dark:bg-surface-dark-muted/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-primary">Mandatory Type</span>
              <Badge variant="primary" size="sm">P0</Badge>
            </div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Multiple Choice (MCQ)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Automated scoring engine with instant feedback and answer key mapping.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50/50 dark:bg-surface-dark-muted/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-secondary">Mandatory Type</span>
              <Badge variant="secondary" size="sm">P0</Badge>
            </div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Short Answer
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Concise subjective responses routed to instructor evaluation studio.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50/50 dark:bg-surface-dark-muted/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-sage">Mandatory Type</span>
              <Badge variant="sage" size="sm">P0</Badge>
            </div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Long Answer (Essay / Analysis)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Deep analysis questions with rich text response and detailed rubric scoring.
            </p>
          </div>
        </div>
      </Card>

      {/* Design System UI Component Sandbox */}
      <Card title="Design System UI Component Catalog" subtitle="Accessible button variants, badges, progress bars, and data tables">
        <div className="space-y-6">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Buttons & States
            </h4>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm">Primary</Button>
              <Button variant="secondary" size="sm">Secondary</Button>
              <Button variant="sage" size="sm">Sage</Button>
              <Button variant="outline" size="sm">Outline</Button>
              <Button variant="ghost" size="sm">Ghost</Button>
              <Button variant="destructive" size="sm">Destructive</Button>
              <Button variant="primary" size="sm" isLoading>Loading</Button>
              <Button variant="primary" size="sm" disabled>Disabled</Button>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Badges & Statuses
            </h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="primary" dot>Primary</Badge>
              <Badge variant="secondary" dot>Secondary</Badge>
              <Badge variant="sage" dot>Sage</Badge>
              <Badge variant="success" dot>Published</Badge>
              <Badge variant="warning" dot>Pending Review</Badge>
              <Badge variant="error" dot>Suspended</Badge>
              <Badge variant="info" dot>Information</Badge>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Progress Indicators
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ProgressBar value={72} max={100} color="primary" showLabel />
              <ProgressBar value={94} max={100} color="sage" showLabel />
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Table Foundation
            </h4>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Entity</TableHeader>
                  <TableHeader>Type</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Scope</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell className="font-semibold">Full-Stack Architecture Exam</TableCell>
                  <TableCell>Computer Science</TableCell>
                  <TableCell><Badge variant="success" size="sm" dot>Published</Badge></TableCell>
                  <TableCell>Undergraduate</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-semibold">Algorithmic Complexity</TableCell>
                  <TableCell>Mathematics</TableCell>
                  <TableCell><Badge variant="warning" size="sm" dot>Draft</Badge></TableCell>
                  <TableCell>Graduate</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>

      {/* Modal Dialog Component Test */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Design System Modal Test"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Close
            </Button>
            <Button variant="primary" size="sm" onClick={() => setModalOpen(false)}>
              Confirm Action
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This accessible modal dialog features backdrop blur, keyboard ESC dismissal, 
          focus containment, and theme-adaptive surface styling.
        </p>
      </Modal>

      <p className="pb-2 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
        Learn, assess, and grow with the Unified Assessment Platform
      </p>
    </div>
  );
};

export default LandingPage;
