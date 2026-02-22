/**
 * CMS Dashboard Type Definitions
 * Defines all types and interfaces for the admin CMS system
 */

/**
 * Represents a dynamic field in a data item
 */
export interface DynamicField {
  /** Field name/key */
  name: string;
  /** Field data type */
  type: "string" | "number" | "boolean" | "array" | "image";
  /** Optional field label for display */
  label?: string;
}

/**
 * Represents a data item (project or service)
 * Uses generic structure to support dynamic fields
 */
export interface DataItem {
  /** Unique identifier */
  id: string | number;
  /** Dynamic field values */
  [key: string]: unknown;
}

/**
 * GitHub API file response
 */
export interface GitHubFileResponse {
  /** File name */
  name: string;
  /** File path */
  path: string;
  /** File SHA (commit hash) */
  sha: string;
  /** File size in bytes */
  size: number;
  /** Base64 encoded content */
  content?: string;
  /** URL to the file */
  download_url?: string;
}

/**
 * Upload request payload
 */
export interface ImageUploadPayload {
  /** File name with extension */
  fileName: string;
  /** Base64 encoded file content */
  base64Content: string;
  /** Optional folder inside /public/uploads */
  folder?: string;
  /** Admin password */
  password: string;
}

/**
 * Image delete request payload
 */
export interface ImageDeletePayload {
  /** Full file path in repository */
  filePath: string;
  /** Admin password */
  password: string;
}

/**
 * JSON file update request payload
 */
export interface JSONUpdatePayload {
  /** File path in repository */
  filePath: string;
  /** File content as string */
  content: string;
  /** Admin password */
  password: string;
}

/**
 * JSON file fetch request payload
 */
export interface JSONFetchPayload {
  /** File path in repository */
  filePath: string;
}

/**
 * API response wrapper for success
 */
export interface APISuccessResponse<T = unknown> {
  /** Success flag */
  success: true;
  /** Response data */
  data?: T;
  /** Optional message */
  message?: string;
}

/**
 * API response wrapper for errors
 */
export interface APIErrorResponse {
  /** Success flag */
  success: false;
  /** Error message */
  error: string;
  /** HTTP status code */
  status?: number;
}

/**
 * Union type for API responses
 */
export type APIResponse<T = unknown> = APISuccessResponse<T> | APIErrorResponse;

/**
 * Image compression options
 */
export interface CompressionOptions {
  /** Maximum file size in MB */
  maxSizeMB: number;
  /** Maximum width or height */
  maxWidthOrHeight: number;
  /** Use web worker for compression */
  useWebWorker: boolean;
  /** Initial quality hint (0 to 1) */
  initialQuality?: number;
  /** Max compression iterations */
  maxIteration?: number;
  /** Output mime type */
  fileType?: "image/jpeg" | "image/png" | "image/webp";
}

/**
 * Image compression result
 */
export interface CompressionResult {
  /** Compressed image file */
  file: File;
  /** Original size in bytes */
  originalSize: number;
  /** Compressed size in bytes */
  compressedSize: number;
  /** Compression ratio percentage */
  ratio: number;
}

/**
 * Field configuration for dynamic form rendering
 */
export interface FieldConfig {
  /** Field key/name */
  name: string;
  /** Field type for rendering appropriate input */
  type: "string" | "number" | "boolean" | "array" | "image";
  /** Human readable label */
  label: string;
  /** Whether field is required */
  required?: boolean;
  /** Placeholder text for inputs */
  placeholder?: string;
}

/**
 * Admin state context
 */
export interface AdminState {
  /** Currently loaded items */
  items: DataItem[];
  /** Available fields in current data */
  fields: DynamicField[];
  /** Currently selected file path */
  selectedFile: string | null;
  /** Whether data is loading */
  isLoading: boolean;
  /** Current error message */
  error: string | null;
  /** Success message */
  success: string | null;
}

/**
 * File option for selection
 */
export interface FileOption {
  /** Display label */
  label: string;
  /** File path in repository */
  path: string;
}

/**
 * Pagination info
 */
export interface PaginationInfo {
  /** Current page */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Total items count */
  total: number;
}
