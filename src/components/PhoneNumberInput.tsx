import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";

type CountryCode = "OM" | "AE";

interface Country {
  code: CountryCode;
  name: string;
  flag: string;
  dialCode: string;
  maxDigits: number;
  pattern: RegExp;
  placeholder: string;
}

const COUNTRIES: Record<CountryCode, Country> = {
  OM: {
    code: "OM",
    name: "Oman",
    flag: "🇴🇲",
    dialCode: "+968",
    maxDigits: 8,
    pattern: /^[1-9][0-9]{7}$/,
    placeholder: "91234567",
  },
  AE: {
    code: "AE",
    name: "UAE",
    flag: "🇦🇪",
    dialCode: "+971",
    maxDigits: 9,
    pattern: /^[2-9][0-9]{8}$/,
    placeholder: "501234567",
  },
};

interface PhoneNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  onCountryChange?: (country: CountryCode) => void;
  error?: string | null;
  label?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

export function PhoneNumberInput({
  value,
  onChange,
  onCountryChange,
  error,
  label,
  required = false,
  className = "",
  disabled = false,
}: PhoneNumberInputProps) {
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>("OM");
  const [showDropdown, setShowDropdown] = useState(false);

  // Detect country from existing phone number if it starts with country code
  useEffect(() => {
    if (value && value.startsWith("+")) {
      if (value.startsWith("+968")) {
        setSelectedCountry("OM");
        onChange(value.replace("+968", "").trim());
      } else if (value.startsWith("+971")) {
        setSelectedCountry("AE");
        onChange(value.replace("+971", "").trim());
      }
    }
  }, [value]);

  const currentCountry = COUNTRIES[selectedCountry];

  const normalizePhoneInput = (inputValue: string): string => {
    // Remove all non-digits
    const digitsOnly = inputValue.replace(/\D/g, "");
    // Limit to max digits for selected country
    return digitsOnly.slice(0, currentCountry.maxDigits);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = normalizePhoneInput(e.target.value);
    onChange(normalized);
  };

  const handleCountrySelect = (countryCode: CountryCode) => {
    setSelectedCountry(countryCode);
    setShowDropdown(false);
    // Clear input when switching countries
    onChange("");
    if (onCountryChange) {
      onCountryChange(countryCode);
    }
  };

  const validatePhone = (): string | null => {
    if (!value) {
      return required ? "Phone number is required" : null;
    }
    if (!currentCountry.pattern.test(value)) {
      return `Invalid ${currentCountry.name} phone number format`;
    }
    return null;
  };

  const displayError = error || validatePhone();

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative flex">
        {/* Country Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => !disabled && setShowDropdown(!showDropdown)}
            disabled={disabled}
            className="flex items-center gap-2 px-3 py-2 border-2 border-blue-400 border-r-0 rounded-l-lg bg-blue-50 hover:bg-blue-100 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:z-10 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            title="Click to select country (Oman or UAE)"
          >
            <span className="text-xl">{currentCountry.flag}</span>
            <span className="text-sm font-semibold text-gray-700">{currentCountry.dialCode}</span>
            <ChevronDown className={`w-4 h-4 text-blue-600 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown */}
          {showDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowDropdown(false)}
              />
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[200px]">
                {Object.values(COUNTRIES).map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => handleCountrySelect(country.code)}
                    className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors ${
                      selectedCountry === country.code ? "bg-blue-50" : ""
                    }`}
                  >
                    <span className="text-xl">{country.flag}</span>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-gray-900">{country.name}</div>
                      <div className="text-xs text-gray-500">{country.dialCode}</div>
                    </div>
                    {selectedCountry === country.code && (
                      <span className="text-blue-600">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Phone Input */}
        <input
          type="tel"
          value={value}
          onChange={handleInputChange}
          placeholder={currentCountry.placeholder}
          disabled={disabled}
          className={`flex-1 px-3 py-2 border rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            displayError ? "border-red-300" : "border-gray-300"
          }`}
        />
      </div>

      {/* Hint text */}
      <p className="mt-1 text-xs text-gray-500">
        Click the country code above to select Oman or UAE
      </p>

      {/* Display full phone number with country code */}
      {value && !displayError && (
        <p className="mt-1 text-xs text-gray-600 font-medium">
          Full number: {currentCountry.dialCode} {value}
        </p>
      )}

      {/* Error Message */}
      {displayError && (
        <p className="mt-1 text-sm text-red-600">{displayError}</p>
      )}
    </div>
  );
}

// Helper function to format phone number with country code
export function formatPhoneWithCountryCode(
  phoneNumber: string,
  countryCode: CountryCode
): string {
  if (!phoneNumber) return "";
  const country = COUNTRIES[countryCode];
  return `${country.dialCode}${phoneNumber}`;
}

// Helper function to parse phone number and extract country code
export function parsePhoneNumber(
  fullPhoneNumber: string
): { countryCode: CountryCode; phoneNumber: string } | null {
  if (!fullPhoneNumber) return null;

  if (fullPhoneNumber.startsWith("+968")) {
    return {
      countryCode: "OM",
      phoneNumber: fullPhoneNumber.replace("+968", "").trim(),
    };
  } else if (fullPhoneNumber.startsWith("+971")) {
    return {
      countryCode: "AE",
      phoneNumber: fullPhoneNumber.replace("+971", "").trim(),
    };
  }

  // Default to Oman if no country code detected
  return {
    countryCode: "OM",
    phoneNumber: fullPhoneNumber.replace(/\D/g, ""),
  };
}



















