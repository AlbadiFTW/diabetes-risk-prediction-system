import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  MessageSquare,
  Send,
  X,
  User,
  Stethoscope,
  Check,
  CheckCheck,
  Loader2,
  Trash2,
} from "lucide-react";

interface MessagingProps {
  userProfile: {
    userId: Id<"users">;
    role: "patient" | "doctor";
    firstName: string;
    lastName: string;
  };
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Messaging({ userProfile, isOpen: externalIsOpen, onOpenChange }: MessagingProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = onOpenChange || setInternalIsOpen;
  const [selectedConversation, setSelectedConversation] = useState<Id<"users"> | null>(null);
  const [messageContent, setMessageContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get conversations
  const conversations = useQuery(api.messages.getConversations);
  const unreadCount = useQuery(api.messages.getUnreadMessageCount);
  const assignedUsers = useQuery(api.messages.getAssignedUsersForMessaging);

  // Get messages for selected conversation
  const messages = useQuery(
    api.messages.getConversation,
    selectedConversation ? { otherUserId: selectedConversation } : "skip"
  );

  const sendMessage = useMutation(api.messages.sendMessage);
  const markAsRead = useMutation(api.messages.markMessagesAsRead);
  const deleteMessage = useMutation(api.messages.deleteMessage);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Mark messages as read when conversation is opened
  useEffect(() => {
    if (selectedConversation && messages && messages.length > 0) {
      markAsRead({ senderId: selectedConversation }).catch(console.error);
    }
  }, [selectedConversation, messages, markAsRead]);

  const handleSendMessage = async () => {
    if (!selectedConversation || !messageContent.trim() || isSending) {
      return;
    }

    setIsSending(true);
    try {
      await sendMessage({
        recipientId: selectedConversation,
        content: messageContent,
      });
      setMessageContent("");
    } catch (error: any) {
      toast.error(error.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: Id<"messages">) => {
    if (!confirm("Are you sure you want to delete this message?")) {
      return;
    }

    try {
      await deleteMessage({ messageId });
      toast.success("Message deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete message");
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const getPartnerName = (conversation: any) => {
    if (!conversation) return "";
    const rolePrefix = conversation.partner.role === "doctor" ? "Dr. " : "";
    return `${rolePrefix}${conversation.partner.firstName} ${conversation.partner.lastName}`;
  };

  const selectedConversationData = conversations?.find(
    (conv) => conv?.partnerId === selectedConversation
  );

  return (
    <>
      {/* Messaging Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-2xl">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-6 h-6" />
                <h2 className="text-xl font-semibold">Messages</h2>
                {unreadCount && unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-white/20 rounded-full text-sm font-medium">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setSelectedConversation(null);
                }}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Conversations List */}
              <div className="w-1/3 border-r border-gray-200 overflow-y-auto bg-gray-50">
                {conversations && conversations.length > 0 ? (
                  <div className="p-2">
                    {conversations.map((conversation) => {
                      if (!conversation) return null;
                      const isSelected = selectedConversation === conversation.partnerId;
                      return (
                        <button
                          key={conversation.partnerId}
                          onClick={() => setSelectedConversation(conversation.partnerId)}
                          className={`w-full p-3 rounded-xl mb-2 text-left transition-all ${
                            isSelected
                              ? "bg-blue-100 border-2 border-blue-500"
                              : "bg-white hover:bg-gray-100 border-2 border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                              {conversation.partner.role === "doctor" ? (
                                <Stethoscope className="w-5 h-5" />
                              ) : (
                                <User className="w-5 h-5" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-semibold text-gray-900 truncate">
                                  {getPartnerName(conversation)}
                                </p>
                                {conversation.unreadCount > 0 && (
                                  <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full flex-shrink-0">
                                    {conversation.unreadCount}
                                  </span>
                                )}
                              </div>
                              {conversation.latestMessage && (
                                <p className="text-sm text-gray-600 truncate">
                                  {conversation.latestMessage.isFromMe && "You: "}
                                  {conversation.latestMessage.content}
                                </p>
                              )}
                              {conversation.latestMessage && (
                                <p className="text-xs text-gray-400 mt-1">
                                  {formatTime(conversation.latestMessage.sentAt)}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : assignedUsers && assignedUsers.length > 0 ? (
                  <div className="p-2">
                    <p className="text-xs text-gray-500 mb-2 px-2">Start a conversation:</p>
                    {assignedUsers.map((assignedUser) => {
                      const isSelected = selectedConversation === assignedUser.userId;
                      const rolePrefix = assignedUser.role === "doctor" ? "Dr. " : "";
                      const displayName = `${rolePrefix}${assignedUser.firstName} ${assignedUser.lastName}`;
                      
                      // Check if there's already a conversation with this user
                      const existingConversation = conversations?.find(
                        (conv) => conv?.partnerId === assignedUser.userId
                      );
                      
                      if (existingConversation) {
                        return null; // Already shown in conversations list
                      }
                      
                      return (
                        <button
                          key={assignedUser.userId}
                          onClick={() => setSelectedConversation(assignedUser.userId)}
                          className={`w-full p-3 rounded-xl mb-2 text-left transition-all ${
                            isSelected
                              ? "bg-blue-100 border-2 border-blue-500"
                              : "bg-white hover:bg-gray-100 border-2 border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                              {assignedUser.role === "doctor" ? (
                                <Stethoscope className="w-5 h-5" />
                              ) : (
                                <User className="w-5 h-5" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 truncate">
                                {displayName}
                              </p>
                              <p className="text-xs text-gray-400 mt-1 capitalize">
                                {assignedUser.role}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                    <MessageSquare className="w-16 h-16 text-gray-300 mb-4" />
                    <p className="text-gray-500 font-medium">No conversations yet</p>
                    <p className="text-gray-400 text-sm mt-1">
                      {userProfile.role === "patient"
                        ? "You need to be assigned to a doctor to start messaging"
                        : "You need to have assigned patients to start messaging"}
                    </p>
                  </div>
                )}
              </div>

              {/* Messages View */}
              <div className="flex-1 flex flex-col">
                {selectedConversation ? (
                  <>
                    {/* Conversation Header */}
                    <div className="p-4 border-b border-gray-200 bg-white">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                          {selectedConversationData?.partner.role === "doctor" ? (
                            <Stethoscope className="w-5 h-5" />
                          ) : (
                            <User className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {getPartnerName(selectedConversationData)}
                          </p>
                          <p className="text-sm text-gray-500 capitalize">
                            {selectedConversationData?.partner.role}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                      {messages && messages.length > 0 ? (
                        <div className="space-y-4">
                          {messages.map((message) => {
                            const isFromMe = message.senderId === userProfile.userId;
                            return (
                              <div
                                key={message._id}
                                className={`flex items-end gap-2 group ${isFromMe ? "justify-end" : "justify-start"}`}
                              >
                                {isFromMe && (
                                  <button
                                    onClick={() => handleDeleteMessage(message._id)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-100 rounded-full text-red-500 hover:text-red-600"
                                    title="Delete message"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                                <div
                                  className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                                    isFromMe
                                      ? "bg-blue-500 text-white rounded-br-sm"
                                      : "bg-white text-gray-900 rounded-bl-sm border border-gray-200"
                                  }`}
                                >
                                  <p className="text-sm whitespace-pre-wrap break-words">
                                    {message.content}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <p
                                      className={`text-xs ${
                                        isFromMe ? "text-blue-100" : "text-gray-400"
                                      }`}
                                    >
                                      {formatTime(message._creationTime)}
                                    </p>
                                    {isFromMe && (
                                      <span className={isFromMe ? "text-blue-100" : "text-gray-400"}>
                                        {message.isRead ? (
                                          <CheckCheck className="w-3 h-3" />
                                        ) : (
                                          <Check className="w-3 h-3" />
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          <div ref={messagesEndRef} />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                          <MessageSquare className="w-16 h-16 text-gray-300 mb-4" />
                          <p className="text-gray-500 font-medium">No messages yet</p>
                          <p className="text-gray-400 text-sm mt-1">
                            Start the conversation by sending a message
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Message Input */}
                    <div className="p-4 border-t border-gray-200 bg-white">
                      <div className="flex items-end gap-2">
                        <textarea
                          value={messageContent}
                          onChange={(e) => setMessageContent(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          placeholder="Type your message..."
                          rows={2}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                        />
                        <button
                          onClick={handleSendMessage}
                          disabled={!messageContent.trim() || isSending}
                          className="px-6 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {isSending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Send className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                      <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 font-medium">Select a conversation</p>
                      <p className="text-gray-400 text-sm mt-1">
                        Choose a conversation from the list to start messaging
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

