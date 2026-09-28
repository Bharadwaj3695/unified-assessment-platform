import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/auth.service';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { AuthHeroIllustration } from '../components/illustrations';
import {
  BookOpen,
  Database,
  UploadCloud,
  ShieldCheck,
  FileCheck2,
  FileText,
  TrendingUp,
  Award,
  ArrowRight,
  CheckCircle2,
  Lock,
  Layers,
  Sparkles,
  Users,
  Eye,
  Clock,
  Flame,
  GraduationCap,
  ShieldAlert,
  Server,
  Activity,
} from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const [healthStatus, setHealthStatus] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);

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

  const getWorkspacePath = (role) => {
    if (role === 'admin') return '/admin/dashboard';
    if (role === 'instructor') return '/instructor/dashboard';
    return '/student/dashboard';
  };

  return (
    <div className="space-y-10 sm:space-y-12 lg:space-y-14 py-2">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden rounded-3xl border border-surface-light-border dark:border-surface-dark-border bg-gradient-to-br from-[#FFF4ED] via-[#FFFDFB] to-[#F3F7FB] dark:from-[#341C16] dark:via-[#1A202C] dark:to-[#12161F] p-6 sm:p-8 lg:p-10 shadow-warm-sm">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center space-x-2">
              <Badge variant="terracotta" dot>
                Production-Grade Academic Assessment
              </Badge>
              <Badge variant="sage">
                Verified Architecture
              </Badge>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
              Assessments built for learning, evaluation, and performance.
            </h1>

            <p className="text-sm sm:text-base lg:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              An integrated examination suite engineered for modern academia. UAP brings question authoring, 
              intelligent document imports, tamper-resilient proctored delivery, rubric-based evaluation, 
              and performance analytics into one unified platform.
            </p>

            {isAuthenticated && user ? (
              <div className="p-4 rounded-2xl bg-white/80 dark:bg-surface-dark/80 border border-surface-light-border dark:border-surface-dark-border backdrop-blur-xs space-y-3">
                <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>Signed in as</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{user.name}</span>
                  <Badge variant={user.role === 'instructor' ? 'sage' : user.role === 'admin' ? 'terracotta' : 'peach'} size="sm" className="uppercase">
                    {user.role}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link to={getWorkspacePath(user.role)}>
                    <Button variant="primary" size="md" icon={ArrowRight}>
                      Open {user.role.toUpperCase()} Workspace
                    </Button>
                  </Link>
                  <Button variant="outline" size="md" onClick={logout}>
                    Sign Out
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link to="/auth/signup">
                  <Button variant="primary" size="lg" icon={ArrowRight}>
                    Get Started
                  </Button>
                </Link>
                <a href="#features">
                  <Button variant="outline" size="lg">
                    Explore Features
                  </Button>
                </a>
                <Link to="/auth/login">
                  <Button variant="ghost" size="lg">
                    Sign In →
                  </Button>
                </Link>
              </div>
            )}

            {/* Quick Metrics Strip */}
            <div className="pt-4 border-t border-surface-light-border/60 dark:border-surface-dark-border/60 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <span className="block text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-slate-100">
                  4 Formats
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  MCQ, Short, Long, File
                </span>
              </div>
              <div>
                <span className="block text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-slate-100">
                  0-Latency
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Automated MCQ Scoring
                </span>
              </div>
              <div>
                <span className="block text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-slate-100">
                  100% Synced
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Offline-Resilient Autosave
                </span>
              </div>
              <div>
                <span className="block text-xl sm:text-2xl font-bold font-display text-slate-900 dark:text-slate-100">
                  3 Workspaces
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Student, Faculty, Admin
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
            <div className="relative w-full max-w-md">
              <AuthHeroIllustration className="w-full h-auto max-h-72 object-contain drop-shadow-md" />
              
              {/* Floating Snapshot Card 1 */}
              <div className="absolute -bottom-4 -left-2 sm:left-4 p-3.5 rounded-2xl bg-white/95 dark:bg-surface-dark/95 border border-surface-light-border dark:border-surface-dark-border shadow-warm-md backdrop-blur-md max-w-[210px] hidden sm:block">
                <div className="flex items-center space-x-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    Proctoring Active
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                  Browser telemetry & focus monitoring engaged
                </p>
              </div>

              {/* Floating Snapshot Card 2 */}
              <div className="absolute -top-3 -right-2 sm:right-2 p-3 rounded-2xl bg-white/95 dark:bg-surface-dark/95 border border-surface-light-border dark:border-surface-dark-border shadow-warm-md backdrop-blur-md max-w-[190px] hidden sm:block">
                <div className="flex items-center space-x-1.5 mb-1">
                  <Badge variant="sage" size="sm">Rubric Scoring</Badge>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                  Side-by-side faculty evaluation ready
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. PLATFORM FEATURES SECTION */}
      <section id="features" className="space-y-8 scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <Badge variant="terracotta" dot>
            Core Capabilities
          </Badge>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-slate-900 dark:text-slate-100">
            Comprehensive assessment tools built for rigorous academic standards.
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            Every feature is purposefully integrated into the platform workflow, from question banking and anti-cheat proctoring to rubric grading and longitudinal student trends.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Feature 1 */}
          <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-5 shadow-warm-xs hover:shadow-warm-sm transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-brand-terracotta/10 text-brand-terracotta dark:bg-brand-terracotta/20 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-terracotta">
                  Assessment Management
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  Lifecycle & Scheduling
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Configure flexible examination windows, enforce access codes, randomize question sequences, and monitor concurrent attempts with live countdown timers.
              </p>
            </div>
            <div className="pt-3 mt-3 border-t border-surface-light-border/60 dark:border-surface-dark-border/60">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-sage" />
                <span>Enrolled cohort controls</span>
              </span>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-5 shadow-warm-xs hover:shadow-warm-sm transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-brand-peach/15 text-brand-peach dark:bg-brand-peach/25 flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-peach">
                  Question Repository
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  Centralized Question Bank
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Curate institutional question repositories organized by subject, difficulty, and Bloom's taxonomy with full revision versioning and randomized pool generation.
              </p>
            </div>
            <div className="pt-3 mt-3 border-t border-surface-light-border/60 dark:border-surface-dark-border/60">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-sage" />
                <span>Revision history & versioning</span>
              </span>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-5 shadow-warm-xs hover:shadow-warm-sm transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-brand-sage/15 text-brand-sage dark:bg-brand-sage/25 flex items-center justify-center">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-sage">
                  Intelligent Ingestion
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  Intelligent Question Import
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Batch-ingest questions directly from PDF, DOCX, and DOC documents or Google Forms with automated structure parsing and AI classification suggestions.
              </p>
            </div>
            <div className="pt-3 mt-3 border-t border-surface-light-border/60 dark:border-surface-dark-border/60">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-sage" />
                <span>Interactive draft review</span>
              </span>
            </div>
          </div>

          {/* Feature 4 */}
          <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-5 shadow-warm-xs hover:shadow-warm-sm transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:bg-red-500/20 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                  Integrity Telemetry
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  Tamper-Resilient Proctoring
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Active browser telemetry tracking tab switches, window blur events, clipboard actions, and webcam presence with automated incident logging.
              </p>
            </div>
            <div className="pt-3 mt-3 border-t border-surface-light-border/60 dark:border-surface-dark-border/60">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-sage" />
                <span>Real-time proctor logs</span>
              </span>
            </div>
          </div>

          {/* Feature 5 */}
          <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-5 shadow-warm-xs hover:shadow-warm-sm transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-brand-terracotta/10 text-brand-terracotta dark:bg-brand-terracotta/20 flex items-center justify-center">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-terracotta">
                  Grading Studio
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  Automated & Rubric Scoring
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Zero-latency auto-scoring for multiple choice assessments combined with side-by-side faculty rubric evaluation for essays and coding prompts.
              </p>
            </div>
            <div className="pt-3 mt-3 border-t border-surface-light-border/60 dark:border-surface-dark-border/60">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-sage" />
                <span>Instant feedback channels</span>
              </span>
            </div>
          </div>

          {/* Feature 6 */}
          <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-5 shadow-warm-xs hover:shadow-warm-sm transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-brand-peach/15 text-brand-peach dark:bg-brand-peach/25 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-peach">
                  Document Submissions
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  PDF & Google Docs Uploads
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Direct student uploads for PDF and DOCX reports as well as live Google Docs integration with in-browser preview and faculty feedback annotations.
              </p>
            </div>
            <div className="pt-3 mt-3 border-t border-surface-light-border/60 dark:border-surface-dark-border/60">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-sage" />
                <span>Protected file storage</span>
              </span>
            </div>
          </div>

          {/* Feature 7 */}
          <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-5 shadow-warm-xs hover:shadow-warm-sm transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-brand-sage/15 text-brand-sage dark:bg-brand-sage/25 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-sage">
                  Academic Telemetry
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  Performance Analytics
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Track cohort score distributions, pass rates, topic mastery heatmaps, and longitudinal trend lines to inform actionable academic interventions.
              </p>
            </div>
            <div className="pt-3 mt-3 border-t border-surface-light-border/60 dark:border-surface-dark-border/60">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-sage" />
                <span>Class score curves</span>
              </span>
            </div>
          </div>

          {/* Feature 8 */}
          <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-5 shadow-warm-xs hover:shadow-warm-sm transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/25 flex items-center justify-center">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Student Motivation
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  Leaderboards & Streaks
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Reinforce regular study habits with daily attempt streak tracking, peer leaderboard rankings, and student achievement milestone badges.
              </p>
            </div>
            <div className="pt-3 mt-3 border-t border-surface-light-border/60 dark:border-surface-dark-border/60">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-sage" />
                <span>Daily streak calculations</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. ROLE / USE CASE SECTION */}
      <section id="roles" className="space-y-8 scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <Badge variant="sage" dot>
            Tailored Workspaces
          </Badge>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-slate-900 dark:text-slate-100">
            Dedicated environments for every academic stakeholder.
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            Students, instructors, and administrators each operate within a workspace customized to their specific responsibilities, permissions, and tools.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Student Persona */}
          <div className="rounded-3xl border border-surface-light-border dark:border-surface-dark-border bg-gradient-to-b from-[#FFF9F5] to-white dark:from-[#241712] dark:to-surface-dark p-6 sm:p-7 shadow-warm-xs flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="peach" size="sm">Students</Badge>
                <GraduationCap className="w-5 h-5 text-brand-peach" />
              </div>
              <h3 className="text-xl font-bold font-display text-slate-900 dark:text-slate-100">
                Learner Workspace
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Take assessments in an offline-resilient exam interface, review scored submissions with faculty feedback, track mastery over time, and maintain daily learning streaks.
              </p>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 pt-2">
                <li className="flex items-start space-x-2">
                  <span className="text-brand-terracotta font-bold">✓</span>
                  <span>Distraction-free timed attempt room with autosave</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-brand-terracotta font-bold">✓</span>
                  <span>Instant MCQ results and granular essay rubric feedback</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-brand-terracotta font-bold">✓</span>
                  <span>Personalized performance donut & score trend curves</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-brand-terracotta font-bold">✓</span>
                  <span>Daily streaks, leaderboards, and achievement badges</span>
                </li>
              </ul>
            </div>
            <div className="pt-6 mt-4 border-t border-surface-light-border/60 dark:border-surface-dark-border/60">
              <Link to={isAuthenticated && user?.role === 'student' ? '/student/dashboard' : '/auth/login'}>
                <Button variant="outline" size="sm" className="w-full">
                  {isAuthenticated && user?.role === 'student' ? 'Enter Student Workspace →' : 'Student Sign In →'}
                </Button>
              </Link>
            </div>
          </div>

          {/* Instructor Persona */}
          <div className="rounded-3xl border border-surface-light-border dark:border-surface-dark-border bg-gradient-to-b from-[#F2F8F6] to-white dark:from-[#132A24] dark:to-surface-dark p-6 sm:p-7 shadow-warm-xs flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="sage" size="sm">Instructors</Badge>
                <BookOpen className="w-5 h-5 text-brand-sage" />
              </div>
              <h3 className="text-xl font-bold font-display text-slate-900 dark:text-slate-100">
                Instructor Studio
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Author assessments using the question bank or batch-import from PDF/DOCX. Configure anti-cheat parameters, grade subjective answers with rubrics, and analyze cohort telemetry.
              </p>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 pt-2">
                <li className="flex items-start space-x-2">
                  <span className="text-brand-sage font-bold">✓</span>
                  <span>Centralized Question Bank with version control</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-brand-sage font-bold">✓</span>
                  <span>Intelligent PDF, DOCX, and Google Forms import</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-brand-sage font-bold">✓</span>
                  <span>Side-by-side evaluation studio with custom rubrics</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-brand-sage font-bold">✓</span>
                  <span>Live proctoring alerts and submission auditing</span>
                </li>
              </ul>
            </div>
            <div className="pt-6 mt-4 border-t border-surface-light-border/60 dark:border-surface-dark-border/60">
              <Link to={isAuthenticated && user?.role === 'instructor' ? '/instructor/dashboard' : '/auth/login'}>
                <Button variant="primary" size="sm" className="w-full">
                  {isAuthenticated && user?.role === 'instructor' ? 'Enter Instructor Studio →' : 'Instructor Sign In →'}
                </Button>
              </Link>
            </div>
          </div>

          {/* Admin Persona */}
          <div className="rounded-3xl border border-surface-light-border dark:border-surface-dark-border bg-gradient-to-b from-[#FFF4ED] to-white dark:from-[#341C16] dark:to-surface-dark p-6 sm:p-7 shadow-warm-xs flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="terracotta" size="sm">Administrators</Badge>
                <ShieldCheck className="w-5 h-5 text-brand-terracotta" />
              </div>
              <h3 className="text-xl font-bold font-display text-slate-900 dark:text-slate-100">
                Governance Console
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Manage user approvals, oversee institutional assessments, inspect immutable audit trails, and maintain rigorous security standards across all academic departments.
              </p>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 pt-2">
                <li className="flex items-start space-x-2">
                  <span className="text-brand-terracotta font-bold">✓</span>
                  <span>Applicant verification & role delegation queue</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-brand-terracotta font-bold">✓</span>
                  <span>Platform-wide assessment oversight & security logs</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-brand-terracotta font-bold">✓</span>
                  <span>Immutable audit logging for institutional governance</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-brand-terracotta font-bold">✓</span>
                  <span>System configuration, passing score thresholds, notices</span>
                </li>
              </ul>
            </div>
            <div className="pt-6 mt-4 border-t border-surface-light-border/60 dark:border-surface-dark-border/60">
              <Link to={isAuthenticated && user?.role === 'admin' ? '/admin/dashboard' : '/auth/login'}>
                <Button variant="outline" size="sm" className="w-full">
                  {isAuthenticated && user?.role === 'admin' ? 'Enter Admin Console →' : 'Administrator Sign In →'}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 4. ASSESSMENT LIFECYCLE SECTION */}
      <section id="platform" className="space-y-8 scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <Badge variant="terracotta" dot>
            Seamless Workflow
          </Badge>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-slate-900 dark:text-slate-100">
            The Complete Assessment Lifecycle
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            From initial question authoring through automated evaluation and longitudinal analytics, UAP provides an end-to-end framework that eliminates fragmented tooling.
          </p>
        </div>

        {/* 6-Stage Visual Timeline */}
        <div className="relative rounded-3xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-6 sm:p-8 shadow-warm-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 relative z-10">
            {/* Step 1: CREATE */}
            <div className="relative flex flex-col space-y-2">
              <div className="flex items-center space-x-2">
                <span className="w-7 h-7 rounded-lg bg-brand-terracotta text-white font-bold text-xs flex items-center justify-center">
                  1
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-terracotta">
                  Create
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Author & Ingest
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Draft MCQs, essays, and file prompts or batch-import from PDF, DOCX, and Google Forms.
              </p>
            </div>

            {/* Step 2: BUILD */}
            <div className="relative flex flex-col space-y-2">
              <div className="flex items-center space-x-2">
                <span className="w-7 h-7 rounded-lg bg-brand-peach text-white font-bold text-xs flex items-center justify-center">
                  2
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-peach">
                  Build
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Assemble Exam
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Compose exams with fixed questions or randomized pools from the centralized bank.
              </p>
            </div>

            {/* Step 3: PUBLISH */}
            <div className="relative flex flex-col space-y-2">
              <div className="flex items-center space-x-2">
                <span className="w-7 h-7 rounded-lg bg-brand-sage text-white font-bold text-xs flex items-center justify-center">
                  3
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-sage">
                  Publish
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Schedule & Gate
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Define time windows, access passcodes, attempt limits, and proctoring parameters.
              </p>
            </div>

            {/* Step 4: ATTEMPT */}
            <div className="relative flex flex-col space-y-2">
              <div className="flex items-center space-x-2">
                <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                  4
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Attempt
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Secure Delivery
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Students test in an offline-resilient exam room with timer & active proctoring telemetry.
              </p>
            </div>

            {/* Step 5: EVALUATE */}
            <div className="relative flex flex-col space-y-2">
              <div className="flex items-center space-x-2">
                <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                  5
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Evaluate
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Auto & Rubric
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Instant MCQ scoring paired with side-by-side faculty rubric grading for essays.
              </p>
            </div>

            {/* Step 6: ANALYZE */}
            <div className="relative flex flex-col space-y-2">
              <div className="flex items-center space-x-2">
                <span className="w-7 h-7 rounded-lg bg-amber-600 text-white font-bold text-xs flex items-center justify-center">
                  6
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Analyze
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Insights & Trends
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Review cohort score curves, track topic mastery, inspect streaks, and audit logs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SECURITY & TRUST SECTION */}
      <section id="security" className="space-y-8 scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <Badge variant="terracotta" dot>
            Academic Governance
          </Badge>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-slate-900 dark:text-slate-100">
            Security and integrity at every layer.
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            Engineered with strict role separation, attempt tamper resilience, and audit transparency to safeguard high-stakes assessments.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-6 shadow-warm-xs">
            <div className="w-10 h-10 rounded-xl bg-brand-terracotta/10 text-brand-terracotta flex items-center justify-center mb-3">
              <Lock className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
              Role-Based Access Control
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Strict RBAC enforcement across student, faculty, and administrative tiers. Routes and APIs are protected by cryptographically verified JWT authorization.
            </p>
          </div>

          <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-6 shadow-warm-xs">
            <div className="w-10 h-10 rounded-xl bg-brand-sage/15 text-brand-sage flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
              Tamper-Resilient Autosave
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Every student answer change is synced to encrypted local storage and backend state, ensuring complete exam preservation during intermittent connection drops.
            </p>
          </div>

          <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-6 shadow-warm-xs">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
              <Eye className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
              Proctoring Telemetry
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Continuous monitoring for tab switches, browser window blur, and clipboard events. Incidents are logged with millisecond timestamps for instructor review.
            </p>
          </div>

          <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-6 shadow-warm-xs">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
              <Activity className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
              Immutable Audit Logging
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Comprehensive activity trails preserve administrative actions, applicant approvals, grading overrides, and assessment status changes for audit compliance.
            </p>
          </div>

          <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-6 shadow-warm-xs">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
              Protected Submissions
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Uploaded student examination documents and Google Docs links are gated behind authenticated role checks, preventing unauthorized access.
            </p>
          </div>

          <div className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-white dark:bg-surface-dark p-6 shadow-warm-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
              <Server className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
              Live Infrastructure Health
            </h4>
            <div className="space-y-2 mt-1">
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                MongoDB database connectivity & Express REST API telemetry are monitored live:
              </p>
              <div className="flex items-center space-x-2 pt-1">
                <span className={`w-2 h-2 rounded-full ${healthStatus?.ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {healthLoading ? 'Checking...' : healthStatus?.ok ? 'Operational · MongoDB Active' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. ABOUT UAP SECTION */}
      <section id="about" className="space-y-8 scroll-mt-20">
        <div className="rounded-3xl border border-surface-light-border dark:border-surface-dark-border bg-gradient-to-br from-[#FAF6F0] via-white to-[#F2F8F6] dark:from-surface-dark-muted dark:via-surface-dark dark:to-[#132A24] p-8 sm:p-12 shadow-warm-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-4">
              <Badge variant="peach" dot>
                About Unified Assessment Platform
              </Badge>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-slate-900 dark:text-slate-100">
                Bridging the gap between assessment authoring and academic evaluation.
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Traditional academic institutions often struggle with fragmented tooling: questions are managed in isolated spreadsheets, tests delivered on disparate web forms, proctoring conducted manually, and grading recorded across disconnected systems.
              </p>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                <strong>Unified Assessment Platform</strong> was engineered from the ground up to unify these fragmented stages into a cohesive, production-ready ecosystem:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs sm:text-sm">
                <div className="p-3 rounded-xl bg-white/80 dark:bg-surface-dark/80 border border-surface-light-border dark:border-surface-dark-border">
                  <span className="font-bold text-brand-terracotta block mb-0.5">Unified Repository</span>
                  <span className="text-slate-500 dark:text-slate-400 text-xs">Curate institutional question banks with tagging and difficulty taxonomy.</span>
                </div>
                <div className="p-3 rounded-xl bg-white/80 dark:bg-surface-dark/80 border border-surface-light-border dark:border-surface-dark-border">
                  <span className="font-bold text-brand-sage block mb-0.5">Side-by-Side Grading</span>
                  <span className="text-slate-500 dark:text-slate-400 text-xs">Evaluate subjective essays directly alongside rubric criteria and feedback.</span>
                </div>
                <div className="p-3 rounded-xl bg-white/80 dark:bg-surface-dark/80 border border-surface-light-border dark:border-surface-dark-border">
                  <span className="font-bold text-brand-peach block mb-0.5">Resilient Exam Delivery</span>
                  <span className="text-slate-500 dark:text-slate-400 text-xs">Offline autosave guards student attempts against connection dropouts.</span>
                </div>
                <div className="p-3 rounded-xl bg-white/80 dark:bg-surface-dark/80 border border-surface-light-border dark:border-surface-dark-border">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block mb-0.5">Institutional Governance</span>
                  <span className="text-slate-500 dark:text-slate-400 text-xs">Immutable audit logs and verified applicant workflows ensure accountability.</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col justify-center space-y-4 p-6 rounded-2xl bg-white/90 dark:bg-surface-dark/90 border border-surface-light-border dark:border-surface-dark-border shadow-warm-xs">
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Platform Architecture
              </h4>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-surface-light-border dark:border-surface-dark-border">
                  <span className="text-slate-500 dark:text-slate-400">Core Question Formats</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">MCQ, Short, Long, File</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-surface-light-border dark:border-surface-dark-border">
                  <span className="text-slate-500 dark:text-slate-400">Document Ingestion</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">PDF, DOCX, Google Forms</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-surface-light-border dark:border-surface-dark-border">
                  <span className="text-slate-500 dark:text-slate-400">Authentication</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">JWT + Google OAuth 2.0</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-surface-light-border dark:border-surface-dark-border">
                  <span className="text-slate-500 dark:text-slate-400">Integrity Telemetry</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">Webcam, Tab & Blur</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500 dark:text-slate-400">Student Motivation</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">Streaks & Badges</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FINAL CALL TO ACTION */}
      <section className="rounded-3xl border border-surface-light-border dark:border-surface-dark-border bg-gradient-to-r from-[#FFF4ED] via-[#FFFDFB] to-[#F2F8F6] dark:from-[#341C16] dark:via-surface-dark dark:to-[#132A24] p-8 sm:p-12 text-center shadow-warm-sm relative overflow-hidden">
        <div className="max-w-2xl mx-auto space-y-4 relative z-10">
          <Badge variant="terracotta" size="sm" dot>
            Get Started Today
          </Badge>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-slate-900 dark:text-slate-100">
            Ready to simplify your assessment workflow?
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Experience an integrated, secure, and modern evaluation platform built for students, faculty, and academic administrators.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth/signup">
              <Button variant="primary" size="lg" icon={ArrowRight}>
                Get Started Free
              </Button>
            </Link>
            <Link to="/auth/login">
              <Button variant="outline" size="lg">
                Sign In to Workspace
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
