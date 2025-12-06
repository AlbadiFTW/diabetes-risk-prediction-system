import { useState, useEffect, useRef } from "react";
import { X, ChevronRight, ChevronLeft, Sparkles, Target } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string; // CSS selector for element to highlight
  position?: "top" | "bottom" | "left" | "right" | "center";
  action?: () => void; // Optional action to perform (e.g., switch tabs)
}

interface InteractiveTutorialProps {
  steps: TutorialStep[];
  onComplete: () => void;
  onSkip: () => void;
  role: "patient" | "doctor";
}

export function InteractiveTutorial({
  steps,
  onComplete,
  onSkip,
  role,
}: InteractiveTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightPosition, setHighlightPosition] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const updateTutorialStatus = useMutation(api.users.updateTutorialStatus);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  // Calculate highlight position when step changes
  useEffect(() => {
    if (step.targetSelector) {
      const element = document.querySelector(step.targetSelector);
      if (element) {
        // Execute action if provided (e.g., switch tabs)
        if (step.action) {
          step.action();
        }

        // Wait a bit for DOM to update after action
        setTimeout(() => {
          const updatedElement = document.querySelector(step.targetSelector!);
          if (updatedElement) {
            const rect = updatedElement.getBoundingClientRect();
            setHighlightPosition({
              top: rect.top + window.scrollY,
              left: rect.left + window.scrollX,
              width: rect.width,
              height: rect.height,
            });
          }
        }, 300);
      } else {
        setHighlightPosition(null);
      }
    } else {
      setHighlightPosition(null);
    }
  }, [currentStep, step.targetSelector, step.action]);

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    try {
      await updateTutorialStatus({ completed: true });
      onComplete();
      toast.success("Tutorial completed! You can restart it anytime from your profile.");
    } catch (error) {
      console.error("Failed to update tutorial status:", error);
      onComplete(); // Still close tutorial even if update fails
    }
  };

  const handleSkip = async () => {
    try {
      // Mark tutorial as completed even when skipped (so it doesn't show again)
      await updateTutorialStatus({ completed: true });
      onSkip();
    } catch (error) {
      console.error("Failed to update tutorial status:", error);
      onSkip(); // Still close tutorial even if update fails
    }
  };

  // Calculate tooltip position
  const getTooltipPosition = () => {
    if (!highlightPosition) {
      return { 
        top: "50%", 
        left: "50%", 
        transform: "translate(-50%, -50%)",
        position: "fixed" as const
      };
    }

    const position = step.position || "bottom";
    const spacing = 20;
    const tooltipWidth = 320; // max-w-sm = 320px
    const tooltipHeight = 400; // estimated max height
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = 0;
    let left = 0;
    let transform = "";

    switch (position) {
      case "top":
        top = Math.max(10, highlightPosition.top - spacing - tooltipHeight);
        left = highlightPosition.left + highlightPosition.width / 2;
        transform = "translate(-50%, -100%)";
        break;
      case "bottom":
        top = highlightPosition.top + highlightPosition.height + spacing;
        left = highlightPosition.left + highlightPosition.width / 2;
        transform = "translate(-50%, 0)";
        // Ensure tooltip doesn't go below viewport
        if (top + tooltipHeight > viewportHeight - 10) {
          top = viewportHeight - tooltipHeight - 10;
        }
        break;
      case "left":
        top = highlightPosition.top + highlightPosition.height / 2;
        left = Math.max(10, highlightPosition.left - spacing - tooltipWidth);
        transform = "translate(-100%, -50%)";
        break;
      case "right":
        top = highlightPosition.top + highlightPosition.height / 2;
        left = highlightPosition.left + highlightPosition.width + spacing;
        transform = "translate(0, -50%)";
        // Ensure tooltip doesn't go beyond viewport
        if (left + tooltipWidth > viewportWidth - 10) {
          left = viewportWidth - tooltipWidth - 10;
        }
        break;
      case "center":
        top = highlightPosition.top + highlightPosition.height / 2;
        left = highlightPosition.left + highlightPosition.width / 2;
        transform = "translate(-50%, -50%)";
        break;
      default:
        top = highlightPosition.top + highlightPosition.height + spacing;
        left = highlightPosition.left + highlightPosition.width / 2;
        transform = "translate(-50%, 0)";
        if (top + tooltipHeight > viewportHeight - 10) {
          top = viewportHeight - tooltipHeight - 10;
        }
    }

    // Ensure tooltip stays within viewport bounds
    left = Math.max(10, Math.min(left, viewportWidth - tooltipWidth - 10));
    top = Math.max(10, Math.min(top, viewportHeight - tooltipHeight - 10));

    return {
      top: `${top}px`,
      left: `${left}px`,
      transform,
      position: "fixed" as const,
    };
  };

  return (
    <>
      {/* Overlay with cutout for highlighted element */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[9998] pointer-events-auto"
        onClick={(e) => {
          // Prevent clicks on overlay from propagating
          e.stopPropagation();
        }}
        style={{
          background: highlightPosition
            ? `radial-gradient(ellipse ${highlightPosition.width + 40}px ${highlightPosition.height + 40}px at ${highlightPosition.left + highlightPosition.width / 2}px ${highlightPosition.top + highlightPosition.height / 2}px, transparent 0%, transparent 60%, rgba(0, 0, 0, 0.7) 100%)`
            : "rgba(0, 0, 0, 0.7)",
        }}
      />

      {/* Highlight border */}
      {highlightPosition && (
        <div
          className="fixed z-[9999] pointer-events-none border-4 border-indigo-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] animate-pulse"
          style={{
            top: `${highlightPosition.top - 4}px`,
            left: `${highlightPosition.left - 4}px`,
            width: `${highlightPosition.width + 8}px`,
            height: `${highlightPosition.height + 8}px`,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="fixed z-[10000] pointer-events-auto"
        style={getTooltipPosition()}
        onClick={(e) => {
          // Ensure clicks on tooltip work
          e.stopPropagation();
        }}
      >
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-[calc(100vw-2rem)] sm:w-[320px] border border-gray-200 overflow-hidden flex flex-col max-h-[80vh] relative">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-3 sm:p-4 text-white">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                <h3 className="font-bold text-base sm:text-lg">Tutorial</h3>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSkip();
                }}
                className="text-white/80 hover:text-white transition-colors p-2 relative z-20 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
                title="Skip tutorial"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Target className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>
                Step {currentStep + 1} of {steps.length}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto">
            <h4 className="font-bold text-gray-900 mb-2 text-lg">
              {step.title}
            </h4>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              {step.description}
            </p>

            {/* Progress bar */}
            <div className="mb-6">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${((currentStep + 1) / steps.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Navigation - Always visible at bottom */}
          <div className="p-6 pt-0 flex items-center justify-between gap-3 flex-shrink-0 border-t border-gray-100 relative z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevious();
                }}
                disabled={isFirstStep}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative z-20"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-indigo-500/50 relative z-20"
              >
                {isLastStep ? "Complete" : "Next"}
                {!isLastStep && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
    </>
  );
}


