import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to trigger entrance animations when a component enters the viewport.
 * Automatically falls back to visible if IntersectionObserver is unsupported or in test environments.
 */
export const useScrollReveal = (options = { threshold: 0.12, triggerOnce: true }) => {
  const domRef = useRef(null);
  const [isVisible, setVisible] = useState(false);

  useEffect(() => {
    // Graceful fallback for environments without IntersectionObserver (JSDOM, SSR, legacy browsers)
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        if (options.triggerOnce && domRef.current) {
          observer.unobserve(domRef.current);
        }
      } else if (!options.triggerOnce) {
        setVisible(false);
      }
    }, options);

    const currentElem = domRef.current;
    if (currentElem) {
      observer.observe(currentElem);
    }

    return () => {
      if (currentElem) {
        observer.unobserve(currentElem);
      }
    };
  }, [options.threshold, options.triggerOnce]);

  return [domRef, isVisible];
};

export default useScrollReveal;
