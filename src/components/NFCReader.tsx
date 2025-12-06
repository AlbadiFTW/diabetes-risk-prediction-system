import { useState, useEffect } from "react";
import { Smartphone, AlertCircle, CheckCircle, X } from "lucide-react";
import { toast } from "sonner";

interface NFCReaderProps {
  onDataRead: (data: NFCGlucoseData) => void;
  disabled?: boolean;
}

interface NFCGlucoseData {
  glucose: number;
  unit?: string;
  timestamp?: string;
  device?: string;
  hba1c?: number;
  insulin?: number;
}

// Check if Web NFC API is available
function isNFCSupported(): boolean {
  return "NDEFReader" in window;
}

// Check if running on HTTPS (required for Web NFC)
function isSecureContext(): boolean {
  return window.isSecureContext;
}

// Parse NDEF message to extract glucose data
function parseNFCData(record: NDEFRecord): NFCGlucoseData | null {
  try {
    // Try to decode as text
    if (record.recordType === "text") {
      const decoder = new TextDecoder();
      const text = decoder.decode(record.data);
      
      // Try to parse as JSON
      try {
        const json = JSON.parse(text);
        if (json.glucose || json.bloodGlucose || json.bg) {
          return {
            glucose: json.glucose || json.bloodGlucose || json.bg,
            unit: json.unit || "mg/dL",
            timestamp: json.timestamp || new Date().toISOString(),
            device: json.device || json.deviceName,
            hba1c: json.hba1c || json.hba1C,
            insulin: json.insulin,
          };
        }
      } catch {
        // Not JSON, try to extract number from text
        const glucoseMatch = text.match(/(\d+(?:\.\d+)?)\s*(mg\/dL|mmol\/L|mgdl|mmol)/i);
        if (glucoseMatch) {
          const value = parseFloat(glucoseMatch[1]);
          const unit = glucoseMatch[2].toLowerCase().includes("mmol") ? "mmol/L" : "mg/dL";
          
          // Convert mmol/L to mg/dL if needed
          const glucose = unit === "mmol/L" ? value * 18.0182 : value;
          
          return {
            glucose: Math.round(glucose * 10) / 10,
            unit: "mg/dL",
            timestamp: new Date().toISOString(),
          };
        }
      }
    }
    
    // Try to decode as URL
    if (record.recordType === "url") {
      const decoder = new TextDecoder();
      const url = decoder.decode(record.data);
      const params = new URLSearchParams(url.split("?")[1] || "");
      
      const glucose = params.get("glucose") || params.get("bg");
      if (glucose) {
        return {
          glucose: parseFloat(glucose),
          unit: "mg/dL",
          timestamp: new Date().toISOString(),
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error parsing NFC data:", error);
    return null;
  }
}

export function NFCReader({ onDataRead, disabled = false }: NFCReaderProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRead, setLastRead] = useState<NFCGlucoseData | null>(null);

  useEffect(() => {
    // Check NFC support on mount
    const supported = isNFCSupported() && isSecureContext();
    setIsSupported(supported);
    
    if (!supported) {
      if (!isSecureContext()) {
        setError("NFC requires HTTPS connection. Please use a secure connection.");
      } else if (!isNFCSupported()) {
        setError("NFC is not supported on this device or browser. Try using Chrome on Android.");
      }
    }
  }, []);

  const handleScan = async () => {
    if (!isSupported || disabled) {
      return;
    }

    setIsScanning(true);
    setError(null);

    try {
      // @ts-ignore - Web NFC API types may not be available
      const reader = new NDEFReader();
      
      // Start scanning
      await reader.scan();
      
      // Listen for NFC tag reading
      reader.addEventListener("reading", (event: any) => {
        const message = event.message;
        
        if (message.records && message.records.length > 0) {
          // Try to parse each record
          for (const record of message.records) {
            const data = parseNFCData(record);
            if (data) {
              setLastRead(data);
              onDataRead(data);
              setIsScanning(false);
              
              toast.success(
                `Glucose reading: ${data.glucose} ${data.unit || "mg/dL"}${data.device ? ` from ${data.device}` : ""}`
              );
              
              // Stop scanning after successful read
              reader.stop();
              return;
            }
          }
          
          // If no data found, show error
          setError("Could not find glucose data in NFC tag. Please ensure your device is NFC-enabled and try again.");
          setIsScanning(false);
        } else {
          setError("NFC tag is empty or not readable.");
          setIsScanning(false);
        }
      });

      // Handle errors
      reader.addEventListener("readingerror", (event: any) => {
        console.error("NFC reading error:", event);
        setError("Failed to read NFC tag. Please try again.");
        setIsScanning(false);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (isScanning) {
          reader.stop();
          setError("Scan timeout. Please bring your device closer to the NFC tag and try again.");
          setIsScanning(false);
        }
      }, 30000);

    } catch (err: any) {
      console.error("NFC scan error:", err);
      
      if (err.name === "NotAllowedError") {
        setError("NFC permission denied. Please allow NFC access in your browser settings.");
      } else if (err.name === "NotSupportedError") {
        setError("NFC is not supported on this device.");
      } else {
        setError(err.message || "Failed to start NFC scan. Please try again.");
      }
      
      setIsScanning(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-800 mb-1">NFC Not Available</p>
            <p className="text-xs text-yellow-700">
              {error || "NFC is not supported on this device or browser. Please use Chrome on an Android device, or enter data manually."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleScan}
        disabled={disabled || isScanning}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
      >
        {isScanning ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Scanning... Bring device near NFC tag</span>
          </>
        ) : (
          <>
            <Smartphone className="w-5 h-5" />
            <span>Scan NFC Device</span>
          </>
        )}
      </button>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <X className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {lastRead && !error && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800 mb-1">Data Read Successfully</p>
              <p className="text-xs text-green-700">
                Glucose: {lastRead.glucose} {lastRead.unit || "mg/dL"}
                {lastRead.device && ` • Device: ${lastRead.device}`}
              </p>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 text-center">
        Hold your phone near the NFC-enabled glucose meter to automatically import readings.
        <br />
        <span className="text-gray-400">Works on Android devices with Chrome browser.</span>
      </p>
    </div>
  );
}

// Helper function to convert glucose data to form values
export function convertNFCDataToForm(nfcData: NFCGlucoseData): {
  glucoseLevel?: string;
  hba1c?: string;
  insulinLevel?: string;
} {
  const formData: {
    glucoseLevel?: string;
    hba1c?: string;
    insulinLevel?: string;
  } = {};

  if (nfcData.glucose) {
    formData.glucoseLevel = nfcData.glucose.toString();
  }

  if (nfcData.hba1c) {
    formData.hba1c = nfcData.hba1c.toString();
  }

  if (nfcData.insulin) {
    formData.insulinLevel = nfcData.insulin.toString();
  }

  return formData;
}







