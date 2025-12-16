import React from "react";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function Logo({ className = "", size = "md", showText = true }: LogoProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-3xl",
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Custom Logo Icon - Healthcare/Medical Theme */}
      <div className={`${sizeClasses[size]} relative`}>
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Background Circle with Gradient */}
          <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366F1" />
              <stop offset="50%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#EC4899" />
            </linearGradient>
            <linearGradient id="logoGradientInner" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#818CF8" />
              <stop offset="100%" stopColor="#A78BFA" />
            </linearGradient>
          </defs>
          
          {/* Outer Glow Circle */}
          <circle
            cx="32"
            cy="32"
            r="30"
            fill="url(#logoGradient)"
            opacity="0.2"
            className="animate-pulse"
          />
          
          {/* Main Circle */}
          <circle
            cx="32"
            cy="32"
            r="26"
            fill="url(#logoGradient)"
            className="drop-shadow-lg"
          />
          
          {/* Inner Circle */}
          <circle
            cx="32"
            cy="32"
            r="20"
            fill="url(#logoGradientInner)"
          />
          
          {/* Medical Cross/Plus Symbol */}
          <rect
            x="28"
            y="18"
            width="8"
            height="28"
            rx="2"
            fill="white"
            className="drop-shadow-md"
          />
          <rect
            x="18"
            y="28"
            width="28"
            height="8"
            rx="2"
            fill="white"
            className="drop-shadow-md"
          />
          
          {/* Small Accent Dots */}
          <circle cx="20" cy="20" r="2" fill="white" opacity="0.6" />
          <circle cx="44" cy="20" r="2" fill="white" opacity="0.6" />
          <circle cx="20" cy="44" r="2" fill="white" opacity="0.6" />
          <circle cx="44" cy="44" r="2" fill="white" opacity="0.6" />
        </svg>
      </div>
      
      {/* Logo Text */}
      {showText && (
        <div className={`font-bold ${textSizes[size]} bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent`}>
          DiabetesRisk AI
        </div>
      )}
    </div>
  );
}

















