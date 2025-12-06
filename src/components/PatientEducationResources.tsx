import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  BookOpen,
  Video,
  Lightbulb,
  FileText,
  ExternalLink,
  Search,
  Filter,
  X,
  Play,
  Calendar,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

type ResourceType = "article" | "video" | "tip" | "guide" | "link";
type ResourceCategory =
  | "prevention"
  | "nutrition"
  | "exercise"
  | "medication"
  | "monitoring"
  | "complications"
  | "lifestyle"
  | "general";

const categoryLabels: Record<ResourceCategory, string> = {
  prevention: "Prevention",
  nutrition: "Nutrition",
  exercise: "Exercise",
  medication: "Medication",
  monitoring: "Monitoring",
  complications: "Complications",
  lifestyle: "Lifestyle",
  general: "General",
};

const typeLabels: Record<ResourceType, string> = {
  article: "Article",
  video: "Video",
  tip: "Tip",
  guide: "Guide",
  link: "External Link",
};

const typeIcons: Record<ResourceType, typeof BookOpen> = {
  article: BookOpen,
  video: Video,
  tip: Lightbulb,
  guide: FileText,
  link: ExternalLink,
};

export function PatientEducationResources() {
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory | "all">("all");
  const [selectedType, setSelectedType] = useState<ResourceType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResource, setSelectedResource] = useState<Id<"educationResources"> | null>(null);

  const incrementViewCount = useMutation(api.educationResources.incrementViewCount);

  const resources = useQuery(api.educationResources.getPublishedResources, {
    category: selectedCategory !== "all" ? selectedCategory : undefined,
    type: selectedType !== "all" ? selectedType : undefined,
  });

  const resourceDetails = useQuery(
    api.educationResources.getResourceById,
    selectedResource ? { resourceId: selectedResource } : ("skip" as const)
  );

  // Increment view count when resource is viewed
  useEffect(() => {
    if (selectedResource) {
      incrementViewCount({ resourceId: selectedResource }).catch(console.error);
    }
  }, [selectedResource, incrementViewCount]);

  const filteredResources = useMemo(() => {
    if (!resources) return [];

    return resources.filter((resource) => {
      const matchesSearch =
        searchQuery === "" ||
        resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        resource.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        resource.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        resource.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesSearch;
    });
  }, [resources, searchQuery]);

  const handleResourceClick = (resourceId: Id<"educationResources">) => {
    setSelectedResource(resourceId);
  };

  const handleExternalLink = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const formatDate = (timestamp: number | undefined) => {
    if (!timestamp) return "Unknown";
    return new Date(timestamp).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (selectedResource && resourceDetails) {
    const Icon = typeIcons[resourceDetails.type];
    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelectedResource(null)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <X className="w-4 h-4" />
          Back to Resources
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium opacity-90">
                    {typeLabels[resourceDetails.type]} • {categoryLabels[resourceDetails.category]}
                  </span>
                </div>
                <h1 className="text-3xl font-bold mb-2">{resourceDetails.title}</h1>
                <p className="text-blue-100">{resourceDetails.description}</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-center gap-4 text-sm text-gray-600 mb-6 pb-6 border-b">
              {resourceDetails.author && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">By:</span>
                  <span>{resourceDetails.author}</span>
                </div>
              )}
              {resourceDetails.publishedAt && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(resourceDetails.publishedAt)}</span>
                </div>
              )}
              {resourceDetails.viewCount !== undefined && (
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  <span>{resourceDetails.viewCount} views</span>
                </div>
              )}
            </div>

            {resourceDetails.type === "video" && resourceDetails.url && (
              <div className="mb-6">
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center relative overflow-hidden">
                  {resourceDetails.thumbnailUrl ? (
                    <img
                      src={resourceDetails.thumbnailUrl}
                      alt={resourceDetails.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center">
                      <Play className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600">Video Resource</p>
                    </div>
                  )}
                  <button
                    onClick={() => handleExternalLink(resourceDetails.url!)}
                    className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 hover:bg-opacity-70 transition-opacity"
                  >
                    <div className="bg-white rounded-full p-4 hover:scale-110 transition-transform">
                      <Play className="w-8 h-8 text-blue-600" fill="currentColor" />
                    </div>
                  </button>
                </div>
              </div>
            )}

            {resourceDetails.type === "link" && resourceDetails.url && (
              <div className="mb-6">
                <a
                  href={resourceDetails.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Visit External Resource
                </a>
              </div>
            )}

            <div className="prose max-w-none">
              <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                {resourceDetails.content}
              </div>
            </div>

            {resourceDetails.tags && resourceDetails.tags.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm font-medium text-gray-600 mb-2">Tags:</p>
                <div className="flex flex-wrap gap-2">
                  {resourceDetails.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Education Resources</h2>
        <p className="text-gray-600">
          Learn about diabetes prevention, management, and healthy living through articles, videos,
          and guides.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as ResourceCategory | "all")}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Categories</option>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as ResourceType | "all")}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Types</option>
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Resources Grid */}
      {filteredResources.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No resources found</h3>
          <p className="text-gray-600">
            {searchQuery
              ? "Try adjusting your search or filters"
              : "No education resources are available at the moment."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredResources.map((resource) => {
            const Icon = typeIcons[resource.type];
            return (
              <div
                key={resource._id}
                onClick={() => handleResourceClick(resource._id)}
                className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer overflow-hidden group"
              >
                {resource.thumbnailUrl && (
                  <div className="aspect-video bg-gray-100 overflow-hidden">
                    <img
                      src={resource.thumbnailUrl}
                      alt={resource.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}

                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-medium text-blue-600">
                      {typeLabels[resource.type]}
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">
                      {categoryLabels[resource.category]}
                    </span>
                  </div>

                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {resource.title}
                  </h3>

                  <p className="text-sm text-gray-600 line-clamp-3 mb-4">{resource.description}</p>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    {resource.publishedAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(resource.publishedAt)}
                      </span>
                    )}
                    {resource.viewCount !== undefined && (
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {resource.viewCount} views
                      </span>
                    )}
                  </div>

                  {resource.type === "link" && resource.url && (
                    <div className="mt-4 pt-4 border-t">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExternalLink(resource.url!);
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open Link
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

