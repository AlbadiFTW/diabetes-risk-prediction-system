"use client";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { X, Send, Mail, User, MessageSquare, AlertCircle } from "lucide-react";

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupportModal({ isOpen, onClose }: SupportModalProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitSupport = useMutation(api.support.submitSupportMessage);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !subject || !message) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitSupport({
        email,
        name: name || undefined,
        subject,
        message,
        priority,
      });
      toast.success("Support message sent successfully! We'll get back to you soon.");
      // Reset form
      setEmail("");
      setName("");
      setSubject("");
      setMessage("");
      setPriority("medium");
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to send support message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#2F3136] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#202225]">
        {/* Header */}
        <div className="sticky top-0 bg-[#2F3136] border-b border-[#202225] p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Contact Support</h2>
              <p className="text-sm text-[#B9BBBE]">We're here to help!</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#B9BBBE] hover:text-white transition-colors p-2 hover:bg-[#202225] rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-[#B9BBBE] mb-2">
              Email <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B9BBBE]">
                <Mail className="w-5 h-5" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                required
                className="w-full pl-12 pr-4 py-3 bg-[#202225] border border-[#202225] rounded-lg text-white placeholder-[#72767D] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
            </div>
          </div>

          {/* Name (Optional) */}
          <div>
            <label className="block text-sm font-medium text-[#B9BBBE] mb-2">
              Name (Optional)
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B9BBBE]">
                <User className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full pl-12 pr-4 py-3 bg-[#202225] border border-[#202225] rounded-lg text-white placeholder-[#72767D] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-[#B9BBBE] mb-2">
              Subject <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief description of your issue"
              required
              className="w-full px-4 py-3 bg-[#202225] border border-[#202225] rounded-lg text-white placeholder-[#72767D] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 transition-all"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-[#B9BBBE] mb-2">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high" | "urgent")}
              className="w-full px-4 py-3 bg-[#202225] border border-[#202225] rounded-lg text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 transition-all"
            >
              <option value="low">Low - General inquiry</option>
              <option value="medium">Medium - Minor issue</option>
              <option value="high">High - Important issue</option>
              <option value="urgent">Urgent - Critical issue</option>
            </select>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-[#B9BBBE] mb-2">
              Message <span className="text-red-400">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Please describe your issue or question in detail..."
              required
              rows={6}
              className="w-full px-4 py-3 bg-[#202225] border border-[#202225] rounded-lg text-white placeholder-[#72767D] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none"
            />
          </div>

          {/* Info */}
          <div className="flex items-start gap-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
            <AlertCircle className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#B9BBBE]">
              We typically respond within 24-48 hours. For urgent issues, please select "Urgent" priority.
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-[#202225] hover:bg-[#2A2D31] border border-[#202225] rounded-lg text-white font-medium transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-lg text-white font-semibold hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 transition-all duration-300 shadow-lg hover:shadow-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Send Message</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}










