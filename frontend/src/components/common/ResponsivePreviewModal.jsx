import { useState, useEffect, useRef } from 'react';
import {
  Smartphone,
  Tablet,
  Laptop,
  Monitor,
  RotateCw,
  RefreshCw,
  Maximize2,
  Minimize2,
  X,
  ExternalLink,
  ShieldCheck,
  Compass,
} from 'lucide-react';
import { useAdminPreview, VIEWPORT_PRESETS } from '../../context/AdminPreviewContext';

const PREVIEW_ROUTES = [
  { path: '/admin/dashboard', label: 'System Overview' },
  { path: '/admin/users', label: 'User Management' },
  { path: '/admin/assessments', label: 'All Assessments' },
  { path: '/admin/logs', label: 'Audit Logs' },
  { path: '/admin/settings', label: 'Platform Settings' },
  { path: '/admin/profile', label: 'Admin Profile' },
];

const ResponsivePreviewModal = () => {
  const {
    isPreviewOpen,
    activePreset,
    activePresetId,
    previewRoute,
    scaleMode,
    orientation,
    closePreview,
    setActivePresetId,
    setPreviewRoute,
    setScaleMode,
    toggleOrientation,
  } = useAdminPreview();

  const [containerDimensions, setContainerDimensions] = useState({ width: 1200, height: 800 });
  const [iframeKey, setIframeKey] = useState(0);
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const containerRef = useRef(null);
  const iframeRef = useRef(null);

  // Measure stage dimensions to auto-scale larger viewports on smaller screens
  useEffect(() => {
    if (!isPreviewOpen) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerDimensions({
          width: Math.max(rect.width - 48, 320),
          height: Math.max(rect.height - 48, 400),
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [isPreviewOpen]);

  // Reset loading spinner whenever route, preset, or refresh changes
  useEffect(() => {
    setIsIframeLoading(true);
  }, [previewRoute, activePresetId, iframeKey]);

  if (!isPreviewOpen) return null;

  // Calculate proportional scale factor so preset fits comfortably within admin viewport
  const scale =
    scaleMode === 'fit'
      ? Math.min(
          containerDimensions.width / activePreset.width,
          containerDimensions.height / activePreset.height,
          1
        )
      : 1;

  const iframeSrc = `${window.location.origin}${previewRoute}${
    previewRoute.includes('?') ? '&' : '?'
  }preview=1`;

  const handleReload = () => {
    setIsIframeLoading(true);
    setIframeKey((prev) => prev + 1);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Responsive Device Viewport Preview"
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md text-slate-100 animate-in fade-in duration-150"
    >
      {/* Top Control Toolbar */}
      <header className="flex-shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-900 border-b border-slate-800 shadow-md">
        {/* Left: Branding & Current Dimensions Chip */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#E05D38] to-[#F4A261] flex items-center justify-center text-white font-bold text-xs shadow-xs">
              U
            </div>
            <span className="font-bold text-xs sm:text-sm tracking-tight hidden md:inline">
              Responsive Preview
            </span>
          </div>

          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 font-mono text-[11px] text-slate-300">
            <span className="font-semibold text-[#F4A261]">{activePreset.width}</span>
            <span className="text-slate-500">×</span>
            <span className="font-semibold text-[#F4A261]">{activePreset.height}</span>
            <span className="text-[10px] text-slate-500 ml-1 hidden sm:inline">
              ({activePreset.shortName})
            </span>
          </div>
        </div>

        {/* Center: Device Presets Selection Buttons */}
        <div className="flex items-center overflow-x-auto no-scrollbar space-x-1 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
          {VIEWPORT_PRESETS.map((preset) => {
            const Icon = preset.icon;
            const isSelected = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                data-testid={`preset-${preset.id}`}
                onClick={() => setActivePresetId(preset.id)}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex-shrink-0 ${
                  isSelected
                    ? 'bg-[#E05D38] text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                aria-pressed={isSelected}
                aria-label={`Switch to ${preset.name} (${preset.width} by ${preset.height})`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{preset.shortName}</span>
                <span className="text-[10px] opacity-75 font-mono hidden lg:inline">
                  {preset.width}x{preset.height}
                </span>
              </button>
            );
          })}

          {/* Device Orientation Toggle (for mobile and tablet) */}
          {(activePresetId === 'mobile' || activePresetId === 'tablet') && (
            <button
              type="button"
              onClick={toggleOrientation}
              title={`Rotate orientation to ${orientation === 'portrait' ? 'landscape' : 'portrait'}`}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors ml-1"
              aria-label="Rotate device orientation"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Scale Mode Toggle: Fit vs 100% Native */}
          <button
            type="button"
            onClick={() => setScaleMode((prev) => (prev === 'fit' ? 'native' : 'fit'))}
            title={scaleMode === 'fit' ? 'Switch to 100% Native Scale' : 'Fit to Viewport'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label={scaleMode === 'fit' ? '100% Native scale' : 'Fit to screen'}
          >
            {scaleMode === 'fit' ? (
              <Maximize2 className="w-3.5 h-3.5" />
            ) : (
              <Minimize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Right: Route Selector, Reload & Return to Desktop Exit */}
        <div className="flex items-center space-x-2">
          {/* Quick Route Selector */}
          <div className="relative hidden xl:flex items-center">
            <Compass className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
            <select
              value={previewRoute}
              onChange={(e) => setPreviewRoute(e.target.value)}
              className="pl-7 pr-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-[#E05D38]"
              aria-label="Select preview page route"
            >
              {PREVIEW_ROUTES.map((r) => (
                <option key={r.path} value={r.path}>
                  {r.label} ({r.path})
                </option>
              ))}
            </select>
          </div>

          {/* Reload Preview Iframe */}
          <button
            type="button"
            onClick={handleReload}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Reload preview window"
            aria-label="Reload preview"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isIframeLoading ? 'animate-spin text-[#E05D38]' : ''}`} />
          </button>

          {/* Return to Desktop Button */}
          <button
            type="button"
            onClick={closePreview}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-all shadow-xs cursor-pointer"
            aria-label="Return to Desktop"
            title="Return to Desktop View"
          >
            <Monitor className="w-3.5 h-3.5 text-slate-300" />
            <span>Return to Desktop</span>
            <X className="w-3.5 h-3.5 ml-1 text-slate-400" />
          </button>
        </div>
      </header>

      {/* Main Preview Stage Area */}
      <main
        ref={containerRef}
        className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center bg-slate-950/70"
      >
        {/* Device Frame Wrapper with proportional scaling */}
        <div
          className="relative transition-all duration-300 ease-out flex flex-col items-center justify-center"
          style={{
            width: `${activePreset.width * scale}px`,
            height: `${activePreset.height * scale + 32}px`,
          }}
        >
          {/* Hardware Device Container */}
          <div
            className={`relative transition-all duration-300 ease-out origin-top border shadow-2xl bg-white dark:bg-slate-900 ${
              activePreset.category === 'phone'
                ? 'rounded-[36px] border-slate-700 ring-8 ring-slate-800/80'
                : activePreset.category === 'tablet'
                ? 'rounded-[26px] border-slate-700 ring-6 ring-slate-800/70'
                : 'rounded-xl border-slate-700 ring-2 ring-slate-800/50'
            }`}
            style={{
              width: `${activePreset.width}px`,
              height: `${activePreset.height}px`,
              transform: scale < 1 ? `scale(${scale})` : undefined,
              transformOrigin: 'top center',
            }}
          >
            {/* Top Phone / Tablet Speaker Notch */}
            {(activePreset.category === 'phone' || activePreset.category === 'tablet') && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-3.5 bg-slate-900 rounded-full z-20 flex items-center justify-center pointer-events-none">
                <div className="w-3 h-3 rounded-full bg-slate-800 border border-slate-700 mr-2" />
                <div className="w-8 h-1 bg-slate-800 rounded-full" />
              </div>
            )}

            {/* Loading Overlay */}
            {isIframeLoading && (
              <div className="absolute inset-0 z-10 bg-slate-900/60 backdrop-blur-xs flex flex-col items-center justify-center text-slate-300 space-y-2 pointer-events-none">
                <RefreshCw className="w-6 h-6 animate-spin text-[#E05D38]" />
                <span className="text-xs font-medium">Bootstrapping {activePreset.name}...</span>
              </div>
            )}

            {/* Isolated Same-Origin Application Iframe */}
            <iframe
              key={`${iframeKey}-${activePreset.id}-${orientation}`}
              ref={iframeRef}
              src={iframeSrc}
              title="UAP Responsive Viewport Preview"
              onLoad={() => setIsIframeLoading(false)}
              className="w-full h-full border-0 rounded-inherit overflow-auto bg-white dark:bg-[#12161F]"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
            />
          </div>

          {/* Device Dimension & Frame Footer Label */}
          <div className="mt-2 text-center text-[11px] font-mono text-slate-500">
            {activePreset.deviceFrame} · {activePreset.width} × {activePreset.height} px
            {scale < 1 && ` · Scaled to ${(scale * 100).toFixed(0)}%`}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ResponsivePreviewModal;
