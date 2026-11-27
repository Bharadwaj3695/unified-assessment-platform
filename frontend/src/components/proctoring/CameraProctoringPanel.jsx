import { Camera, Cpu, Eye, Lock, ShieldCheck } from 'lucide-react';

const DEFAULT_DISCLOSURE =
  'Camera preview is used for identity presence verification during this session. Video is not transmitted or recorded unless explicitly enabled by institutional policy.';

export default function CameraProctoringPanel({
  config = {},
  onChange,
  title = 'Proctoring & Camera Policy',
}) {
  const normalized = {
    cameraProctoringEnabled: Boolean(config.cameraProctoringEnabled),
    aiProctoringEnabled: Boolean(config.aiProctoringEnabled),
    liveMonitoringEnabled: Boolean(config.liveMonitoringEnabled),
    cameraPermissionRequired: Boolean(config.cameraPermissionRequired),
    disclosureText:
      config.disclosureText !== undefined ? config.disclosureText : DEFAULT_DISCLOSURE,
  };

  const updateField = (field, value) => {
    const next = {
      ...normalized,
      [field]: value,
    };
    // Keep cameraProctoringEnabled and aiProctoringEnabled strictly independent:
    // Enabling cameraProctoringEnabled MUST NOT auto-enable aiProctoringEnabled.
    if (field === 'cameraPermissionRequired' && value && !next.cameraProctoringEnabled) {
      next.cameraProctoringEnabled = true;
    }
    if (field === 'cameraProctoringEnabled' && !value && next.cameraPermissionRequired) {
      next.cameraPermissionRequired = false;
    }
    onChange(next);
  };

  return (
    <div
      data-testid="proctoring-config-panel"
      className="rounded-2xl border border-surface-light-border dark:border-surface-dark-border bg-slate-50/70 dark:bg-surface-dark-muted/40 p-4 sm:p-5 space-y-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-brand-primary" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
        </div>
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          Camera & AI controls are independent
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark cursor-pointer hover:border-brand-primary/50 transition">
          <input
            type="checkbox"
            checked={normalized.cameraProctoringEnabled}
            onChange={(e) => updateField('cameraProctoringEnabled', e.target.checked)}
            className="mt-0.5 rounded text-brand-primary focus:ring-brand-primary"
            data-testid="toggle-camera-proctoring"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
              <Camera className="w-3.5 h-3.5 text-brand-primary" />
              <span>Camera Proctoring</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Enables student floating camera preview and connection telemetry.
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark cursor-pointer hover:border-brand-primary/50 transition">
          <input
            type="checkbox"
            checked={normalized.cameraPermissionRequired}
            onChange={(e) => updateField('cameraPermissionRequired', e.target.checked)}
            className="mt-0.5 rounded text-brand-primary focus:ring-brand-primary"
            data-testid="toggle-camera-permission-required"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
              <Lock className="w-3.5 h-3.5 text-amber-500" />
              <span>Require Camera Permission</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Blocks session start until camera access is granted.
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark cursor-pointer hover:border-brand-primary/50 transition">
          <input
            type="checkbox"
            checked={normalized.aiProctoringEnabled}
            onChange={(e) => updateField('aiProctoringEnabled', e.target.checked)}
            className="mt-0.5 rounded text-brand-primary focus:ring-brand-primary"
            data-testid="toggle-ai-proctoring"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
              <Cpu className="w-3.5 h-3.5 text-indigo-500" />
              <span>AI Proctoring (Event Indicators)</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Optional event-based CV flags for faculty review. Never auto-fails.
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark cursor-pointer hover:border-brand-primary/50 transition">
          <input
            type="checkbox"
            checked={normalized.liveMonitoringEnabled}
            onChange={(e) => updateField('liveMonitoringEnabled', e.target.checked)}
            className="mt-0.5 rounded text-brand-primary focus:ring-brand-primary"
            data-testid="toggle-live-monitoring"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
              <Eye className="w-3.5 h-3.5 text-brand-sage" />
              <span>Faculty Live Monitoring</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Displays live session & camera health indicators to assigned faculty.
            </p>
          </div>
        </label>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Proctoring Disclosure & Consent Notice
        </label>
        <textarea
          rows={2}
          value={normalized.disclosureText}
          onChange={(e) => updateField('disclosureText', e.target.value)}
          placeholder={DEFAULT_DISCLOSURE}
          data-testid="input-proctoring-disclosure"
          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-surface-dark px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-primary"
        />
      </div>
    </div>
  );
}
