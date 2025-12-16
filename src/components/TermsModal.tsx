import { useTranslation } from "react-i18next";
import { X, FileText, Shield, Eye, Database, Share2 } from "lucide-react";

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export function TermsModal({ isOpen, onClose, onAccept }: TermsModalProps) {
  const { t } = useTranslation();
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
            <h2 className="text-2xl font-bold text-white">{t("terms.title")}</h2>
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
              <h3 className="text-lg font-semibold text-white mb-3">{t("terms.welcome")}</h3>
              <p className="leading-relaxed">
                {t("terms.welcomeDesc")}
              </p>
            </div>

            {/* Data Collection */}
            <div className="bg-[#202225] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-5 h-5 text-indigo-400" />
                <h4 className="font-semibold text-white">1. {t("terms.dataCollection")}</h4>
              </div>
              <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                <li>{t("terms.dataCollectionItems.1")}</li>
                <li>{t("terms.dataCollectionItems.2")}</li>
                <li>{t("terms.dataCollectionItems.3")}</li>
                <li>{t("terms.dataCollectionItems.4")}</li>
              </ul>
            </div>

            {/* Data Sharing */}
            <div className="bg-[#202225] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Share2 className="w-5 h-5 text-purple-400" />
                <h4 className="font-semibold text-white">2. {t("terms.dataSharing")}</h4>
              </div>
              <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                <li>{t("terms.dataSharingItems.1")}</li>
                <li>{t("terms.dataSharingItems.2")}</li>
                <li>{t("terms.dataSharingItems.3")}</li>
                <li>{t("terms.dataSharingItems.4")}</li>
              </ul>
            </div>

            {/* Data Security */}
            <div className="bg-[#202225] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-green-400" />
                <h4 className="font-semibold text-white">3. {t("terms.dataSecurity")}</h4>
              </div>
              <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                <li>{t("terms.dataSecurityItems.1")}</li>
                <li>{t("terms.dataSecurityItems.2")}</li>
                <li>{t("terms.dataSecurityItems.3")}</li>
                <li>{t("terms.dataSecurityItems.4")}</li>
              </ul>
            </div>

            {/* Research & Analytics */}
            <div className="bg-[#202225] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-5 h-5 text-pink-400" />
                <h4 className="font-semibold text-white">4. {t("terms.researchAnalytics")}</h4>
              </div>
              <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                <li>{t("terms.researchAnalyticsItems.1")}</li>
                <li>{t("terms.researchAnalyticsItems.2")}</li>
                <li>{t("terms.researchAnalyticsItems.3")}</li>
                <li>{t("terms.researchAnalyticsItems.4")}</li>
              </ul>
            </div>

            {/* User Rights */}
            <div>
              <h4 className="font-semibold text-white mb-2">5. {t("terms.yourRights")}</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>{t("terms.yourRightsItems.1")}</li>
                <li>{t("terms.yourRightsItems.2")}</li>
                <li>{t("terms.yourRightsItems.3")}</li>
                <li>{t("terms.yourRightsItems.4")}</li>
                <li>{t("terms.yourRightsItems.5")}</li>
              </ul>
            </div>

            {/* Disclaimer */}
            <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-4">
              <h4 className="font-semibold text-amber-300 mb-2">{t("terms.medicalDisclaimer")}</h4>
              <p className="text-sm text-amber-200/80">
                {t("terms.medicalDisclaimerDesc")}
              </p>
            </div>

            {/* Acceptance */}
            <div className="bg-indigo-900/20 border border-indigo-700/30 rounded-lg p-4">
              <p className="text-sm text-indigo-200">
                <strong className="text-white">{t("terms.acknowledgment")}</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 mt-2 text-sm text-indigo-200/90">
                <li>{t("terms.acknowledgmentItems.1")}</li>
                <li>{t("terms.acknowledgmentItems.2")}</li>
                <li>{t("terms.acknowledgmentItems.3")}</li>
                <li>{t("terms.acknowledgmentItems.4")}</li>
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
            {t("common.cancel")}
          </button>
          <button
            onClick={() => {
              onAccept();
              onClose();
            }}
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-indigo-500/50"
          >
            {t("terms.acceptContinue")}
          </button>
        </div>
      </div>
    </div>
  );
}


