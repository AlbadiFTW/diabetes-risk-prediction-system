import { X, FileText, Shield, Eye, Database, Share2 } from "lucide-react";

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export function TermsModal({ isOpen, onClose, onAccept }: TermsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#2F3136] rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-[#202225]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#202225] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Terms of Service & Privacy Policy</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#B9BBBE] hover:text-white transition-colors p-2 hover:bg-[#202225] rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          <div className="space-y-6 text-[#B9BBBE]">
            {/* Introduction */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Welcome to DiabetesRisk AI</h3>
              <p className="leading-relaxed">
                By creating an account and using our services, you agree to the following terms and conditions. 
                Please read them carefully.
              </p>
            </div>

            {/* Data Collection */}
            <div className="bg-[#202225] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-5 h-5 text-indigo-400" />
                <h4 className="font-semibold text-white">1. Data Collection & Usage</h4>
              </div>
              <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                <li>We collect personal information including name, email, date of birth, gender, and contact details</li>
                <li>Health data including medical records, test results, and risk assessments are stored securely</li>
                <li>Your data is used to provide personalized diabetes risk assessments and health insights</li>
                <li>We may use anonymized, aggregated data for research and improving our AI models</li>
              </ul>
            </div>

            {/* Data Sharing */}
            <div className="bg-[#202225] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Share2 className="w-5 h-5 text-purple-400" />
                <h4 className="font-semibold text-white">2. Data Sharing</h4>
              </div>
              <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                <li>If you have an assigned healthcare provider, your health data may be shared with them</li>
                <li>We do not sell your personal information to third parties</li>
                <li>Anonymized data may be used for medical research and public health studies</li>
                <li>We may share data if required by law or to protect user safety</li>
              </ul>
            </div>

            {/* Data Security */}
            <div className="bg-[#202225] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-green-400" />
                <h4 className="font-semibold text-white">3. Data Security</h4>
              </div>
              <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                <li>We use industry-standard encryption to protect your data</li>
                <li>Access to your data is restricted to authorized personnel only</li>
                <li>Regular security audits and updates are performed</li>
                <li>You can request data deletion at any time through your account settings</li>
              </ul>
            </div>

            {/* Research & Analytics */}
            <div className="bg-[#202225] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-5 h-5 text-pink-400" />
                <h4 className="font-semibold text-white">4. Research & Analytics</h4>
              </div>
              <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                <li>Your health data may be used (anonymized) to improve diabetes prediction models</li>
                <li>Aggregated statistics may be published in medical journals or research papers</li>
                <li>Individual identities are never disclosed in research publications</li>
                <li>You can opt-out of research participation in your account settings</li>
              </ul>
            </div>

            {/* User Rights */}
            <div>
              <h4 className="font-semibold text-white mb-2">5. Your Rights</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Access your data at any time through your account</li>
                <li>Request corrections to inaccurate information</li>
                <li>Export your data in a portable format</li>
                <li>Delete your account and all associated data</li>
                <li>Opt-out of non-essential data processing</li>
              </ul>
            </div>

            {/* Disclaimer */}
            <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-4">
              <h4 className="font-semibold text-amber-300 mb-2">Medical Disclaimer</h4>
              <p className="text-sm text-amber-200/80">
                This service provides risk assessments based on AI analysis and is not a substitute for professional 
                medical advice, diagnosis, or treatment. Always consult with qualified healthcare providers for medical 
                decisions. The predictions are estimates and should not be used as the sole basis for medical decisions.
              </p>
            </div>

            {/* Acceptance */}
            <div className="bg-indigo-900/20 border border-indigo-700/30 rounded-lg p-4">
              <p className="text-sm text-indigo-200">
                <strong className="text-white">By proceeding, you acknowledge that:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 mt-2 text-sm text-indigo-200/90">
                <li>You have read and understood these terms</li>
                <li>You consent to data collection and processing as described</li>
                <li>You understand the medical disclaimer</li>
                <li>You are at least 18 years old or have parental consent</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-[#202225] bg-[#202225]/50 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#2F3136] hover:bg-[#3A3D42] text-[#B9BBBE] hover:text-white rounded-lg font-medium transition-colors border border-[#202225]"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onAccept();
              onClose();
            }}
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-indigo-500/50"
          >
            I Accept & Continue
          </button>
        </div>
      </div>
    </div>
  );
}


