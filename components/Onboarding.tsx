'use client';

import { debug, info, warn, logError } from '@/lib/utils/logger.client';
import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { TOUR_TARGETS, type TourTargetId } from '@/lib/onboardingTargets';

interface OnboardingStep {
  id: string;
  target: TourTargetId; // Must be one of TOUR_TARGETS — enforces single source of truth
  titleKey: string;
  descriptionKey: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'preview',
    target: TOUR_TARGETS.preview,
    titleKey: 'steps.preview.title',
    descriptionKey: 'steps.preview.description',
    position: 'bottom',
  },
  {
    id: 'timeline',
    target: TOUR_TARGETS.timeline,
    titleKey: 'steps.timeline.title',
    descriptionKey: 'steps.timeline.description',
    position: 'top',
  },
  {
    id: 'subtitle-button',
    target: TOUR_TARGETS.subtitleButton,
    titleKey: 'steps.subtitleButton.title',
    descriptionKey: 'steps.subtitleButton.description',
    position: 'right',
  },
  {
    id: 'properties-button',
    target: TOUR_TARGETS.propertiesButton,
    titleKey: 'steps.propertiesButton.title',
    descriptionKey: 'steps.propertiesButton.description',
    position: 'right',
  },
  {
    id: 'bgm-button',
    target: TOUR_TARGETS.bgmButton,
    titleKey: 'steps.bgmButton.title',
    descriptionKey: 'steps.bgmButton.description',
    position: 'right',
  },
  {
    id: 'export-button',
    target: TOUR_TARGETS.exportButton,
    titleKey: 'steps.exportButton.title',
    descriptionKey: 'steps.exportButton.description',
    position: 'left',
  },
];

const ONBOARDING_STORAGE_KEY = 'video-editor-onboarding-completed';

interface OnboardingProps {
  /**
   * Parent-controlled replay trigger. When this value changes to a truthy
   * number, the tour restarts regardless of whether the user has completed
   * it before. Intended to back a "Show tour again" button in the toolbar.
   */
  replayKey?: number;
  onComplete?: () => void;
}

export function Onboarding({ replayKey = 0, onComplete }: OnboardingProps) {
  const t = useTranslations('onboarding');
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // First-visit auto-show: honour the completion flag on initial mount only.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!completed) {
      setIsVisible(true);
    }
  }, []);

  // Dev-only audit: when the tour becomes visible, sweep the DOM once for every
  // registered target and log the full list of missing targets up-front. This
  // turns "VideoEditor refactor deletes an id" from a silent failure at step N
  // into a single loud warning at tour start.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (!isVisible) return;
    // Wait two animation frames so the editor's initial paint is stable.
    const id = window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => {
        const missing = ONBOARDING_STEPS
          .map((s) => s.target)
          .filter((t) => !document.getElementById(t));
        if (missing.length > 0) {
          warn(
            '[Onboarding] Tour targets missing from DOM: ' +
              missing.join(', ') +
              '. Update lib/onboardingTargets.ts or restore the id on the element.',
          );
        }
      }),
    );
    return () => window.cancelAnimationFrame(id);
  }, [isVisible]);

  // Replay: bumping `replayKey` resets state and forces the tour to show
  // even when the completion flag exists.
  useEffect(() => {
    if (replayKey <= 0) return;
    try {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    } catch {
      /* non-fatal */
    }
    setCurrentStep(0);
    setTargetElement(null);
    setIsVisible(true);
  }, [replayKey]);

  // Find the current step's target DOM element. VideoEditor is a monolithic
  // component with a slow first paint, so the target may not exist when the
  // effect first runs. We combine an immediate check with a MutationObserver
  // that fires when the subtree changes, and cap the whole thing with a
  // timeout so we never spin forever.
  useEffect(() => {
    if (!isVisible || currentStep >= ONBOARDING_STEPS.length) return;
    const step = ONBOARDING_STEPS[currentStep];
    if (!step) return;

    let cancelled = false;
    const TIMEOUT_MS = 8000;

    const findTarget = (): HTMLElement | null => {
      return (
        document.getElementById(step.target) ||
        (document.querySelector(`.${step.target}`) as HTMLElement | null) ||
        (document.querySelector(`[data-onboarding="${step.target}"]`) as HTMLElement | null)
      );
    };

    const resolveWith = (element: HTMLElement | null) => {
      if (cancelled) return;
      setTargetElement(element);
      if (element) {
        // Let React commit positioning state before scrolling so the
        // getBoundingClientRect() reads in the highlight effect are fresh.
        setTimeout(() => {
          if (!cancelled) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
      }
    };

    const immediate = findTarget();
    if (immediate) {
      resolveWith(immediate);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = findTarget();
      if (el) {
        observer.disconnect();
        resolveWith(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const timeoutId = window.setTimeout(() => {
      observer.disconnect();
      if (!cancelled && !findTarget()) {
        warn(`[Onboarding] target not found after ${TIMEOUT_MS}ms: ${step.target}`);
        // Fall through: the tooltip will render centered via getTooltipPosition.
        resolveWith(null);
      }
    }, TIMEOUT_MS);

    return () => {
      cancelled = true;
      observer.disconnect();
      clearTimeout(timeoutId);
    };
  }, [currentStep, isVisible]);

  // Brighten the highlighted target. Cleanup restores its original style.
  useEffect(() => {
    if (!targetElement || !isVisible) return;
    const originalStyle = {
      filter: targetElement.style.filter,
      zIndex: targetElement.style.zIndex,
      position: targetElement.style.position,
    };
    targetElement.style.filter = 'brightness(1.2)';
    targetElement.style.zIndex = '10000';
    if (getComputedStyle(targetElement).position === 'static') {
      targetElement.style.position = 'relative';
    }
    return () => {
      targetElement.style.filter = originalStyle.filter;
      targetElement.style.zIndex = originalStyle.zIndex;
      targetElement.style.position = originalStyle.position;
    };
  }, [targetElement, isVisible]);

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } catch {
      /* non-fatal */
    }
    setIsVisible(false);
    if (onComplete) {
      onComplete();
    }
  };

  if (!isVisible || currentStep >= ONBOARDING_STEPS.length) {
    return null;
  }

  const step = ONBOARDING_STEPS[currentStep];
  const targetRect = targetElement?.getBoundingClientRect();

  const getTooltipPosition = () => {
    if (!targetRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const spacing = 20;
    const tooltipWidth = 320;
    const tooltipHeight = 200;
    const isExportButton = step.id === 'export-button';
    const topOffset = isExportButton ? -40 : 0;
    const minTop = 20;

    switch (step.position) {
      case 'top':
        return {
          top: `${targetRect.top - tooltipHeight - spacing}px`,
          left: `${targetRect.left + targetRect.width / 2}px`,
          transform: 'translate(-50%, -100%)',
        };
      case 'bottom':
        return {
          top: `${targetRect.bottom + spacing}px`,
          left: `${targetRect.left + targetRect.width / 2}px`,
          transform: 'translate(-50%, 0)',
        };
      case 'left': {
        const calculatedTop = targetRect.top + targetRect.height / 2 + topOffset;
        const tooltipTop = Math.max(minTop, calculatedTop - tooltipHeight / 2);
        return {
          top: `${tooltipTop}px`,
          left: `${targetRect.left - tooltipWidth - spacing}px`,
          transform: 'translate(-100%, 0)',
        };
      }
      case 'right':
        return {
          top: `${targetRect.top + targetRect.height / 2}px`,
          left: `${targetRect.right + spacing}px`,
          transform: 'translate(0, -50%)',
        };
      default:
        return {
          top: `${targetRect.top + targetRect.height / 2}px`,
          left: `${targetRect.left + targetRect.width / 2}px`,
          transform: 'translate(-50%, -50%)',
        };
    }
  };

  return (
    <>
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[9998] bg-black/70 transition-opacity"
        onClick={handleNext}
      />

      {targetRect && (
        <div
          className="fixed z-[9999] pointer-events-none transition-all duration-300"
          style={{
            top: `${targetRect.top - 4}px`,
            left: `${targetRect.left - 4}px`,
            width: `${targetRect.width + 8}px`,
            height: `${targetRect.height + 8}px`,
            boxShadow:
              '0 0 0 9999px rgba(0, 0, 0, 0.8), 0 0 0 4px rgba(99, 102, 241, 0.9), 0 0 30px rgba(99, 102, 241, 0.6), inset 0 0 20px rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.05)',
          }}
        />
      )}

      <div
        ref={tooltipRef}
        className="fixed z-[10000] bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-indigo-500/50 rounded-2xl p-6 shadow-2xl max-w-sm pointer-events-auto"
        style={getTooltipPosition()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">{t(step.titleKey)}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>{currentStep + 1}</span>
              <span>/</span>
              <span>{ONBOARDING_STEPS.length}</span>
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label={t('skipAria')}
          >
            ✕
          </button>
        </div>

        <p className="text-gray-300 mb-6 leading-relaxed">{t(step.descriptionKey)}</p>

        <div className="flex items-center justify-end">
          <button
            onClick={handleNext}
            className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-lg font-semibold transition-all"
          >
            {currentStep === ONBOARDING_STEPS.length - 1 ? t('finish') : t('next')}
          </button>
        </div>
      </div>
    </>
  );
}
