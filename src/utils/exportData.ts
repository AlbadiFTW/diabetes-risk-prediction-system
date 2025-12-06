// Export data utilities for PDF and CSV

export interface ExportData {
  profile: any;
  predictions: any[];
  medicalRecords: any[];
  testResults: any[];
  assignments?: any[]; // For doctors
}

// CSV Export Functions
export function exportToCSV(data: ExportData, diabetesStatus?: string): void {
  const rows: string[] = [];
  
  // Get diabetes status from parameter or data
  const patientDiabetesStatus = diabetesStatus || data.profile?.diabetesStatus || "none";
  const hasDiagnosedDiabetes = patientDiabetesStatus === "type1" || patientDiabetesStatus === "type2" || 
                              patientDiabetesStatus === "gestational" || patientDiabetesStatus === "other";
  const isPrediabetic = patientDiabetesStatus === "prediabetic";
  
  // Header
  rows.push("Diabetes Risk Prediction System - Data Export");
  rows.push(`Generated: ${new Date().toLocaleString()}`);
  rows.push("");
  
  // Profile Information
  rows.push("=== PROFILE INFORMATION ===");
  rows.push("Field,Value");
  if (data.profile) {
    rows.push(`First Name,${data.profile.firstName || ""}`);
    rows.push(`Last Name,${data.profile.lastName || ""}`);
    rows.push(`Role,${data.profile.role || ""}`);
    rows.push(`Date of Birth,${data.profile.dateOfBirth || ""}`);
    rows.push(`Gender,${data.profile.gender || ""}`);
    rows.push(`Phone Number,${data.profile.phoneNumber || ""}`);
    rows.push(`Address,${data.profile.address || ""}`);
    if (data.profile.role === "patient") {
      rows.push(`Emergency Contact,${data.profile.emergencyContact || ""}`);
    } else if (data.profile.role === "doctor") {
      rows.push(`License Number,${data.profile.licenseNumber || ""}`);
      rows.push(`Specialization,${data.profile.specialization || data.profile.specialty || ""}`);
      rows.push(`Clinic Name,${data.profile.clinicName || ""}`);
    }
  }
  rows.push("");
  
  // Medical Records (only for patients)
  if (data.medicalRecords && data.medicalRecords.length > 0) {
    rows.push("=== MEDICAL RECORDS ===");
    rows.push("Date,Age,Gender,BMI,Glucose Level,Systolic BP,Diastolic BP,Heart Rate,HbA1c,Insulin Level,Family History,Smoking Status,Alcohol Consumption,Exercise Frequency,Record Type");
    data.medicalRecords.forEach((record: any) => {
    const date = new Date(record._creationTime || 0).toLocaleDateString();
    rows.push([
      date,
      record.age || "",
      record.gender || "",
      record.bmi || "",
      record.glucoseLevel || "",
      record.systolicBP || "",
      record.diastolicBP || "",
      record.heartRate || "",
      record.hba1c || "",
      record.insulinLevel || "",
      record.familyHistoryDiabetes ? "Yes" : "No",
      record.smokingStatus || "",
      record.alcoholConsumption || "",
      record.exerciseFrequency || "",
      record.recordType || ""
    ].join(","));
    });
    rows.push("");
  }
  
  // Risk Predictions - Context-aware labels
  const riskSectionTitle = hasDiagnosedDiabetes ? "COMPLICATION RISK ASSESSMENTS" : isPrediabetic ? "PROGRESSION RISK ASSESSMENTS" : "RISK ASSESSMENTS";
  const riskScoreColumn = hasDiagnosedDiabetes ? "Complication Risk (%)" : isPrediabetic ? "Progression Risk (%)" : "Risk Score (%)";
  const riskCategoryColumn = hasDiagnosedDiabetes ? "Complication Category" : isPrediabetic ? "Progression Category" : "Risk Category";
  const riskTypeColumn = hasDiagnosedDiabetes ? "Complication Risk" : isPrediabetic ? "Progression Risk" : "Diabetes Risk";
  
  rows.push(`=== ${riskSectionTitle} ===`);
  rows.push(`Date,${riskScoreColumn},${riskCategoryColumn},Confidence (%),${riskTypeColumn},Recommendations`);
  data.predictions.forEach((prediction: any) => {
    const date = new Date(prediction._creationTime || 0).toLocaleDateString();
    const riskScore = typeof prediction.riskScore === 'number' ? prediction.riskScore.toFixed(1) : "";
    const confidence = typeof prediction.confidenceScore === 'number' ? prediction.confidenceScore.toFixed(1) : "";
    const diabetesRisk = (prediction.riskScore || 0) >= 75 ? "Yes" : "No";
    const recommendations = (prediction.recommendations || []).join("; ");
    rows.push([
      date,
      riskScore,
      prediction.riskCategory || "",
      confidence,
      diabetesRisk,
      `"${recommendations}"`
    ].join(","));
  });
  rows.push("");
  
  // Health Factors for Each Assessment
  rows.push("=== HEALTH FACTORS BY ASSESSMENT ===");
  rows.push("Assessment Date,Factor Name,Value,Unit,Status,Normal Range,Impact (%)");
  data.predictions.forEach((prediction: any) => {
    const date = new Date(prediction._creationTime || 0).toLocaleDateString();
    
    // Find associated medical record
    const medicalRecord = data.medicalRecords?.find(
      (record: any) => record._id === prediction.medicalRecordId
    ) || {};
    
    const inputData = prediction.inputData || {};
    const recordData = { ...medicalRecord, ...inputData };
    const featureImportance = prediction.featureImportance || {};
    
    // Build factors array
    const factors: Array<{
      name: string;
      value: string | number;
      unit: string;
      status: string;
      normalRange: string;
      importance: number;
    }> = [];
    
    if (recordData.age !== undefined && recordData.age !== null) {
      factors.push({
        name: "Age",
        value: recordData.age,
        unit: "years",
        status: recordData.age > 45 ? "Above Normal" : "Normal",
        normalRange: "0-45 years",
        importance: (featureImportance.age || featureImportance.Age || 0) * 100
      });
    }
    
    if (recordData.bmi !== undefined && recordData.bmi !== null) {
      const bmiStatus = recordData.bmi >= 30 ? "High" : recordData.bmi >= 25 ? "Borderline" : "Normal";
      factors.push({
        name: "BMI",
        value: typeof recordData.bmi === 'number' ? recordData.bmi.toFixed(1) : recordData.bmi,
        unit: "",
        status: bmiStatus,
        normalRange: "18.5-24.9",
        importance: (featureImportance.bmi || featureImportance.BMI || 0) * 100
      });
    }
    
    if (recordData.glucoseLevel !== undefined && recordData.glucoseLevel !== null) {
      const glucoseStatus = recordData.glucoseLevel >= 126 ? "High" : recordData.glucoseLevel >= 100 ? "Borderline" : "Normal";
      factors.push({
        name: "Fasting Glucose",
        value: recordData.glucoseLevel,
        unit: "mg/dL",
        status: glucoseStatus,
        normalRange: "70-100 mg/dL",
        importance: (featureImportance.glucose || featureImportance.Glucose || 0) * 100
      });
    }
    
    if (recordData.systolicBP !== undefined && recordData.systolicBP !== null) {
      const bpStatus = recordData.systolicBP >= 140 || (recordData.diastolicBP && recordData.diastolicBP >= 90) ? "High" : 
                      recordData.systolicBP >= 130 || (recordData.diastolicBP && recordData.diastolicBP >= 80) ? "Borderline" : "Normal";
      factors.push({
        name: "Blood Pressure",
        value: recordData.diastolicBP ? `${recordData.systolicBP}/${recordData.diastolicBP}` : recordData.systolicBP,
        unit: "mmHg",
        status: bpStatus,
        normalRange: "90-120/60-80 mmHg",
        importance: (featureImportance.bloodPressure || featureImportance.BloodPressure || 0) * 100
      });
    }
    
    if (recordData.hba1c !== undefined && recordData.hba1c !== null) {
      const hba1cStatus = recordData.hba1c >= 6.5 ? "High" : recordData.hba1c >= 5.7 ? "Borderline" : "Normal";
      factors.push({
        name: "HbA1c",
        value: typeof recordData.hba1c === 'number' ? recordData.hba1c.toFixed(1) : recordData.hba1c,
        unit: "%",
        status: hba1cStatus,
        normalRange: "4.0-5.7%",
        importance: (featureImportance.hba1c || featureImportance.HbA1c || 0) * 100
      });
    }
    
    if (recordData.insulinLevel !== undefined && recordData.insulinLevel !== null) {
      factors.push({
        name: "Insulin Level",
        value: typeof recordData.insulinLevel === 'number' ? recordData.insulinLevel.toFixed(1) : recordData.insulinLevel,
        unit: "μU/mL",
        status: recordData.insulinLevel > 25 ? "Above Normal" : "Normal",
        normalRange: "2-25 μU/mL",
        importance: (featureImportance.insulin || featureImportance.Insulin || 0) * 100
      });
    }
    
    if (recordData.familyHistoryDiabetes !== undefined) {
      factors.push({
        name: "Family History",
        value: recordData.familyHistoryDiabetes ? "Yes" : "No",
        unit: "",
        status: recordData.familyHistoryDiabetes ? "Risk Factor Present" : "No Known History",
        normalRange: "N/A",
        importance: (featureImportance.familyHistory || featureImportance.FamilyHistory || 0) * 100
      });
    }
    
    if (recordData.smokingStatus) {
      factors.push({
        name: "Smoking Status",
        value: recordData.smokingStatus.charAt(0).toUpperCase() + recordData.smokingStatus.slice(1),
        unit: "",
        status: recordData.smokingStatus === "current" ? "Risk Factor" : "Not a Risk Factor",
        normalRange: "N/A",
        importance: recordData.smokingStatus === "current" ? 5 : 0
      });
    }
    
    if (recordData.exerciseFrequency) {
      factors.push({
        name: "Exercise Frequency",
        value: recordData.exerciseFrequency.charAt(0).toUpperCase() + recordData.exerciseFrequency.slice(1),
        unit: "",
        status: recordData.exerciseFrequency === "none" ? "Risk Factor" : "Protective Factor",
        normalRange: "N/A",
        importance: recordData.exerciseFrequency === "none" ? 5 : 0
      });
    }
    
    // Sort by importance and add to CSV
    factors.sort((a, b) => b.importance - a.importance);
    factors.forEach(factor => {
      rows.push([
        date,
        factor.name,
        factor.value,
        factor.unit,
        factor.status,
        factor.normalRange,
        factor.importance.toFixed(1)
      ].join(","));
    });
  });
  rows.push("");
  
  // Test Results
  if (data.testResults && data.testResults.length > 0) {
    rows.push("=== TEST RESULTS ===");
    rows.push("Date,Test Type,Test Name,Result,Unit,Reference Range,Status,Lab Name");
    data.testResults.forEach((test: any) => {
      const date = new Date(test._creationTime || 0).toLocaleDateString();
      rows.push([
        date,
        test.testType || "",
        test.testName || "",
        test.result || "",
        test.unit || "",
        test.referenceRange || "",
        test.status || "",
        test.labName || ""
      ].join(","));
    });
    rows.push("");
  }
  
  // Patient Assignments (for doctors)
  if (data.assignments && data.assignments.length > 0) {
    rows.push("=== PATIENT ASSIGNMENTS ===");
    rows.push("Date,Patient ID,Status,Assigned By");
    data.assignments.forEach((assignment: any) => {
      const date = new Date(assignment.assignedAt || assignment._creationTime || 0).toLocaleDateString();
      rows.push([
        date,
        assignment.patientId || "",
        assignment.status || "",
        assignment.assignedBy || ""
      ].join(","));
    });
    rows.push("");
  }
  
  // Create CSV content
  const csvContent = rows.join("\n");
  
  // Create blob and download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `diabetes-risk-data-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// PDF Export Functions
export async function exportToPDF(data: ExportData, diabetesStatus?: string): Promise<void> {
  // Get diabetes status from parameter or data
  const patientDiabetesStatus = diabetesStatus || data.profile?.diabetesStatus || "none";
  const hasDiagnosedDiabetes = patientDiabetesStatus === "type1" || patientDiabetesStatus === "type2" || 
                              patientDiabetesStatus === "gestational" || patientDiabetesStatus === "other";
  const isPrediabetic = patientDiabetesStatus === "prediabetic";
  
  // Dynamic import of jspdf
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  
  let yPos = 20;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const lineHeight = 7;
  
  // Helper function to add new page if needed
  const checkNewPage = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
    }
  };
  
  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Diabetes Risk Prediction System", margin, yPos);
  yPos += lineHeight * 2;
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Data Export - Generated: ${new Date().toLocaleString()}`, margin, yPos);
  yPos += lineHeight * 2;
  
  // Profile Information
  checkNewPage(lineHeight * 10);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Profile Information", margin, yPos);
  yPos += lineHeight * 1.5;
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (data.profile) {
    doc.text(`Name: ${data.profile.firstName || ""} ${data.profile.lastName || ""}`, margin, yPos);
    yPos += lineHeight;
    doc.text(`Role: ${data.profile.role || "N/A"}`, margin, yPos);
    yPos += lineHeight;
    doc.text(`Date of Birth: ${data.profile.dateOfBirth || "N/A"}`, margin, yPos);
    yPos += lineHeight;
    doc.text(`Gender: ${data.profile.gender || "N/A"}`, margin, yPos);
    yPos += lineHeight;
    doc.text(`Phone: ${data.profile.phoneNumber || "N/A"}`, margin, yPos);
    yPos += lineHeight;
    doc.text(`Address: ${data.profile.address || "N/A"}`, margin, yPos);
    yPos += lineHeight;
    if (data.profile.role === "patient") {
      doc.text(`Emergency Contact: ${data.profile.emergencyContact || "N/A"}`, margin, yPos);
      yPos += lineHeight;
    } else if (data.profile.role === "doctor") {
      doc.text(`License Number: ${data.profile.licenseNumber || "N/A"}`, margin, yPos);
      yPos += lineHeight;
      doc.text(`Specialization: ${data.profile.specialization || data.profile.specialty || "N/A"}`, margin, yPos);
      yPos += lineHeight;
      doc.text(`Clinic Name: ${data.profile.clinicName || "N/A"}`, margin, yPos);
      yPos += lineHeight;
    }
  }
  yPos += lineHeight;
  
  // Medical Records (only for patients)
  if (data.medicalRecords && data.medicalRecords.length > 0) {
    checkNewPage(lineHeight * 15);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Medical Records", margin, yPos);
    yPos += lineHeight * 1.5;
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    data.medicalRecords.forEach((record: any, index: number) => {
    checkNewPage(lineHeight * 8);
    const date = new Date(record._creationTime || 0).toLocaleDateString();
    doc.setFont("helvetica", "bold");
    doc.text(`Record #${index + 1} - ${date}`, margin, yPos);
    yPos += lineHeight;
    doc.setFont("helvetica", "normal");
    doc.text(`Age: ${record.age || "N/A"} | BMI: ${record.bmi || "N/A"} | Glucose: ${record.glucoseLevel || "N/A"} mg/dL`, margin, yPos);
    yPos += lineHeight;
    doc.text(`Blood Pressure: ${record.systolicBP || "N/A"}/${record.diastolicBP || "N/A"} mmHg`, margin, yPos);
    yPos += lineHeight;
      doc.text(`Type: ${record.recordType || "N/A"}`, margin, yPos);
      yPos += lineHeight * 1.5;
    });
  }
  
  // Risk Assessments - Context-aware labels
  checkNewPage(lineHeight * 15);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(hasDiagnosedDiabetes ? "Complication Risk Assessments" : isPrediabetic ? "Progression Risk Assessments" : "Risk Assessments", margin, yPos);
  yPos += lineHeight * 1.5;
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  data.predictions.forEach((prediction: any, index: number) => {
    checkNewPage(lineHeight * 15);
    const date = new Date(prediction._creationTime || 0).toLocaleDateString();
    const riskScore = typeof prediction.riskScore === 'number' ? prediction.riskScore.toFixed(1) : "N/A";
    const confidence = typeof prediction.confidenceScore === 'number' ? prediction.confidenceScore.toFixed(1) : "N/A";
    const diabetesRisk = (prediction.riskScore || 0) >= 75 ? "Yes" : "No";
    
    doc.setFont("helvetica", "bold");
    doc.text(`Assessment #${index + 1} - ${date}`, margin, yPos);
    yPos += lineHeight;
    doc.setFont("helvetica", "normal");
    const riskLabel = hasDiagnosedDiabetes ? "Complication Risk" : isPrediabetic ? "Progression Risk" : "Risk Score";
    doc.text(`${riskLabel}: ${riskScore}% | Category: ${prediction.riskCategory || "N/A"} | Confidence: ${confidence}%`, margin, yPos);
    yPos += lineHeight;
    const riskTypeLabel = hasDiagnosedDiabetes ? "Complication Risk" : isPrediabetic ? "Progression Risk" : "Diabetes Risk";
    doc.text(`${riskTypeLabel}: ${diabetesRisk}`, margin, yPos);
    yPos += lineHeight * 1.5;
    
    // Health Factors Section
    const medicalRecord = data.medicalRecords?.find(
      (record: any) => record._id === prediction.medicalRecordId
    ) || {};
    
    const inputData = prediction.inputData || {};
    const recordData = { ...medicalRecord, ...inputData };
    const featureImportance = prediction.featureImportance || {};
    
    // Build factors array
    const factors: Array<{
      name: string;
      value: string | number;
      unit: string;
      status: string;
      normalRange: string;
      importance: number;
    }> = [];
    
    if (recordData.age !== undefined && recordData.age !== null) {
      factors.push({
        name: "Age",
        value: recordData.age,
        unit: "years",
        status: recordData.age > 45 ? "Above Normal" : "Normal",
        normalRange: "0-45 years",
        importance: (featureImportance.age || featureImportance.Age || 0) * 100
      });
    }
    
    if (recordData.bmi !== undefined && recordData.bmi !== null) {
      const bmiStatus = recordData.bmi >= 30 ? "High" : recordData.bmi >= 25 ? "Borderline" : "Normal";
      factors.push({
        name: "BMI",
        value: typeof recordData.bmi === 'number' ? recordData.bmi.toFixed(1) : recordData.bmi,
        unit: "",
        status: bmiStatus,
        normalRange: "18.5-24.9",
        importance: (featureImportance.bmi || featureImportance.BMI || 0) * 100
      });
    }
    
    if (recordData.glucoseLevel !== undefined && recordData.glucoseLevel !== null) {
      const glucoseStatus = recordData.glucoseLevel >= 126 ? "High" : recordData.glucoseLevel >= 100 ? "Borderline" : "Normal";
      factors.push({
        name: "Fasting Glucose",
        value: recordData.glucoseLevel,
        unit: "mg/dL",
        status: glucoseStatus,
        normalRange: "70-100 mg/dL",
        importance: (featureImportance.glucose || featureImportance.Glucose || 0) * 100
      });
    }
    
    if (recordData.systolicBP !== undefined && recordData.systolicBP !== null) {
      const bpStatus = recordData.systolicBP >= 140 || (recordData.diastolicBP && recordData.diastolicBP >= 90) ? "High" : 
                      recordData.systolicBP >= 130 || (recordData.diastolicBP && recordData.diastolicBP >= 80) ? "Borderline" : "Normal";
      factors.push({
        name: "Blood Pressure",
        value: recordData.diastolicBP ? `${recordData.systolicBP}/${recordData.diastolicBP}` : recordData.systolicBP,
        unit: "mmHg",
        status: bpStatus,
        normalRange: "90-120/60-80 mmHg",
        importance: (featureImportance.bloodPressure || featureImportance.BloodPressure || 0) * 100
      });
    }
    
    if (recordData.hba1c !== undefined && recordData.hba1c !== null) {
      const hba1cStatus = recordData.hba1c >= 6.5 ? "High" : recordData.hba1c >= 5.7 ? "Borderline" : "Normal";
      factors.push({
        name: "HbA1c",
        value: typeof recordData.hba1c === 'number' ? recordData.hba1c.toFixed(1) : recordData.hba1c,
        unit: "%",
        status: hba1cStatus,
        normalRange: "4.0-5.7%",
        importance: (featureImportance.hba1c || featureImportance.HbA1c || 0) * 100
      });
    }
    
    if (recordData.insulinLevel !== undefined && recordData.insulinLevel !== null) {
      factors.push({
        name: "Insulin Level",
        value: typeof recordData.insulinLevel === 'number' ? recordData.insulinLevel.toFixed(1) : recordData.insulinLevel,
        unit: "μU/mL",
        status: recordData.insulinLevel > 25 ? "Above Normal" : "Normal",
        normalRange: "2-25 μU/mL",
        importance: (featureImportance.insulin || featureImportance.Insulin || 0) * 100
      });
    }
    
    if (recordData.familyHistoryDiabetes !== undefined) {
      factors.push({
        name: "Family History",
        value: recordData.familyHistoryDiabetes ? "Yes" : "No",
        unit: "",
        status: recordData.familyHistoryDiabetes ? "Risk Factor Present" : "No Known History",
        normalRange: "N/A",
        importance: (featureImportance.familyHistory || featureImportance.FamilyHistory || 0) * 100
      });
    }
    
    if (recordData.smokingStatus) {
      factors.push({
        name: "Smoking Status",
        value: recordData.smokingStatus.charAt(0).toUpperCase() + recordData.smokingStatus.slice(1),
        unit: "",
        status: recordData.smokingStatus === "current" ? "Risk Factor" : "Not a Risk Factor",
        normalRange: "N/A",
        importance: recordData.smokingStatus === "current" ? 5 : 0
      });
    }
    
    if (recordData.exerciseFrequency) {
      factors.push({
        name: "Exercise Frequency",
        value: recordData.exerciseFrequency.charAt(0).toUpperCase() + recordData.exerciseFrequency.slice(1),
        unit: "",
        status: recordData.exerciseFrequency === "none" ? "Risk Factor" : "Protective Factor",
        normalRange: "N/A",
        importance: recordData.exerciseFrequency === "none" ? 5 : 0
      });
    }
    
    // Sort by importance
    factors.sort((a, b) => b.importance - a.importance);
    
    if (factors.length > 0) {
      checkNewPage(lineHeight * (factors.length + 3));
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Health Factors Analyzed:", margin, yPos);
      yPos += lineHeight * 1.2;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      
      factors.forEach(factor => {
        checkNewPage(lineHeight * 2);
        const factorText = `${factor.name}: ${factor.value} ${factor.unit} (${factor.status})`;
        const impactText = `Impact: ${factor.importance.toFixed(1)}%`;
        const rangeText = factor.normalRange !== "N/A" ? `Normal: ${factor.normalRange}` : "";
        
        // Split long text if needed
        const maxWidth = doc.internal.pageSize.width - (margin * 2);
        const lines = doc.splitTextToSize(factorText, maxWidth);
        lines.forEach((line: string) => {
          doc.text(line, margin + 5, yPos);
          yPos += lineHeight * 0.8;
        });
        
        if (rangeText) {
          doc.text(rangeText, margin + 10, yPos);
          yPos += lineHeight * 0.8;
        }
        
        doc.text(impactText, margin + 10, yPos);
        yPos += lineHeight * 1.2;
      });
    }
    
    if (prediction.recommendations && prediction.recommendations.length > 0) {
      checkNewPage(lineHeight * (prediction.recommendations.length + 2));
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Recommendations:", margin, yPos);
      yPos += lineHeight;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      prediction.recommendations.forEach((rec: string) => {
        checkNewPage(lineHeight * 2);
        const maxWidth = doc.internal.pageSize.width - (margin * 2);
        const lines = doc.splitTextToSize(rec, maxWidth);
        lines.forEach((line: string) => {
          doc.text(`• ${line}`, margin + 5, yPos);
          yPos += lineHeight * 0.8;
        });
        yPos += lineHeight * 0.4;
      });
    }
    yPos += lineHeight * 1.5;
  });
  
  // Test Results
  if (data.testResults && data.testResults.length > 0) {
    checkNewPage(lineHeight * 10);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Test Results", margin, yPos);
    yPos += lineHeight * 1.5;
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    data.testResults.forEach((test: any) => {
      checkNewPage(lineHeight * 5);
      const date = new Date(test._creationTime || 0).toLocaleDateString();
      doc.text(`${date} - ${test.testName || "N/A"}: ${test.result || "N/A"} ${test.unit || ""} (${test.status || "N/A"})`, margin, yPos);
      yPos += lineHeight;
    });
  }
  
  // Save PDF
  doc.save(`diabetes-risk-data-${new Date().toISOString().split('T')[0]}.pdf`);
}

