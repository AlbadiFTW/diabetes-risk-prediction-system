/**
 * ML API Client for diabetes risk prediction
 * Handles communication with the Flask ML API
 */

export interface MLPredictionRequest {
  age: number;
  bmi: number;
  glucose: number;
  bloodPressure: number;
  insulin: number;
  skinThickness: number;
  pregnancies: number;
  familyHistory: number;
  gender: "male" | "female";
  systolicBP?: number;
  diastolicBP?: number;
  heartRate?: number;
  hba1c?: number;
  exerciseFrequency?: string;
  smokingStatus?: string;
  alcoholConsumption?: string;
  familyHistoryFlag?: boolean;
  diabetesStatus?: string; // "none" | "prediabetic" | "type1" | "type2" | "gestational" | "other"
}

export interface MetricInsight {
  status: "good" | "warning" | "critical";
  label: string;
  valueLabel: string;
  message: string;
}

export interface MLPredictionResponse {
  riskScore: number;
  riskCategory: string;
  confidenceScore: number;
  prediction: number;
  probabilities: {
    no_diabetes: number;
    diabetes: number;
  };
  featureImportance: Record<string, number>;
  recommendations?: string[];
  metricInsights?: Record<string, MetricInsight>;
  model_info?: {
    model_type: string;
    features_used: string[];
    version: string;
  };
}

export class MLApiClient {
  private baseUrl: string;
  private apiKey: string | null;

  constructor(baseUrl: string = 'http://localhost:5000', apiKey?: string) {
    this.baseUrl = baseUrl;
    // Get API key from environment variable or parameter
    this.apiKey = apiKey || import.meta.env.VITE_ML_API_KEY || null;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Add API key if available
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }
    
    return headers;
  }

  /**
   * Check if the ML API is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.status === 'healthy' && data.model_loaded === true;
      }
      return false;
    } catch (error) {
      console.error('ML API health check failed:', error);
      return false;
    }
  }

  /**
   * Get diabetes risk prediction
   */
  async predictRisk(data: MLPredictionRequest): Promise<MLPredictionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/predict`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`ML API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('ML API prediction failed:', error);
      throw new Error(`Failed to get prediction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get model information
   */
  async getModelInfo(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/model/info`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`ML API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('ML API model info failed:', error);
      throw new Error(`Failed to get model info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Batch prediction for multiple patients
   */
  async batchPredict(patients: MLPredictionRequest[]): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/batch_predict`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ patients }),
      });

      if (!response.ok) {
        throw new Error(`ML API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('ML API batch prediction failed:', error);
      throw new Error(`Failed to get batch predictions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Get the ML API base URL
 * Automatically detects if running on localhost or network IP
 * For mobile testing: If accessing from network IP, use network IP for ML API too
 */
function getMLApiBaseUrl(): string {
  // Check if we're running on a network IP (not localhost)
  const currentHost = window.location.hostname;
  
  // If accessing from localhost, use localhost for ML API
  if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  
  // If accessing from network IP (e.g., 192.168.x.x), use same IP for ML API
  // This allows mobile devices on the same network to access the ML API
  if (/^\d+\.\d+\.\d+\.\d+$/.test(currentHost)) {
    return `http://${currentHost}:5000`;
  }
  
  // For production or other cases, try environment variable or default
  const envApiUrl = import.meta.env.VITE_ML_API_URL;
  if (envApiUrl) {
    return envApiUrl;
  }
  
  // Default fallback
  return 'http://localhost:5000';
}

// Export a default instance with auto-detected URL
export const mlApiClient = new MLApiClient(getMLApiBaseUrl());
