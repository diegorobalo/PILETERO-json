import { useState, useEffect } from 'react';

/**
 * Hook to detect if user is on mobile or desktop device
 * Uses window width as the basis for detection
 * Mobile: window.innerWidth < 768px (Tailwind md breakpoint)
 * Desktop: window.innerWidth >= 768px
 *
 * @returns {boolean} isMobile - true if width < 768px, false otherwise
 */
export function useDeviceType() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}
