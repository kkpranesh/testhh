import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Settings,
  X,
  Search,
  FileText,
  Info,
  BarChart3,
  Eye,
  Filter,
  Upload,
  RefreshCw,
} from "lucide-react";
import apiClient from "../services/apiClient";

// --- TYPE DEFINITIONS ---
interface TreeNode {
  id: string;
  label: string;
  annotations?: Record<string, string>;
  children?: TreeNode[];
}

interface Property {
  id: string;
  label: string;
  type: string;
  annotations?: Record<string, string>;
  domains?: string[];
  ranges?: string[];
  characteristics?: string[];
}

interface Individual {
  id: string;
  label: string;
  annotations?: Record<string, string>;
  types?: string[];
  sameAs?: string[];
  differentFrom?: string[];
}

type SelectableItem = TreeNode | Property | Individual;

interface OntologyMetadata {
  filename: string;
  ontologyIRI: string | null;
  versionIRI: string | null;
  classCount: number;
  objectPropertyCount: number;
  dataPropertyCount: number;
  individualCount: number;
  axiomCount: number;
}

interface CreateClassModalProps {
  onClose: () => void;
  onCreate: (className: string, parentId: string | null) => void;
  parentId: string | null;
}

interface UploadModalProps {
  onClose: () => void;
  onUpload: (file: File) => void;
}

// --- HELPER COMPONENT FOR ANNOTATION RENDERING ---
const AnnotationValue = ({ value }: { value: string }) => {
  const xmlLiteralTag = "^^rdf:XMLLiteral";
  let cleanedValue = value.toString();
  if (cleanedValue.startsWith('"')) cleanedValue = cleanedValue.substring(1);
  if (cleanedValue.endsWith(`"${xmlLiteralTag}`)) {
    cleanedValue = cleanedValue.slice(0, -`"${xmlLiteralTag}`.length);
  } else if (cleanedValue.endsWith('"')) {
    cleanedValue = cleanedValue.slice(0, -1);
  }

  const isMathML = /<mathml:math/i.test(cleanedValue);

  if (isMathML) {
    return <div dangerouslySetInnerHTML={{ __html: cleanedValue }} />;
  }

  return (
    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
      {cleanedValue}
    </p>
  );
};

// --- UPLOAD MODAL ---
const UploadModal = ({ onClose, onUpload }: UploadModalProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = () => {
    if (selectedFile) {
      onUpload(selectedFile);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                 {" "}
      <div className="bg-white rounded-lg p-6 w-[500px] shadow-xl">
                       {" "}
        <h3 className="text-lg font-semibold mb-4">Upload Ontology File</h3>   
                                    {" "}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center ${
            dragActive ? "border-purple-500 bg-purple-50" : "border-gray-300"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
                             {" "}
          <Upload className="mx-auto mb-4 text-gray-400" size={48} />           
                 {" "}
          <p className="text-sm text-gray-600 mb-2">
                                    Drag and drop your OWL file here, or        
                       {" "}
          </p>
                             {" "}
          <label className="cursor-pointer">
                                   {" "}
            <span className="text-purple-600 hover:text-purple-700 font-medium">
              browse
            </span>
                                   {" "}
            <input
              type="file"
              className="hidden"
              accept=".owl,.rdf,.xml,.ttl,.n3,.nt"
              onChange={handleChange}
            />
                               {" "}
          </label>
                             {" "}
          <p className="text-xs text-gray-500 mt-2">
                                    Supported formats: .owl, .rdf, .xml, .ttl,
            .n3, .nt                    {" "}
          </p>
                         {" "}
        </div>
                       {" "}
        {selectedFile && (
          <div className="mt-4 p-3 bg-gray-50 rounded flex items-center justify-between">
                                   {" "}
            <div className="flex items-center gap-2">
                                         {" "}
              <FileText size={16} className="text-gray-600" />                 
                       {" "}
              <span className="text-sm text-gray-700">{selectedFile.name}</span>
                                     {" "}
            </div>
                                   {" "}
            <button
              onClick={() => setSelectedFile(null)}
              className="text-gray-400 hover:text-gray-600"
            >
                                          <X size={16} />                       {" "}
            </button>
                               {" "}
          </div>
        )}
                       {" "}
        <div className="flex justify-end gap-2 mt-6">
                             {" "}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-gray-600 bg-gray-100 hover:bg-gray-200"
          >
                                    Cancel                    {" "}
          </button>
                             {" "}
          <button
            onClick={handleSubmit}
            disabled={!selectedFile}
            className="px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
                                    Upload                    {" "}
          </button>
                         {" "}
        </div>
                   {" "}
      </div>
             {" "}
    </div>
  );
};

// --- CREATE CLASS MODAL ---
const CreateClassModal = ({
  onClose,
  onCreate,
  parentId,
}: CreateClassModalProps) => {
  const [className, setClassName] = useState("");
  const handleSubmit = () => {
    if (className.trim()) {
      onCreate(className.trim(), parentId);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
                 {" "}
      <div
        className="bg-white rounded-lg p-6 w-96 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
                       {" "}
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Create New Class
        </h3>
                       {" "}
        {parentId && (
          <div className="mb-3 p-2 bg-gray-50 rounded">
                                   {" "}
            <p className="text-xs text-gray-500 mb-1">Parent Class:</p>         
                         {" "}
            <p className="font-mono text-xs text-gray-700 break-all">
              {parentId}
            </p>
                               {" "}
          </div>
        )}
                       {" "}
        <input
          type="text"
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          onKeyPress={(e) =>
            e.key === "Enter" && className.trim() && handleSubmit()
          }
          className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none text-gray-900"
          placeholder="Enter class name"
          autoFocus
        />
                       {" "}
        <div className="flex justify-end gap-3 mt-6">
                             {" "}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-gray-700 bg-gray-100 hover:bg-gray-200 font-medium transition-colors"
          >
                                    Cancel                    {" "}
          </button>
                             {" "}
          <button
            onClick={handleSubmit}
            disabled={!className.trim()}
            className="px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
                                    Create                    {" "}
          </button>
                         {" "}
        </div>
                   {" "}
      </div>
             {" "}
    </div>
  );
};

// --- METRICS PANEL ---
const MetricsPanel = ({ metadata }: { metadata: OntologyMetadata | null }) => {
  if (!metadata) return null;
  const metrics = [
    { label: "Classes", value: metadata.classCount },
    { label: "Object Properties", value: metadata.objectPropertyCount },
    { label: "Data Properties", value: metadata.dataPropertyCount },
    { label: "Individuals", value: metadata.individualCount },
    { label: "Axioms", value: metadata.axiomCount },
  ];
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
                 {" "}
      <div className="flex items-center gap-2 mb-3">
                        <BarChart3 size={16} className="text-purple-600" />     
                  <h3 className="font-semibold text-sm">Ontology Metrics</h3>   
               {" "}
      </div>
                 {" "}
      <div className="space-y-2">
                       {" "}
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="flex justify-between items-center text-sm"
          >
                                   {" "}
            <span className="text-gray-600">{metric.label}</span>               
                   {" "}
            <span className="font-semibold text-gray-900">
              {metric.value.toLocaleString()}
            </span>
                               {" "}
          </div>
        ))}
                   {" "}
      </div>
             {" "}
    </div>
  );
};

// --- ONTOLOGY HEADER INFO ---
const OntologyHeader = ({
  metadata,
}: {
  metadata: OntologyMetadata | null;
}) => {
  if (!metadata) return null;
  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 mb-4">
                 {" "}
      <div className="flex items-start gap-3">
                       {" "}
        <div className="mt-1">
                              <Info size={20} className="text-purple-600" />   
                     {" "}
        </div>
                       {" "}
        <div className="flex-1 space-y-2">
                             {" "}
          <div>
                                   {" "}
            <h3 className="text-xs font-semibold text-purple-900 uppercase">
              Ontology IRI
            </h3>
                                   {" "}
            <p className="text-sm text-purple-700 break-all">
              {metadata.ontologyIRI || "Not specified"}
            </p>
                               {" "}
          </div>
                             {" "}
          {metadata.versionIRI && (
            <div>
                                         {" "}
              <h3 className="text-xs font-semibold text-purple-900 uppercase">
                Version IRI
              </h3>
                                         {" "}
              <p className="text-sm text-purple-700 break-all">
                {metadata.versionIRI}
              </p>
                                     {" "}
            </div>
          )}
                         {" "}
        </div>
                   {" "}
      </div>
             {" "}
    </div>
  );
};


// --- MAIN DASHBOARD COMPONENT ---
const Dashboard = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<OntologyMetadata | null>(null);
  const [activeTab, setActiveTab] = useState("Classes");
  const [selectedItem, setSelectedItem] = useState<SelectableItem | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);

  const [classHierarchy, setClassHierarchy] = useState<TreeNode[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [individuals, setIndividuals] = useState<Individual[]>([]);

  const [isCreateClassModalOpen, setCreateClassModalOpen] = useState(false);
  const [parentIdForNewClass, setParentIdForNewClass] = useState<string | null>(
    null
  );

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filteredNodes, setFilteredNodes] = useState<TreeNode[]>([]);
  const [showMetrics, setShowMetrics] = useState(true);
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);

 
  const tabs = [
    {
      id: "Classes",
      label: "Classes",
      icon: FileText,
      count: metadata?.classCount,
    },
    {
      id: "Properties",
      label: "Properties",
      icon: Settings,
      count: metadata
        ? metadata.objectPropertyCount + metadata.dataPropertyCount
        : null,
    },
    {
      id: "Individuals",
      label: "Individuals",
      icon: Eye,
      count: metadata?.individualCount,
    },
  ];

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) =>
      prev.includes(nodeId)
        ? prev.filter((id) => id !== nodeId)
        : [...prev, nodeId]
    );
  };

  const renderTreeNode = (node: TreeNode, level = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.includes(node.id);
    const isSelected = selectedItem?.id === node.id;

    return (
      <div key={node.id}>
        <div
          className={`flex items-center px-2 py-1.5 rounded cursor-pointer transition-colors ${
            isSelected
              ? "bg-purple-100 border-l-2 border-purple-600"
              : "hover:bg-gray-50"
          }`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={() => setSelectedItem(node)}
        >
          {hasChildren ? (
            <button
              className="p-0.5 rounded hover:bg-gray-200 mr-1"
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </button>
          ) : (
            <span className="w-[22px]" />
          )}
          <span
            className={`text-sm ${
              isSelected ? "text-purple-900 font-medium" : "text-gray-700"
            }`}
          >
            {node.label}
          </span>
        </div>
        {hasChildren &&
          isExpanded &&
          node.children?.map((child) => renderTreeNode(child, level + 1))}
      </div>
    );
  };

  const handleCreateClass = async (
    className: string,
    parentId: string | null
  ) => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      await apiClient.post(`/api/ontology/${projectId}/classes`, {
        name: className,
        parentId,
      });
      await fetchData();
    } catch (error) {
      console.error("Failed to create class:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderLeftPanelContent = () => {
    switch (activeTab) {
      case "Classes":
        return filteredNodes.length > 0 ? (
          filteredNodes.map((node) => renderTreeNode(node))
        ) : (
          <div className="p-4 text-center text-gray-400">No classes found</div>
        );
      case "Properties":
        return properties.length > 0 ? (
          properties.map((prop) => (
            <div
              key={prop.id}
              className={`flex items-center px-2 py-1.5 rounded cursor-pointer hover:bg-gray-50 ${
                selectedItem?.id === prop.id
                  ? "bg-purple-100 border-l-2 border-purple-600"
                  : ""
              }`}
              onClick={() => setSelectedItem(prop)}
            >
              <span
                className={`text-sm ${
                  selectedItem?.id === prop.id
                    ? "text-purple-900 font-medium"
                    : "text-gray-700"
                }`}
              >
                {prop.label}
              </span>
              <span className="ml-2 text-xs text-gray-400">({prop.type})</span>
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-gray-400">
            No properties found
          </div>
        );
      case "Individuals":
        return individuals.length > 0 ? (
          individuals.map((ind) => (
            <div
              key={ind.id}
              className={`px-2 py-1.5 rounded cursor-pointer hover:bg-gray-50 ${
                selectedItem?.id === ind.id
                  ? "bg-purple-100 border-l-2 border-purple-600"
                  : ""
              }`}
              onClick={() => setSelectedItem(ind)}
            >
              <span
                className={`text-sm ${
                  selectedItem?.id === ind.id
                    ? "text-purple-900 font-medium"
                    : "text-gray-700"
                }`}
              >
                {ind.label}
              </span>
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-gray-400">
            No individuals found
          </div>
        );
      default:
        return (
          <div className="p-4 text-center text-gray-400">Not implemented</div>
        );
    }
  };

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    try {
      const [metadataRes, classesRes, propsRes, indsRes] =
        await Promise.allSettled([
          apiClient.get(`/api/ontology/metadata/${projectId}`),
          apiClient.get(`/api/ontology/classes/tree/${projectId}`),
          apiClient.get(`/api/ontology/properties/${projectId}`),
          apiClient.get(`/api/ontology/individuals/${projectId}`),
        ]);

      if (metadataRes.status === "fulfilled" && metadataRes.value.data) {
        setMetadata(metadataRes.value.data.data?.metadata || null);
      }

      if (classesRes.status === "fulfilled" && classesRes.value.data) {
        setClassHierarchy(classesRes.value.data || []);
        setFilteredNodes(classesRes.value.data || []);
        if (classesRes.value.data && classesRes.value.data.length > 0) {
          setExpandedNodes([classesRes.value.data[0].id]);
        }
      }

      if (propsRes.status === "fulfilled" && propsRes.value.data) {
        setProperties(propsRes.value.data.data || []);
      }

      if (indsRes.status === "fulfilled" && indsRes.value.data) {
        setIndividuals(indsRes.value.data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Search handler with debouncing
  useEffect(() => {
    if (!projectId) return;

    const timerId = setTimeout(async () => {
      if (searchQuery) {
        setIsLoading(true);
        try {
          const response = await apiClient.get<TreeNode[]>(
            `/api/ontology/search`,
            {
              params: { projectId, query: searchQuery },
            }
          );
          setFilteredNodes(response.data);
        } catch (error) {
          console.error("Search failed:", error);
          setFilteredNodes([]);
        } finally {
          setIsLoading(false);
        }
      } else {
        setFilteredNodes(classHierarchy);
      }
    }, 300);

    return () => clearTimeout(timerId);
  }, [searchQuery, projectId, classHierarchy]);

  // Handle initial data load or project changes
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case "showLoading":
          setIsLoading(true);
          break;
        case "fileReady":
          setProjectId(message.projectId);
          break;
        case "loadingFailed":
          setIsLoading(false);
          break;
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
  }, [projectId, fetchData]);

  // Handler for the upload modal
  const handleUpload = async (file: File) => {
    if (!projectId) return;
    setIsLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectId", projectId);

    try {
      await apiClient.post(`/api/ontology/load`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      await fetchData();
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderSelectedItemDetails = () => {
    if (!selectedItem) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center text-gray-400">
            <FileText size={48} className="mx-auto mb-3 opacity-50" />
            <p className="text-lg">Select an item to view details</p>
          </div>
        </div>
      );
    }

    const isProperty = (item: SelectableItem): item is Property =>
      "type" in item;
    const isIndividual = (item: SelectableItem): item is Individual =>
      "types" in item;

    if (!projectId && !isLoading) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-100">
              <div className="text-center text-gray-500">
                  <FileText size={48} className="mx-auto mb-4" />
                  <h2 className="text-xl font-semibold">Welcome to OntoCode</h2>
                  <p className="mt-2">To begin, open an `.owl` file and run the "OntoCode: Edit" command.</p>
              </div>
          </div>
      );
  }

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {selectedItem.label}
          </h2>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="font-medium">IRI:</span>
            <code className="bg-gray-100 px-2 py-1 rounded text-purple-700 break-all">
              {selectedItem.id}
            </code>
          </div>
        </div>

        {selectedItem.annotations &&
          Object.keys(selectedItem.annotations).length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Annotations
              </h3>
              <div className="space-y-4">
                {Object.entries(selectedItem.annotations).map(
                  ([key, value]) => (
                    <div
                      key={key}
                      className="border-l-2 border-purple-500 pl-4"
                    >
                      <div className="text-xs font-semibold text-purple-900 mb-1">
                        {key
                          .replace(/([A-Z])/g, " $1")
                          .replace("rdfs", "rdfs:")
                          .replace(/^./, (str) => str.toUpperCase())}
                      </div>
                      <AnnotationValue value={value} />
                    </div>
                  )
                )}
              </div>
            </>
          )}

        {isProperty(selectedItem) && (
          <>
            {selectedItem.domains && selectedItem.domains.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  Domains
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedItem.domains.map((domain, i) => (
                    <span
                      key={i}
                      className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded"
                    >
                      {domain}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {selectedItem.ranges && selectedItem.ranges.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  Ranges
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedItem.ranges.map((range, i) => (
                    <span
                      key={i}
                      className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded"
                    >
                      {range}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {selectedItem.characteristics &&
              selectedItem.characteristics.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                    Characteristics
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.characteristics.map((char, i) => (
                      <span
                        key={i}
                        className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded"
                      >
                        {char}
                      </span>
                    ))}
                  </div>
                </div>
              )}
          </>
        )}

        {isIndividual(selectedItem) && (
          <>
            {selectedItem.types && selectedItem.types.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  Types
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedItem.types.map((type, i) => (
                    <span
                      key={i}
                      className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded"
                    >
                      {type}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {selectedItem.sameAs && selectedItem.sameAs.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  Same As
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedItem.sameAs.map((id, i) => (
                    <span
                      key={i}
                      className="text-xs bg-pink-100 text-pink-800 px-2 py-1 rounded"
                    >
                      {id}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {selectedItem.differentFrom &&
              selectedItem.differentFrom.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                    Different From
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.differentFrom.map((id, i) => (
                      <span
                        key={i}
                        className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded"
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                </div>
              )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col text-sm">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded flex items-center justify-center shadow-md">
              <FileText size={16} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800">
                {projectId}
              </div>
              <div className="text-xs text-gray-500">
                {metadata?.filename || "No file loaded"}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUploadModalOpen(true)}
            className="flex items-center gap-1.5 text-xs text-white bg-purple-600 hover:bg-purple-700 px-3 py-1.5 rounded transition-colors"
          >
            <Upload size={14} />
            <span>Upload</span>
          </button>
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded transition-colors"
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowMetrics(!showMetrics)}
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded transition-colors"
          >
            <BarChart3 size={14} />
            <span>Metrics</span>
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white border-b border-gray-200 px-4 flex items-center shadow-sm">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "text-purple-600 border-purple-600"
                  : "text-gray-600 hover:text-gray-800 border-transparent hover:border-gray-300"
              }`}
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedItem(null);
              }}
            >
              <Icon size={16} />
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Main Content Area */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col shadow-sm">
          <div className="p-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => {
                  const parentId =
                    selectedItem && "children" in selectedItem
                      ? selectedItem.id
                      : null;
                  setParentIdForNewClass(parentId);
                  setCreateClassModalOpen(true);
                }}
                disabled={activeTab !== "Classes"}
                className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-colors"
                title="Add New Class"
              >
                <Plus size={14} />
                <span>New Class</span>
              </button>
              <button
                className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                title="Filter"
              >
                <Filter size={14} className="text-gray-600" />
              </button>
            </div>

            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder={`Search ${activeTab.toLowerCase()}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="text-center p-4 text-gray-500">Loading...</div>
            ) : (
              renderLeftPanelContent()
            )}
          </div>
        </aside>

        {/* Main Content & Comments Panel */}
        <section className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
          <div className="flex-1 flex flex-col border-b border-gray-200">
            {showMetrics && metadata && (
              <div className="p-4 border-b border-gray-200 bg-white">
                <OntologyHeader metadata={metadata} />
                <MetricsPanel metadata={metadata} />
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4">
              {renderSelectedItemDetails()}
            </div>
          </div>

          {/* Comments & Project Feed */}
          <div className="h-64 shrink-0 flex flex-col bg-white border-t border-gray-200">
            <div className="bg-gray-50 border-b border-gray-200 p-2 flex items-center justify-between text-xs font-bold text-gray-600 h-9">
              <span>Comments</span>
              <button className="p-1 hover:bg-gray-200 rounded">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto text-center text-gray-400">
              <p>Comments functionality not yet implemented.</p>
            </div>
          </div>
        </section>
      </main>

      {isUploadModalOpen && (
        <UploadModal
          onClose={() => setUploadModalOpen(false)}
          onUpload={handleUpload}
        />
      )}

      {isCreateClassModalOpen && (
        <CreateClassModal
          onClose={() => setCreateClassModalOpen(false)}
          onCreate={handleCreateClass}
          parentId={parentIdForNewClass}
        />
      )}
    </div>
  );
};

export default Dashboard;


