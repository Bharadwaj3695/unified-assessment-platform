import { useState, useEffect, useMemo } from 'react';
import {
  Award,
  Plus,
  Trash2,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  FileCheck,
  UserCheck,
  Sliders,
  HelpCircle,
  Sparkles,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Alert from '../ui/Alert';
import assessmentService from '../../services/assessment.service';
import {
  DEFAULT_GRADING_SCHEME,
  NON_PASSING_FEEDBACK,
  validateGradingScheme,
  resolveGrade,
} from '../../utils/gradingScheme';

const GradingSchemeEditor = ({
  certification = {},
  onChange,
  errors = {},
  assessmentTitle = '',
  title = '03 — Certification & Grading',
}) => {
  // Available templates from server
  const [templates, setTemplates] = useState([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  // Simulator test score
  const [testScore, setTestScore] = useState(85);

  // Collapsible states for sub-sections
  const [isGradingSchemeOpen, setIsGradingSchemeOpen] = useState(true);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(true);

  // Fetch approved published certificate templates
  useEffect(() => {
    let mounted = true;
    const fetchTemplates = async () => {
      try {
        setIsLoadingTemplates(true);
        const res = await assessmentService.getCertificateTemplates();
        const list = Array.isArray(res) ? res : (res?.data || res?.templates || []);
        if (mounted && Array.isArray(list)) {
          setTemplates(list);
        }
      } catch (err) {
        // Non-critical fallback if templates endpoint is unreachable
        console.warn('Failed to fetch certificate templates:', err.message);
      } finally {
        if (mounted) setIsLoadingTemplates(false);
      }
    };

    fetchTemplates();
    return () => {
      mounted = false;
    };
  }, []);

  const isEnabled = Boolean(certification.enabled);
  const passingPercentage =
    typeof certification.passingPercentage === 'number'
      ? certification.passingPercentage
      : 50;
  const gradingScheme = Array.isArray(certification.gradingScheme) && certification.gradingScheme.length > 0
    ? certification.gradingScheme
    : DEFAULT_GRADING_SCHEME.map((b) => ({ ...b }));

  // Live scheme validation
  const validationResult = useMemo(() => {
    return validateGradingScheme(gradingScheme);
  }, [gradingScheme]);

  // Live simulator result
  const simulatedOutcome = useMemo(() => {
    return resolveGrade(testScore, gradingScheme, passingPercentage);
  }, [testScore, gradingScheme, passingPercentage]);

  // Helper updater
  const updateCertification = (field, value) => {
    onChange({
      ...certification,
      [field]: value,
    });
  };

  const handleToggle = (enabled) => {
    onChange({
      ...certification,
      enabled,
      passingPercentage: certification.passingPercentage ?? 50,
      gradingScheme: certification.gradingScheme && certification.gradingScheme.length > 0
        ? certification.gradingScheme
        : DEFAULT_GRADING_SCHEME.map((b) => ({ ...b })),
      certificateTitle: certification.certificateTitle ?? '',
      signatoryName: certification.signatoryName ?? '',
      signatoryTitle: certification.signatoryTitle ?? 'Dean of Academic Affairs',
      templateId: certification.templateId ?? null,
    });
  };

  // Reset to Approved Default Grading Bands
  const handleResetDefaults = () => {
    updateCertification(
      'gradingScheme',
      DEFAULT_GRADING_SCHEME.map((b) => ({ ...b }))
    );
  };

  // Update a single grade band field
  const handleBandChange = (index, field, value) => {
    const updated = gradingScheme.map((band, idx) => {
      if (idx !== index) return band;
      return {
        ...band,
        [field]: field === 'minPercentage' || field === 'maxPercentage' ? Number(value) : value,
      };
    });
    updateCertification('gradingScheme', updated);
  };

  // Add a new grade band
  const handleAddBand = () => {
    // Insert a band at the beginning or adjust boundaries sensibly
    const newBand = {
      grade: 'New',
      minPercentage: 0,
      maxPercentage: 50,
      label: 'Good Effort',
    };
    updateCertification('gradingScheme', [...gradingScheme, newBand]);
  };

  // Remove a grade band
  const handleRemoveBand = (index) => {
    if (gradingScheme.length <= 1) return;
    const updated = gradingScheme.filter((_, idx) => idx !== index);
    updateCertification('gradingScheme', updated);
  };

  return (
    <Card
      title={
        <div className="flex items-center space-x-2.5">
          <Award className="w-5 h-5 text-[#E05D38]" />
          <span>{title}</span>
        </div>
      }
      
      className="border border-[#EBE3D8] dark:border-[#2D3748]"
    >
      <div className="space-y-6">
        {/* Enable Certification Toggle */}
        <div className="flex items-start justify-between p-4 rounded-xl bg-[#FCF8F3] dark:bg-[#1A202C] border border-[#EBE3D8] dark:border-[#2D3748]">
          <div className="space-y-1 pr-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-[#1F2937] dark:text-[#F9FAFB]">
                Enable Certification for this Assessment
              </span>
              {isEnabled ? (
                <Badge variant="success" size="sm">Active</Badge>
              ) : (
                <Badge variant="neutral" size="sm">Disabled</Badge>
              )}
            </div>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              
            </p>
          </div>

          <label htmlFor="certification-toggle" className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input
              id="certification-toggle"
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => handleToggle(e.target.checked)}
              className="sr-only peer"
              aria-label="Enable Certification for this Assessment"
            />
            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-[#E05D38]"></div>
          </label>
        </div>

        {/* When Certification is Disabled */}
        {!isEnabled && (
          <div className="p-4 rounded-xl border border-dashed border-[#EBE3D8] dark:border-[#2D3748] text-center space-y-1">
            <p className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
              Certification is currently disabled. Submissions will be graded normally according to points and standard percentages, but no certificate award records will be issued.
            </p>
          </div>
        )}

        {/* Certification Parameters (When Enabled) */}
        {isEnabled && (
          <div className="space-y-6">
            {/* General Parameters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Passing Percentage */}
              <div>
                <label className="block text-xs font-semibold text-[#1F2937] dark:text-[#F9FAFB] mb-1 flex items-center justify-between">
                  <span>Passing Percentage for Certification (%) *</span>
                  <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">Default: 50%</span>
                </label>
                <div className="relative">
                  <input
                    id="certPassingPercentage"
                    type="number"
                    min="0"
                    max="100"
                    value={passingPercentage}
                    onChange={(e) => updateCertification('passingPercentage', Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl focus:outline-none focus:border-[#E05D38] focus:ring-2 focus:ring-[#E05D38]/20 transition-all text-[#1F2937] dark:text-[#F9FAFB]"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-[#64748B] dark:text-[#94A3B8] font-bold">
                    %
                  </span>
                </div>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1">
                  
                </p>
                {errors.passingPercentage && (
                  <p className="text-xs text-red-500 mt-1">{errors.passingPercentage}</p>
                )}
              </div>

              {/* Certificate Template Selection */}
              <div>
                <label className="block text-xs font-semibold text-[#1F2937] dark:text-[#F9FAFB] mb-1 flex items-center">
                  <FileCheck className="w-3.5 h-3.5 mr-1 text-[#E05D38]" />
                  <span>Approved Certificate Template</span>
                </label>
                <select
                  id="certTemplateSelect"
                  value={certification.templateId || ''}
                  onChange={(e) => updateCertification('templateId', e.target.value || null)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl focus:outline-none focus:border-[#E05D38] focus:ring-2 focus:ring-[#E05D38]/20 transition-all text-[#1F2937] dark:text-[#F9FAFB]"
                >
                  <option value="">Standard Institutional Merit Template (Default)</option>
                  {templates.map((tpl) => (
                    <option key={tpl._id} value={tpl._id}>
                      {tpl.name} {tpl.isDefault ? '(Institutional Default)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1">
                  
                </p>
              </div>

              {/* Certificate Title Override */}
              <div>
                <label className="block text-xs font-semibold text-[#1F2937] dark:text-[#F9FAFB] mb-1">
                  Certificate Title Override (Optional)
                </label>
                <input
                  id="certTitleOverride"
                  type="text"
                  placeholder={assessmentTitle || 'e.g. Certificate of Academic Excellence'}
                  value={certification.certificateTitle || ''}
                  onChange={(e) => updateCertification('certificateTitle', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl focus:outline-none focus:border-[#E05D38] focus:ring-2 focus:ring-[#E05D38]/20 transition-all text-[#1F2937] dark:text-[#F9FAFB]"
                />
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1">
                  Leave empty to automatically use the assessment title on the certificate.
                </p>
              </div>

              {/* Authorized Signatory Info */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[#1F2937] dark:text-[#F9FAFB] mb-1 flex items-center">
                    <UserCheck className="w-3.5 h-3.5 mr-1 text-[#3D8A78]" />
                    <span>Signatory Name</span>
                  </label>
                  <input
                    id="certSignatoryName"
                    type="text"
                    placeholder="e.g. Dr. Jane Doe"
                    value={certification.signatoryName || ''}
                    onChange={(e) => updateCertification('signatoryName', e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl focus:outline-none focus:border-[#E05D38] focus:ring-2 focus:ring-[#E05D38]/20 transition-all text-[#1F2937] dark:text-[#F9FAFB]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1F2937] dark:text-[#F9FAFB] mb-1">
                    Signatory Title
                  </label>
                  <input
                    id="certSignatoryTitle"
                    type="text"
                    placeholder="Dean of Academic Affairs"
                    value={certification.signatoryTitle || ''}
                    onChange={(e) => updateCertification('signatoryTitle', e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-[#12161F] border border-[#EBE3D8] dark:border-[#2D3748] rounded-xl focus:outline-none focus:border-[#E05D38] focus:ring-2 focus:ring-[#E05D38]/20 transition-all text-[#1F2937] dark:text-[#F9FAFB]"
                  />
                </div>
              </div>
            </div>

            {/* Collapsible Grading Scheme Section */}
            <div className="pt-4 border-t border-[#EBE3D8] dark:border-[#2D3748] space-y-4">
              <div
                onClick={() => setIsGradingSchemeOpen((prev) => !prev)}
                className="flex items-center justify-between cursor-pointer p-3.5 rounded-xl bg-[#FCF8F3]/70 dark:bg-[#1A202C]/70 hover:bg-[#FAF3EA] dark:hover:bg-[#1E2533] border border-[#EBE3D8] dark:border-[#2D3748] transition-colors select-none"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsGradingSchemeOpen((prev) => !prev);
                  }
                }}
                aria-expanded={isGradingSchemeOpen}
                aria-label="Toggle Configurable Grading Scheme Editor"
              >
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-[#E05D38]" />
                  <span className="text-sm font-bold text-[#1F2937] dark:text-[#F9FAFB]">
                    Configurable Grading Scheme
                  </span>
                  {validationResult.valid ? (
                    <Badge variant="success" size="sm">Valid Scheme</Badge>
                  ) : (
                    <Badge variant="danger" size="sm">Invalid</Badge>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs text-[#64748B] dark:text-[#94A3B8] hidden sm:inline">
                    {isGradingSchemeOpen ? 'Collapse' : 'Expand'}
                  </span>
                  {isGradingSchemeOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#E05D38]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8]" />
                  )}
                </div>
              </div>

              {isGradingSchemeOpen && (
                <div className="space-y-4 pt-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                      
                    </p>

                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        icon={RotateCcw}
                        onClick={handleResetDefaults}
                      >
                        Reset Defaults
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={Plus}
                        onClick={handleAddBand}
                      >
                        Add Grade
                      </Button>
                    </div>
                  </div>

                  {/* Validation Status Banner */}
                  {validationResult.valid ? (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center space-x-2.5">
                      <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                        Grading scheme is valid: all score bands are contiguous and cover 0%–100% without gaps or overlaps.
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center space-x-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                      <span className="text-xs font-semibold text-rose-800 dark:text-rose-200">
                        {validationResult.error}
                      </span>
                    </div>
                  )}

                  {/* Grade Bands Table */}
                  <div className="overflow-x-auto rounded-xl border border-[#EBE3D8] dark:border-[#2D3748]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#FAF6F0] dark:bg-[#1A202C] text-[#64748B] dark:text-[#94A3B8] font-semibold border-b border-[#EBE3D8] dark:border-[#2D3748]">
                        <tr>
                          <th className="px-3.5 py-2.5">Grade</th>
                          <th className="px-3.5 py-2.5">Min % (Inclusive)</th>
                          <th className="px-3.5 py-2.5">Max % (Exclusive*)</th>
                          <th className="px-3.5 py-2.5">Student-Facing Label</th>
                          <th className="px-3.5 py-2.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EBE3D8] dark:divide-[#2D3748] bg-white dark:bg-[#12161F]">
                        {gradingScheme.map((band, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-3.5 py-2">
                              <input
                                type="text"
                                value={band.grade}
                                onChange={(e) => handleBandChange(idx, 'grade', e.target.value)}
                                placeholder="e.g. A+"
                                className="w-20 px-2 py-1 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#1A202C] text-slate-900 dark:text-white"
                              />
                            </td>
                            <td className="px-3.5 py-2">
                              <div className="flex items-center space-x-1">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={band.minPercentage}
                                  onChange={(e) => handleBandChange(idx, 'minPercentage', e.target.value)}
                                  className="w-20 px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#1A202C] text-slate-900 dark:text-white"
                                />
                                <span className="text-slate-400 text-[11px]">%</span>
                              </div>
                            </td>
                            <td className="px-3.5 py-2">
                              <div className="flex items-center space-x-1">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={band.maxPercentage}
                                  onChange={(e) => handleBandChange(idx, 'maxPercentage', e.target.value)}
                                  className="w-20 px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#1A202C] text-slate-900 dark:text-white"
                                />
                                <span className="text-slate-400 text-[11px]">%</span>
                              </div>
                            </td>
                            <td className="px-3.5 py-2">
                              <input
                                type="text"
                                value={band.label}
                                onChange={(e) => handleBandChange(idx, 'label', e.target.value)}
                                placeholder="e.g. Outstanding"
                                className="w-full min-w-[130px] px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-[#1A202C] text-slate-900 dark:text-white"
                              />
                            </td>
                            <td className="px-3.5 py-2 text-center">
                              <button
                                type="button"
                                disabled={gradingScheme.length <= 1}
                                onClick={() => handleRemoveBand(idx)}
                                className="p-1 text-rose-500 hover:text-rose-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Remove band"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    
                  </p>
                </div>
              )}

              {/* Collapsible Live Preview & Grade Simulator */}
              <div className="rounded-xl border border-[#EBE3D8] dark:border-[#2D3748] overflow-hidden bg-gradient-to-r from-[#FAF6F0] to-[#F5ECE3] dark:from-[#171D27] dark:to-[#1E2533]">
                <div
                  onClick={() => setIsSimulatorOpen((prev) => !prev)}
                  className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors select-none"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setIsSimulatorOpen((prev) => !prev);
                    }
                  }}
                  aria-expanded={isSimulatorOpen}
                  aria-label="Toggle Live Grading Simulator"
                >
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-[#E05D38]" />
                    <span className="text-sm font-bold text-[#1F2937] dark:text-[#F9FAFB]">
                      Live Grading & Qualification Simulator
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-[#64748B] dark:text-[#94A3B8] hidden sm:inline">
                      {isSimulatorOpen ? 'Collapse' : 'Expand'}
                    </span>
                    {isSimulatorOpen ? (
                      <ChevronUp className="w-4 h-4 text-[#E05D38]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8]" />
                    )}
                  </div>
                </div>

                {isSimulatorOpen && (
                  <div className="p-4 pt-1 space-y-3 border-t border-[#EBE3D8]/70 dark:border-[#2D3748]/70">
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                        
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">Test Percentage:</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={testScore}
                          onChange={(e) => setTestScore(Number(e.target.value))}
                          className="w-16 px-2 py-0.5 text-xs font-bold border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-[#1A202C] text-slate-900 dark:text-white text-center"
                        />
                        <span className="text-xs font-bold text-[#1F2937] dark:text-[#F9FAFB]">%</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div className="p-3 bg-white dark:bg-[#12161F] rounded-lg border border-[#EBE3D8] dark:border-[#2D3748]">
                        <span className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] block">Letter Grade</span>
                        <span className="text-lg font-black text-[#E05D38]">{simulatedOutcome.grade}</span>
                      </div>

                      <div className="p-3 bg-white dark:bg-[#12161F] rounded-lg border border-[#EBE3D8] dark:border-[#2D3748]">
                        <span className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] block">Grade Label</span>
                        <span className="text-sm font-bold text-[#1F2937] dark:text-[#F9FAFB]">{simulatedOutcome.label}</span>
                      </div>

                      <div className="p-3 bg-white dark:bg-[#12161F] rounded-lg border border-[#EBE3D8] dark:border-[#2D3748]">
                        <span className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] block">Certification Status</span>
                        {simulatedOutcome.isPassing ? (
                          <Badge variant="success" size="sm" dot>Eligible for Award</Badge>
                        ) : (
                          <Badge variant="warning" size="sm" dot>Try Again (Not Certified)</Badge>
                        )}
                      </div>
                    </div>

                    {!simulatedOutcome.isPassing && (
                      <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-[11px] text-amber-900 dark:text-amber-200">
                        <strong>Student-Facing Message:</strong> "{NON_PASSING_FEEDBACK}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default GradingSchemeEditor;
