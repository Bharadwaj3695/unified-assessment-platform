import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { assessmentService } from '../../../services/assessment.service';
import { submissionService } from '../../../services/submission.service';
import Badge from '../../ui/Badge';
import {
  Search,
  X,
  Loader2,
  BookOpen,
  FileCheck2,
  LayoutDashboard,
  User,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

const STUDENT_NAV_ITEMS = [
  {
    id: 'nav-catalog',
    title: 'Assessment Catalog',
    subtitle: 'Browse and attempt available examinations',
    path: '/student/catalog',
    category: 'Navigation',
    icon: BookOpen,
  },
  {
    id: 'nav-submissions',
    title: 'My Submissions & Results',
    subtitle: 'Review graded submissions, scores, and feedback',
    path: '/student/submissions',
    category: 'Navigation',
    icon: FileCheck2,
  },
  {
    id: 'nav-dashboard',
    title: 'Student Dashboard',
    subtitle: 'Workspace overview, streak, and recent activity',
    path: '/student/dashboard',
    category: 'Navigation',
    icon: LayoutDashboard,
  },
  {
    id: 'nav-profile',
    title: 'Student Profile & 2FA',
    subtitle: 'Manage profile, institutional ID, and MFA settings',
    path: '/student/profile',
    category: 'Navigation',
    icon: User,
  },
];

const StudentSearchBar = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({
    assessments: [],
    submissions: [],
    pages: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const mobileInputRef = useRef(null);
  const requestIdRef = useRef(0);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setIsMobileExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search logic with request cancellation and error handling
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults({ assessments: [], submissions: [], pages: [] });
      setIsLoading(false);
      setError(null);
      setSelectedIndex(-1);
      return;
    }

    const currentReqId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const lowerQ = trimmed.toLowerCase();

        // 1. Filter local student navigation pages
        const matchedPages = STUDENT_NAV_ITEMS.filter(
          (item) =>
            item.title.toLowerCase().includes(lowerQ) ||
            item.subtitle.toLowerCase().includes(lowerQ)
        );

        // 2. Fetch available assessments & student submissions in parallel
        const [assessmentsRes, submissionsRes] = await Promise.allSettled([
          assessmentService.getAssessments({ search: trimmed, limit: 5 }),
          submissionService.getStudentSubmissions(),
        ]);

        if (currentReqId !== requestIdRef.current) return;

        let assessments = [];
        if (assessmentsRes.status === 'fulfilled') {
          const val = assessmentsRes.value;
          assessments = val?.data?.assessments || val?.assessments || val?.data || [];
          if (!Array.isArray(assessments) && val?.data && Array.isArray(val.data)) {
            assessments = val.data;
          }
        }

        let submissions = [];
        if (submissionsRes.status === 'fulfilled') {
          const rawSubmissions =
            submissionsRes.value?.data || submissionsRes.value || [];
          if (Array.isArray(rawSubmissions)) {
            submissions = rawSubmissions.filter((sub) => {
              const title = sub.assessment?.title || '';
              const cat = sub.assessment?.category || '';
              return (
                title.toLowerCase().includes(lowerQ) ||
                cat.toLowerCase().includes(lowerQ)
              );
            }).slice(0, 5);
          }
        }

        setResults({
          assessments: Array.isArray(assessments) ? assessments.slice(0, 5) : [],
          submissions,
          pages: matchedPages,
        });
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch (err) {
        if (currentReqId === requestIdRef.current) {
          console.error('Student search failed:', err);
          setError('Unable to load search results. Please try again.');
        }
      } finally {
        if (currentReqId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Flattened items for keyboard navigation
  const flattenedItems = [
    ...results.pages.map((p) => ({ ...p, type: 'page' })),
    ...results.assessments.map((a) => ({ ...a, type: 'assessment' })),
    ...results.submissions.map((s) => ({ ...s, type: 'submission' })),
  ];

  const totalResultsCount = flattenedItems.length;

  const handleSelect = useCallback(
    (item) => {
      setIsOpen(false);
      setIsMobileExpanded(false);
      setQuery('');

      if (item.type === 'page') {
        navigate(item.path);
      } else if (item.type === 'assessment') {
        const id = item._id || item.id;
        navigate(`/student/attempt/${id}`);
      } else if (item.type === 'submission') {
        const id = item._id || item.id;
        navigate(`/student/submissions?submissionId=${id}`);
      }
    },
    [navigate]
  );

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' && query.trim().length >= 2) {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      setIsOpen(false);
      setIsMobileExpanded(false);
      inputRef.current?.blur();
      mobileInputRef.current?.blur();
      return;
    }

    if (flattenedItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < flattenedItems.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : flattenedItems.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < flattenedItems.length) {
        handleSelect(flattenedItems[selectedIndex]);
      } else if (flattenedItems.length > 0) {
        handleSelect(flattenedItems[0]);
      } else if (query.trim()) {
        setIsOpen(false);
        setIsMobileExpanded(false);
        navigate(`/student/catalog?search=${encodeURIComponent(query.trim())}`);
      }
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults({ assessments: [], submissions: [], pages: [] });
    setIsOpen(false);
    setError(null);
    inputRef.current?.focus();
  };

  const renderDropdownContent = () => (
    <div
      role="listbox"
      id="student-search-results"
      className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 p-1.5 focus:outline-none"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-7 text-xs text-slate-500 dark:text-slate-400">
          <Loader2 className="w-4 h-4 mr-2 animate-spin text-brand-primary" />
          Searching student workspace...
        </div>
      ) : error ? (
        <div className="py-6 px-4 text-center">
          <AlertCircle className="w-5 h-5 mx-auto text-amber-500 mb-1.5" />
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{error}</p>
        </div>
      ) : totalResultsCount === 0 ? (
        <div className="py-6 px-4 text-center">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            No matching assessments or records found
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Try searching by course title, subject category, or navigation destination.
          </p>
        </div>
      ) : (
        <>
          {/* Student Navigation Pages */}
          {results.pages.length > 0 && (
            <div className="py-1">
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Workspace Destinations
              </div>
              <div className="mt-0.5 space-y-0.5">
                {results.pages.map((p) => {
                  const itemIndex = flattenedItems.findIndex((it) => it.id === p.id);
                  const isHighlighted = selectedIndex === itemIndex;
                  const Icon = p.icon;
                  return (
                    <div
                      key={p.id}
                      role="option"
                      aria-selected={isHighlighted}
                      onClick={() => handleSelect({ ...p, type: 'page' })}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer text-xs transition-colors ${
                        isHighlighted
                          ? 'bg-brand-peach/15 dark:bg-brand-peach/20 text-brand-terracotta dark:text-brand-peach font-semibold'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-brand-peach/10 text-brand-terracotta flex items-center justify-center flex-shrink-0">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="font-medium truncate">{p.title}</div>
                          <div className="text-[11px] text-slate-400 truncate">{p.subtitle}</div>
                        </div>
                      </div>
                      <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0 ml-2" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Assessments Section */}
          {results.assessments.length > 0 && (
            <div className="py-1">
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center">
                <BookOpen className="w-3 h-3 mr-1 text-brand-primary" />
                Available Assessments
              </div>
              <div className="mt-0.5 space-y-0.5">
                {results.assessments.map((asmt) => {
                  const id = asmt._id || asmt.id;
                  const itemIndex = flattenedItems.findIndex(
                    (it) => (it._id || it.id) === id && it.type === 'assessment'
                  );
                  const isHighlighted = selectedIndex === itemIndex;
                  return (
                    <div
                      key={id}
                      role="option"
                      aria-selected={isHighlighted}
                      onClick={() => handleSelect({ ...asmt, type: 'assessment' })}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer text-xs transition-colors ${
                        isHighlighted
                          ? 'bg-brand-peach/15 dark:bg-brand-peach/20 text-brand-terracotta dark:text-brand-peach font-semibold'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="font-medium truncate">{asmt.title}</div>
                          <div className="text-[11px] text-slate-400">
                            {asmt.category || 'General'} · {asmt.durationMinutes || 60}m ·{' '}
                            {asmt.totalPoints || 100} pts
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1.5 flex-shrink-0 ml-2">
                        <Badge variant="success" size="sm">
                          {asmt.status || 'open'}
                        </Badge>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Submissions Section */}
          {results.submissions.length > 0 && (
            <div className="py-1">
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center">
                <FileCheck2 className="w-3 h-3 mr-1 text-amber-500" />
                Your Submissions & Results
              </div>
              <div className="mt-0.5 space-y-0.5">
                {results.submissions.map((sub) => {
                  const id = sub._id || sub.id;
                  const itemIndex = flattenedItems.findIndex(
                    (it) => (it._id || it.id) === id && it.type === 'submission'
                  );
                  const isHighlighted = selectedIndex === itemIndex;
                  return (
                    <div
                      key={id}
                      role="option"
                      aria-selected={isHighlighted}
                      onClick={() => handleSelect({ ...sub, type: 'submission' })}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer text-xs transition-colors ${
                        isHighlighted
                          ? 'bg-brand-peach/15 dark:bg-brand-peach/20 text-brand-terracotta dark:text-brand-peach font-semibold'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                          <FileCheck2 className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <div className="font-medium truncate">
                            {sub.assessment?.title || 'Assessment Exam'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Score: {sub.score !== undefined ? sub.score : 'Pending'} /{' '}
                            {sub.totalPoints || 100} · {sub.status}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1.5 flex-shrink-0 ml-2">
                        <Badge
                          variant={sub.status === 'evaluated' ? 'success' : 'warning'}
                          size="sm"
                        >
                          {sub.status === 'evaluated' ? `${sub.percentage || 0}%` : 'Reviewing'}
                        </Badge>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className="relative flex items-center">
      {/* Mobile Search Icon Button (< 640px) */}
      <button
        type="button"
        onClick={() => {
          setIsMobileExpanded(true);
          setIsOpen(query.trim().length >= 2);
          setTimeout(() => mobileInputRef.current?.focus(), 50);
        }}
        className="sm:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary flex-shrink-0"
        aria-label="Open student search"
      >
        <Search className="w-4 h-4" />
      </button>

      {/* Desktop & Tablet Inline Search Input (>= 640px) */}
      <div className="hidden sm:relative sm:flex sm:items-center">
        <div className="absolute inset-y-0 left-0 pl-2.5 sm:pl-3 flex items-center pointer-events-none text-slate-400">
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-primary" />
          ) : (
            <Search className="w-3.5 h-3.5" />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen && e.target.value.trim().length >= 2) setIsOpen(true);
          }}
          onFocus={() => {
            if (query.trim().length >= 2) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search assessments, submissions..."
          aria-label="Search student assessments"
          aria-expanded={isOpen}
          aria-controls="student-search-results"
          role="combobox"
          className="w-[170px] md:w-[190px] lg:w-[220px] xl:w-[230px] h-[38px] pl-8 pr-7 py-1.5 text-xs bg-slate-50/90 dark:bg-surface-dark-muted/70 hover:bg-white dark:hover:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary focus:bg-white dark:focus:bg-surface-dark transition-all shadow-xs"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="Clear search"
            aria-label="Clear search input"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Desktop Live Dropdown */}
        {isOpen && query.trim().length >= 2 && (
          <div className="absolute right-0 top-full mt-2 w-[340px] md:w-[380px] bg-white dark:bg-surface-dark rounded-2xl border border-surface-light-border dark:border-surface-dark-border shadow-2xl z-50 overflow-hidden animate-in fade-in-50 slide-in-from-top-1 duration-150">
            <div className="px-3 py-1.5 border-b border-surface-light-border dark:border-surface-dark-border bg-slate-50/70 dark:bg-surface-dark-muted/50 flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                Student Search Results ({totalResultsCount})
              </span>
              <span>Esc to close</span>
            </div>
            {renderDropdownContent()}
          </div>
        )}
      </div>

      {/* Mobile Expandable Search Overlay (< 640px) */}
      {isMobileExpanded && (
        <div className="fixed inset-x-2 top-2 z-50 flex flex-col sm:hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center bg-white dark:bg-surface-dark border border-surface-light-border dark:border-surface-dark-border rounded-xl shadow-2xl p-1.5 gap-2">
            <div className="pl-2 text-slate-400">
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </div>
            <input
              ref={mobileInputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!isOpen && e.target.value.trim().length >= 2) setIsOpen(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search assessments, submissions..."
              className="flex-1 h-9 px-1 text-xs bg-transparent border-0 outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400"
            />
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Clear input"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsMobileExpanded(false);
                setIsOpen(false);
              }}
              className="px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
          </div>

          {isOpen && query.trim().length >= 2 && (
            <div className="mt-2 bg-white dark:bg-surface-dark rounded-xl border border-surface-light-border dark:border-surface-dark-border shadow-2xl overflow-hidden max-h-[65vh]">
              {renderDropdownContent()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentSearchBar;
