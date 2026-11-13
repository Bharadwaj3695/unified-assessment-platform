import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Smartphone, Tablet, Laptop, Monitor } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export const VIEWPORT_PRESETS = [
  {
    id: 'mobile',
    name: 'Mobile Phone',
    shortName: 'Mobile',
    width: 390,
    height: 844,
    icon: Smartphone,
    category: 'phone',
    deviceFrame: 'iPhone 14 / Modern Phone',
  },
  {
    id: 'tablet',
    name: 'Tablet Portrait',
    shortName: 'Tablet',
    width: 768,
    height: 1024,
    icon: Tablet,
    category: 'tablet',
    deviceFrame: 'iPad Mini / Standard Tablet',
  },
  {
    id: 'laptop',
    name: 'Compact Laptop',
    shortName: 'Laptop',
    width: 1366,
    height: 768,
    icon: Laptop,
    category: 'laptop',
    deviceFrame: '13-inch HD Laptop Display',
  },
  {
    id: 'desktop',
    name: 'Large Desktop Monitor',
    shortName: 'Desktop',
    width: 1920,
    height: 1080,
    icon: Monitor,
    category: 'desktop',
    deviceFrame: 'Full HD 1080p Desktop Display',
  },
];

const AdminPreviewContext = createContext(null);

export const AdminPreviewProvider = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [activePresetId, setActivePresetId] = useState('mobile');
  const [previewRoute, setPreviewRoute] = useState(location.pathname || '/admin/dashboard');
  const [scaleMode, setScaleMode] = useState('fit'); // 'fit' | 'native'
  const [orientation, setOrientation] = useState('portrait'); // 'portrait' | 'landscape'

  // Detect whether the current window is executing inside the preview iframe
  const isInsideIframe = useMemo(() => {
    if (typeof window === 'undefined') return false;
    try {
      const hasPreviewParam = new URLSearchParams(window.location.search).get('preview') === '1';
      const isNestedFrame = window.self !== window.top;
      return hasPreviewParam || isNestedFrame;
    } catch {
      return false;
    }
  }, []);

  // True if preview modal is open in parent OR if current document is inside the iframe
  const isPreviewActive = isPreviewOpen || isInsideIframe;

  const activePreset = useMemo(() => {
    const base = VIEWPORT_PRESETS.find((p) => p.id === activePresetId) || VIEWPORT_PRESETS[0];
    if (orientation === 'landscape' && (base.id === 'mobile' || base.id === 'tablet')) {
      return {
        ...base,
        width: base.height,
        height: base.width,
        deviceFrame: `${base.deviceFrame} (Landscape)`,
      };
    }
    return base;
  }, [activePresetId, orientation]);

  const openPreview = useCallback((initialPresetId, customRoute) => {
    if (user?.role !== 'admin') return;
    if (initialPresetId && VIEWPORT_PRESETS.some((p) => p.id === initialPresetId)) {
      setActivePresetId(initialPresetId);
    }
    if (customRoute) {
      setPreviewRoute(customRoute);
    } else {
      setPreviewRoute(location.pathname || '/admin/dashboard');
    }
    setIsPreviewOpen(true);
  }, [user, location.pathname]);

  const closePreview = useCallback(() => {
    setIsPreviewOpen(false);
    // If inside iframe, notify parent window to close preview modal
    if (isInsideIframe && typeof window !== 'undefined' && window.parent) {
      window.parent.postMessage({ type: 'UAP_CLOSE_PREVIEW' }, '*');
    }
  }, [isInsideIframe]);

  const toggleOrientation = useCallback(() => {
    setOrientation((prev) => (prev === 'portrait' ? 'landscape' : 'portrait'));
  }, []);

  // Listen for close preview postMessage events from child preview iframe
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'UAP_CLOSE_PREVIEW') {
        setIsPreviewOpen(false);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Lock body scroll and trap keyboard Escape while preview modal is open
  useEffect(() => {
    if (isPreviewOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          closePreview();
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = originalOverflow || 'unset';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isPreviewOpen, closePreview]);

  const value = useMemo(
    () => ({
      isPreviewOpen,
      isPreviewActive,
      isInsideIframe,
      activePreset,
      activePresetId,
      previewRoute,
      scaleMode,
      orientation,
      openPreview,
      closePreview,
      setActivePresetId,
      setPreviewRoute,
      setScaleMode,
      toggleOrientation,
    }),
    [
      isPreviewOpen,
      isPreviewActive,
      isInsideIframe,
      activePreset,
      activePresetId,
      previewRoute,
      scaleMode,
      orientation,
      openPreview,
      closePreview,
      toggleOrientation,
    ]
  );

  return <AdminPreviewContext.Provider value={value}>{children}</AdminPreviewContext.Provider>;
};

export const useAdminPreview = () => {
  const context = useContext(AdminPreviewContext);
  if (!context) {
    return {
      isPreviewOpen: false,
      isPreviewActive: false,
      isInsideIframe: false,
      activePreset: VIEWPORT_PRESETS[0],
      activePresetId: 'mobile',
      previewRoute: '/admin/dashboard',
      scaleMode: 'fit',
      orientation: 'portrait',
      openPreview: () => {},
      closePreview: () => {},
      setActivePresetId: () => {},
      setPreviewRoute: () => {},
      setScaleMode: () => {},
      toggleOrientation: () => {},
    };
  }
  return context;
};

export default AdminPreviewContext;
