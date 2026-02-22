/**
 * GitHub API utility wrapper
 * Handles all interactions with GitHub API for file operations
 */

import type { GitHubFileResponse } from "@/types/cms";

/**
 * Configuration for GitHub API
 */
interface GitHubConfig {
  /** GitHub personal access token */
  token: string;
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** Branch name (default: main) */
  branch: string;
}

/**
 * GitHub API base URL
 */
const GITHUB_API_BASE = "https://api.github.com";

/**
 * GitHubAPI class for handling GitHub operations
 */
export class GitHubAPI {
  private config: GitHubConfig;

  /**
   * Initialize GitHub API with configuration
   * @param config - GitHub configuration
   */
  constructor(config: GitHubConfig) {
    if (!config.token) {
      throw new Error("GitHub token is required");
    }
    if (!config.owner || !config.repo) {
      throw new Error("GitHub owner and repo are required");
    }

    this.config = {
      ...config,
      branch: config.branch || "main",
    };
  }

  /**
   * Get authorization headers for GitHub API requests
   * @returns Headers object with authorization
   */
  private getHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.config.token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    };
  }

  /**
   * Build GitHub API URL for a file path
   * @param filePath - Path to file in repository
   * @returns Full API URL
   */
  private buildUrl(filePath: string): string {
    const cleanPath = filePath.startsWith("/") ? filePath.slice(1) : filePath;
    return `${GITHUB_API_BASE}/repos/${this.config.owner}/${this.config.repo}/contents/${cleanPath}`;
  }

  /**
   * Fetch file from GitHub repository
   * @param filePath - Path to file in repository
   * @returns File data from GitHub
   * @throws Error if file not found or request fails
   */
  async getFile(filePath: string): Promise<GitHubFileResponse> {
    const url = this.buildUrl(filePath);

    try {
      const response = await fetch(url, {
        headers: this.getHeaders(),
        cache: "no-store",
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`File not found: ${filePath}`);
        }
        throw new Error(
          `GitHub API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as GitHubFileResponse;
      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch file from GitHub: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Create or update file in GitHub repository
   * @param filePath - Path to file in repository
   * @param content - File content
   * @param message - Commit message
   * @param sha - File SHA (for updates, required)
   * @returns Updated file data
   * @throws Error if operation fails
   */
  async putFile(
    filePath: string,
    content: string,
    message: string,
    sha?: string,
    options?: { contentEncoding?: "utf-8" | "base64" }
  ): Promise<GitHubFileResponse> {
    const url = this.buildUrl(filePath);

    const base64Content =
      options?.contentEncoding === "base64"
        ? content
        : Buffer.from(content, "utf-8").toString("base64");

    const body = {
      message,
      content: base64Content,
      branch: this.config.branch,
      ...(sha && { sha }),
    };

    try {
      const response = await fetch(url, {
        method: "PUT",
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          `GitHub API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as { content: GitHubFileResponse };
      return data.content;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to update file in GitHub: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Delete file from GitHub repository
   * @param filePath - Path to file in repository
   * @param sha - File SHA (required for deletion)
   * @param message - Commit message
   * @returns Deletion confirmation
   * @throws Error if operation fails
   */
  async deleteFile(
    filePath: string,
    sha: string,
    message: string = "Delete file"
  ): Promise<GitHubFileResponse> {
    const url = this.buildUrl(filePath);

    const body = {
      message,
      sha,
      branch: this.config.branch,
    };

    try {
      const response = await fetch(url, {
        method: "DELETE",
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          `GitHub API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as { content: GitHubFileResponse };
      return data.content;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to delete file from GitHub: ${error.message}`);
      }
      throw error;
    }
  }
}

/**
 * Create GitHub API instance with environment variables
 * @returns GitHubAPI instance
 * @throws Error if required environment variables are missing
 */
export function createGitHubAPI(): GitHubAPI {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";

  if (!token || !owner || !repo) {
    throw new Error(
      "Missing required GitHub environment variables: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO"
    );
  }

  return new GitHubAPI({ token, owner, repo, branch });
}
