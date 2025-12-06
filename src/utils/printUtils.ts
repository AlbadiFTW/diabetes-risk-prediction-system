/**
 * Utility functions for printing medical records and assessments
 */

export interface PrintData {
  type: "assessment" | "medical_record";
  title: string;
  data: any;
  patientName?: string;
  date?: string;
}

/**
 * Print an assessment/risk prediction report
 */
export function printAssessment(assessment: any, patientName?: string, medicalRecord?: any, diabetesStatus?: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("Unable to open print window. Please allow popups for this site.");
  }

  const riskColor = assessment.riskCategory === "very_high" ? "#EF4444" :
                   assessment.riskCategory === "high" ? "#F97316" :
                   assessment.riskCategory === "moderate" ? "#EAB308" : "#22C55E";

  const riskLabel = assessment.riskCategory?.replace("_", " ").toUpperCase() || "UNKNOWN";

  const date = new Date(assessment._creationTime || Date.now()).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Diabetes Risk Assessment Report</title>
      <style>
        @media print {
          @page {
            margin: 1cm;
          }
          body {
            margin: 0;
            padding: 0;
          }
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 0;
          padding: 20px;
          color: #1e293b;
          background: white;
        }
        .header {
          border-bottom: 3px solid #3B82F6;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          margin: 0;
          color: #3B82F6;
          font-size: 28px;
        }
        .header p {
          margin: 5px 0 0 0;
          color: #64748b;
          font-size: 14px;
        }
        .info-section {
          margin-bottom: 30px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        .info-label {
          font-weight: 600;
          color: #64748b;
        }
        .info-value {
          color: #1e293b;
        }
        .risk-score {
          text-align: center;
          padding: 30px;
          background: #f1f5f9;
          border-radius: 12px;
          border-left: 6px solid ${riskColor};
          margin: 30px 0;
        }
        .risk-score-value {
          font-size: 64px;
          font-weight: bold;
          color: ${riskColor};
          margin: 10px 0;
        }
        .risk-category {
          font-size: 24px;
          font-weight: 600;
          color: ${riskColor};
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        .recommendations {
          margin-top: 30px;
        }
        .recommendations h3 {
          color: #1e293b;
          margin-bottom: 15px;
        }
        .recommendations ul {
          list-style: none;
          padding: 0;
        }
        .recommendations li {
          padding: 10px;
          margin-bottom: 8px;
          background: #f8fafc;
          border-left: 4px solid #3B82F6;
          border-radius: 4px;
        }
        .health-factors {
          margin-top: 30px;
          margin-bottom: 30px;
        }
        .factors-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 15px;
          margin-top: 15px;
        }
        .factor-item {
          background: #f8fafc;
          padding: 15px;
          border-radius: 8px;
          border-left: 4px solid #3B82F6;
        }
        .factor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .factor-name {
          font-weight: 600;
          color: #1e293b;
          font-size: 14px;
        }
        .factor-status {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }
        .factor-details {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .factor-value {
          font-size: 18px;
          font-weight: bold;
          color: #1e293b;
        }
        .factor-range {
          font-size: 12px;
          color: #64748b;
        }
        .factor-impact {
          font-size: 11px;
          color: #3B82F6;
          font-weight: 600;
        }
        .footer {
          margin-top: 50px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          color: #94a3b8;
          font-size: 12px;
        }
        @media print {
          .no-print {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🏥 ${(() => {
          const hasDiagnosedDiabetes = diabetesStatus === "type1" || diabetesStatus === "type2" || 
                                      diabetesStatus === "gestational" || diabetesStatus === "other";
          const isPrediabetic = diabetesStatus === "prediabetic";
          return hasDiagnosedDiabetes 
            ? "Diabetes Management Assessment Report" 
            : isPrediabetic 
            ? "Diabetes Progression Risk Assessment Report" 
            : "Diabetes Risk Assessment Report";
        })()}</h1>
        <p>Diabetes Risk Prediction & Early Detection System</p>
        <p>Aligned with Oman Vision 2040</p>
      </div>

      <div class="info-section">
        <div class="info-row">
          <span class="info-label">Patient Name:</span>
          <span class="info-value">${patientName || "N/A"}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Assessment Date:</span>
          <span class="info-value">${date}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Confidence Score:</span>
          <span class="info-value">${(assessment.confidenceScore || 0).toFixed(1)}%</span>
        </div>
      </div>

      ${(() => {
        // Extract health metrics from medical record parameter, inputData, or assessment.medicalRecord
        const inputData = assessment.inputData || {};
        const recordData = medicalRecord || assessment.medicalRecord || {};
        const data = { ...recordData, ...inputData };
        
        // Get feature importance to show which factors mattered most
        const featureImportance = assessment.featureImportance || {};
        
        // Build factors array
        const factors = [];
        
        if (data.age !== undefined && data.age !== null) {
          factors.push({
            name: "Age",
            value: data.age,
            unit: "years",
            importance: (featureImportance.age || featureImportance.Age || 0) * 100,
            status: data.age > 45 ? "Above Normal" : "Normal"
          });
        }
        
        if (data.bmi !== undefined && data.bmi !== null) {
          const hasDiagnosedDiabetes = diabetesStatus === "type1" || diabetesStatus === "type2" || 
                                      diabetesStatus === "gestational" || diabetesStatus === "other";
          const bmiStatus = data.bmi >= 30 ? "High" : data.bmi >= 25 ? "Borderline" : "Normal";
          factors.push({
            name: "BMI (Body Mass Index)",
            value: data.bmi.toFixed(1),
            unit: "",
            importance: (featureImportance.bmi || featureImportance.BMI || 0) * 100,
            status: bmiStatus,
            normalRange: hasDiagnosedDiabetes
              ? "Target: 18.5 - 24.9 (weight management crucial)"
              : "18.5 - 24.9"
          });
        }
        
        if (data.glucoseLevel !== undefined && data.glucoseLevel !== null) {
          const hasDiagnosedDiabetes = diabetesStatus === "type1" || diabetesStatus === "type2" || 
                                      diabetesStatus === "gestational" || diabetesStatus === "other";
          const isPrediabetic = diabetesStatus === "prediabetic";
          const glucoseStatus = hasDiagnosedDiabetes
            ? (data.glucoseLevel >= 180 ? "Needs Attention" : data.glucoseLevel >= 140 ? "Needs Improvement" : "Well Controlled")
            : (data.glucoseLevel >= 126 ? "High" : data.glucoseLevel >= 100 ? "Borderline" : "Normal");
          factors.push({
            name: "Fasting Glucose",
            value: data.glucoseLevel,
            unit: "mg/dL",
            importance: (featureImportance.glucose || featureImportance.Glucose || 0) * 100,
            status: glucoseStatus,
            normalRange: hasDiagnosedDiabetes
              ? "Target: 80-130 mg/dL (before meals)"
              : "70 - 100 mg/dL"
          });
        }
        
        if (data.systolicBP !== undefined && data.systolicBP !== null) {
          const hasDiagnosedDiabetes = diabetesStatus === "type1" || diabetesStatus === "type2" || 
                                      diabetesStatus === "gestational" || diabetesStatus === "other";
          const bpStatus = hasDiagnosedDiabetes
            ? (data.systolicBP >= 140 || (data.diastolicBP && data.diastolicBP >= 90) ? "High" : 
               data.systolicBP >= 130 || (data.diastolicBP && data.diastolicBP >= 80) ? "Elevated" : "Target")
            : (data.systolicBP >= 140 || (data.diastolicBP && data.diastolicBP >= 90) ? "High" : 
               data.systolicBP >= 130 || (data.diastolicBP && data.diastolicBP >= 80) ? "Borderline" : "Normal");
          factors.push({
            name: "Blood Pressure",
            value: data.diastolicBP ? `${data.systolicBP}/${data.diastolicBP}` : data.systolicBP,
            unit: "mmHg",
            importance: (featureImportance.bloodPressure || featureImportance.BloodPressure || 0) * 100,
            status: bpStatus,
            normalRange: hasDiagnosedDiabetes
              ? "Target: <130/80 mmHg"
              : "90-120/60-80 mmHg"
          });
        }
        
        if (data.hba1c !== undefined && data.hba1c !== null) {
          const hasDiagnosedDiabetes = diabetesStatus === "type1" || diabetesStatus === "type2" || 
                                      diabetesStatus === "gestational" || diabetesStatus === "other";
          const isPrediabetic = diabetesStatus === "prediabetic";
          const hba1cStatus = hasDiagnosedDiabetes
            ? (data.hba1c >= 8.0 ? "Needs Attention" : data.hba1c >= 7.0 ? "Needs Improvement" : "Well Controlled")
            : (data.hba1c >= 6.5 ? "High" : data.hba1c >= 5.7 ? "Borderline" : "Normal");
          factors.push({
            name: "HbA1c",
            value: data.hba1c.toFixed(1),
            unit: "%",
            importance: (featureImportance.hba1c || featureImportance.HbA1c || 0) * 100,
            status: hba1cStatus,
            normalRange: hasDiagnosedDiabetes
              ? "Target: <7.0% (most patients)"
              : "4.0 - 5.7%"
          });
        }
        
        if (data.insulinLevel !== undefined && data.insulinLevel !== null) {
          factors.push({
            name: "Insulin Level",
            value: data.insulinLevel.toFixed(1),
            unit: "μU/mL",
            importance: (featureImportance.insulin || featureImportance.Insulin || 0) * 100,
            status: data.insulinLevel > 25 ? "Above Normal" : "Normal",
            normalRange: "2 - 25 μU/mL"
          });
        }
        
        if (data.familyHistoryDiabetes !== undefined) {
          factors.push({
            name: "Family History",
            value: data.familyHistoryDiabetes ? "Yes" : "No",
            unit: "",
            importance: (featureImportance.familyHistory || featureImportance.FamilyHistory || 0) * 100,
            status: data.familyHistoryDiabetes ? "Risk Factor Present" : "No Known History"
          });
        }
        
        if (data.smokingStatus) {
          factors.push({
            name: "Smoking Status",
            value: data.smokingStatus.charAt(0).toUpperCase() + data.smokingStatus.slice(1),
            unit: "",
            importance: data.smokingStatus === "current" ? 5 : 0,
            status: data.smokingStatus === "current" ? "Risk Factor" : "Not a Risk Factor"
          });
        }
        
        if (data.exerciseFrequency) {
          factors.push({
            name: "Exercise Frequency",
            value: data.exerciseFrequency.charAt(0).toUpperCase() + data.exerciseFrequency.slice(1),
            unit: "",
            importance: data.exerciseFrequency === "none" ? 5 : 0,
            status: data.exerciseFrequency === "none" ? "Risk Factor" : "Protective Factor"
          });
        }
        
        if (factors.length === 0) return "";
        
        // Sort by importance (highest first)
        factors.sort((a, b) => b.importance - a.importance);
        
        return `
      <div class="health-factors">
        <h3 style="color: #1e293b; margin-bottom: 20px; font-size: 20px; border-bottom: 2px solid #3B82F6; padding-bottom: 10px;">
          Health Factors Analyzed
        </h3>
        <p style="color: #64748b; margin-bottom: 20px; font-size: 14px;">
          ${(() => {
            const hasDiagnosedDiabetes = diabetesStatus === "type1" || diabetesStatus === "type2" || 
                                        diabetesStatus === "gestational" || diabetesStatus === "other";
            const isPrediabetic = diabetesStatus === "prediabetic";
            return hasDiagnosedDiabetes 
              ? "The following health metrics were analyzed to assess your diabetes management and complication risk:"
              : isPrediabetic 
              ? "The following health metrics were used to assess your risk of progressing to diabetes:"
              : "The following health metrics were used to calculate your diabetes risk score:";
          })()}
        </p>
        <div class="factors-grid">
          ${factors.map(factor => {
            const statusColor = factor.status.includes("High") || factor.status.includes("Risk Factor") ? "#EF4444" :
                               factor.status.includes("Borderline") ? "#EAB308" : "#22C55E";
            return `
            <div class="factor-item" style="border-left: 4px solid ${statusColor};">
              <div class="factor-header">
                <span class="factor-name">${factor.name}</span>
                <span class="factor-status" style="background: ${statusColor}20; color: ${statusColor};">
                  ${factor.status}
                </span>
              </div>
              <div class="factor-details">
                <span class="factor-value">${factor.value} ${factor.unit}</span>
                ${factor.normalRange ? `<span class="factor-range">Normal: ${factor.normalRange}</span>` : ""}
                ${factor.importance > 0 ? `<span class="factor-impact">Impact: ${factor.importance.toFixed(1)}%</span>` : ""}
              </div>
            </div>
            `;
          }).join("")}
        </div>
      </div>
        `;
      })()}

      <div class="risk-score">
        <div style="color: #64748b; font-size: 14px; margin-bottom: 10px;">${(() => {
          const hasDiagnosedDiabetes = diabetesStatus === "type1" || diabetesStatus === "type2" || 
                                      diabetesStatus === "gestational" || diabetesStatus === "other";
          const isPrediabetic = diabetesStatus === "prediabetic";
          return hasDiagnosedDiabetes 
            ? "COMPLICATION RISK" 
            : isPrediabetic 
            ? "PROGRESSION RISK" 
            : "RISK SCORE";
        })()}</div>
        <div class="risk-score-value">${(assessment.riskScore || 0).toFixed(1)}%</div>
        <div class="risk-category">${riskLabel} ${(() => {
          const hasDiagnosedDiabetes = diabetesStatus === "type1" || diabetesStatus === "type2" || 
                                      diabetesStatus === "gestational" || diabetesStatus === "other";
          const isPrediabetic = diabetesStatus === "prediabetic";
          return hasDiagnosedDiabetes 
            ? "COMPLICATION RISK" 
            : isPrediabetic 
            ? "PROGRESSION RISK" 
            : "RISK";
        })()}</div>
      </div>

      ${assessment.recommendations && assessment.recommendations.length > 0 ? `
      <div class="recommendations">
        <h3>Recommendations</h3>
        <ul>
          ${assessment.recommendations.map((rec: string) => `<li>${rec}</li>`).join("")}
        </ul>
      </div>
      ` : ""}

      <div class="footer">
        <p>This report was generated on ${new Date().toLocaleString("en-GB")}</p>
        <p>Diabetes Risk Prediction & Early Detection System - Confidential Medical Information</p>
      </div>
    </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  
  // Wait for content to load, then print
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

/**
 * Print a medical record
 */
export function printMedicalRecord(record: any, patientName?: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("Unable to open print window. Please allow popups for this site.");
  }

  const date = new Date(record._creationTime || Date.now()).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Medical Record</title>
      <style>
        @media print {
          @page {
            margin: 1cm;
          }
          body {
            margin: 0;
            padding: 0;
          }
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 0;
          padding: 20px;
          color: #1e293b;
          background: white;
        }
        .header {
          border-bottom: 3px solid #3B82F6;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          margin: 0;
          color: #3B82F6;
          font-size: 28px;
        }
        .header p {
          margin: 5px 0 0 0;
          color: #64748b;
          font-size: 14px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
          margin-bottom: 30px;
        }
        .info-item {
          padding: 15px;
          background: #f8fafc;
          border-radius: 8px;
          border-left: 4px solid #3B82F6;
        }
        .info-label {
          font-size: 12px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 5px;
        }
        .info-value {
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
        }
        .footer {
          margin-top: 50px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          color: #94a3b8;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🏥 Medical Record</h1>
        <p>Diabetes Risk Prediction & Early Detection System</p>
        <p>Aligned with Oman Vision 2040</p>
      </div>

      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Patient Name</div>
          <div class="info-value">${patientName || "N/A"}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Record Date</div>
          <div class="info-value">${date}</div>
        </div>
        ${record.age ? `
        <div class="info-item">
          <div class="info-label">Age</div>
          <div class="info-value">${record.age} years</div>
        </div>
        ` : ""}
        ${record.gender ? `
        <div class="info-item">
          <div class="info-label">Gender</div>
          <div class="info-value">${record.gender}</div>
        </div>
        ` : ""}
        ${record.bmi ? `
        <div class="info-item">
          <div class="info-label">BMI</div>
          <div class="info-value">${record.bmi}</div>
        </div>
        ` : ""}
        ${record.glucoseLevel ? `
        <div class="info-item">
          <div class="info-label">Glucose Level</div>
          <div class="info-value">${record.glucoseLevel} mg/dL</div>
        </div>
        ` : ""}
        ${record.systolicBP && record.diastolicBP ? `
        <div class="info-item">
          <div class="info-label">Blood Pressure</div>
          <div class="info-value">${record.systolicBP}/${record.diastolicBP} mmHg</div>
        </div>
        ` : ""}
        ${record.heartRate ? `
        <div class="info-item">
          <div class="info-label">Heart Rate</div>
          <div class="info-value">${record.heartRate} bpm</div>
        </div>
        ` : ""}
        ${record.hba1c ? `
        <div class="info-item">
          <div class="info-label">HbA1c</div>
          <div class="info-value">${record.hba1c}%</div>
        </div>
        ` : ""}
        ${record.insulinLevel ? `
        <div class="info-item">
          <div class="info-label">Insulin Level</div>
          <div class="info-value">${record.insulinLevel} μU/mL</div>
        </div>
        ` : ""}
        ${record.recordType ? `
        <div class="info-item">
          <div class="info-label">Record Type</div>
          <div class="info-value">${record.recordType}</div>
        </div>
        ` : ""}
      </div>

      <div class="footer">
        <p>This record was generated on ${new Date().toLocaleString("en-GB")}</p>
        <p>Diabetes Risk Prediction & Early Detection System - Confidential Medical Information</p>
      </div>
    </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  
  // Wait for content to load, then print
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

