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

interface GitHubGitRefResponse {
  object: {
    sha: string;
  };
}

interface GitHubGitCommitResponse {
  sha: string;
  tree: {
    sha: string;
  };
}

interface GitHubGitBlobResponse {
  sha: string;
}

interface GitHubGitTreeResponse {
  sha: string;
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
  private resolvedFilePaths: Map<string, string> = new Map();

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
  private buildUrl(filePath: string, withRef = false): string {
    const cleanPath = filePath.startsWith("/") ? filePath.slice(1) : filePath;
    const baseUrl = `${GITHUB_API_BASE}/repos/${this.config.owner}/${this.config.repo}/contents/${cleanPath}`;
    if (!withRef) {
      return baseUrl;
    }
    return `${baseUrl}?ref=${encodeURIComponent(this.config.branch)}`;
  }

  private buildRepositoryUrl(path: string): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${GITHUB_API_BASE}/repos/${this.config.owner}/${this.config.repo}${normalizedPath}`;
  }

  private normalizePath(filePath: string): string {
    return filePath.startsWith("/") ? filePath.slice(1) : filePath;
  }

  private getPathCandidates(filePath: string): string[] {
    const normalized = this.normalizePath(filePath);
    const candidates: string[] = [];
    const pushCandidate = (candidate: string) => {
      if (!candidate) return;
      if (!candidates.includes(candidate)) {
        candidates.push(candidate);
      }
    };

    const cachedResolved = this.resolvedFilePaths.get(normalized);
    if (cachedResolved) {
      pushCandidate(cachedResolved);
    }

    pushCandidate(normalized);

    if (normalized.startsWith("src/")) {
      pushCandidate(normalized.slice(4));
    } else {
      pushCandidate(`src/${normalized}`);
    }

    return candidates;
  }

  private rememberResolvedPath(sourcePath: string, resolvedPath: string): void {
    const normalizedSource = this.normalizePath(sourcePath);
    const normalizedResolved = this.normalizePath(resolvedPath);
    this.resolvedFilePaths.set(normalizedSource, normalizedResolved);
  }

  private resolvePathForWrite(filePath: string): string {
    const normalized = this.normalizePath(filePath);
    return this.resolvedFilePaths.get(normalized) || normalized;
  }

  /**
   * Fetch file from GitHub repository
   * @param filePath - Path to file in repository
   * @returns File data from GitHub
   * @throws Error if file not found or request fails
   */
  async getFile(filePath: string): Promise<GitHubFileResponse> {
    try {
      const candidates = this.getPathCandidates(filePath);

      for (const candidatePath of candidates) {
        const response = await fetch(this.buildUrl(candidatePath, true), {
          headers: this.getHeaders(),
          cache: "no-store",
        });

        if (response.ok) {
          const data = (await response.json()) as GitHubFileResponse;
          this.rememberResolvedPath(filePath, candidatePath);
          if (data.path) {
            this.rememberResolvedPath(filePath, data.path);
          }
          return data;
        }

        if (response.status !== 404) {
          throw new Error(
            `GitHub API error: ${response.status} ${response.statusText}`
          );
        }
      }

      throw new Error(`File not found: ${filePath}`);
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
    const resolvedPath = this.resolvePathForWrite(filePath);
    const url = this.buildUrl(resolvedPath);

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
      if (data.content.path) {
        this.rememberResolvedPath(filePath, data.content.path);
      } else {
        this.rememberResolvedPath(filePath, resolvedPath);
      }
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
    const resolvedPath = this.resolvePathForWrite(filePath);
    const url = this.buildUrl(resolvedPath);

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
      this.rememberResolvedPath(filePath, resolvedPath);
      return data.content;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to delete file from GitHub: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Create or update multiple files in a single commit
   * @param updates - Files to update
   * @param message - Commit message
   * @returns Commit and file details
   */
  async putFilesBatch(
    updates: Array<{
      filePath: string;
      content?: string;
      contentEncoding?: "utf-8" | "base64";
      action?: "upsert" | "delete";
    }>,
    message: string
  ): Promise<{ commitSha: string; files: string[] }> {
    if (!updates.length) {
      throw new Error("No file updates were provided");
    }

    const refUrl = this.buildRepositoryUrl(
      `/git/ref/heads/${encodeURIComponent(this.config.branch)}`
    );

    const refResponse = await fetch(refUrl, {
      headers: this.getHeaders(),
      cache: "no-store",
    });
    if (!refResponse.ok) {
      throw new Error(
        `GitHub API error: ${refResponse.status} ${refResponse.statusText}`
      );
    }
    const refData = (await refResponse.json()) as GitHubGitRefResponse;
    const parentCommitSha = refData.object.sha;

    const commitUrl = this.buildRepositoryUrl(`/git/commits/${parentCommitSha}`);
    const commitResponse = await fetch(commitUrl, {
      headers: this.getHeaders(),
      cache: "no-store",
    });
    if (!commitResponse.ok) {
      throw new Error(
        `GitHub API error: ${commitResponse.status} ${commitResponse.statusText}`
      );
    }
    const commitData = (await commitResponse.json()) as GitHubGitCommitResponse;
    const baseTreeSha = commitData.tree.sha;

    const treeEntries: Array<{
      path: string;
      mode: "100644";
      type: "blob";
      sha: string | null;
    }> = [];
    const resolvedPaths: string[] = [];

    for (const update of updates) {
      const action = update.action || "upsert";
      let resolvedPath = this.resolvePathForWrite(update.filePath);

      try {
        const existingFile = await this.getFile(update.filePath);
        resolvedPath = existingFile.path || resolvedPath;
      } catch (error) {
        if (
          action === "delete" &&
          error instanceof Error &&
          error.message.includes("File not found")
        ) {
          continue;
        }
      }

      if (action === "delete") {
        treeEntries.push({
          path: resolvedPath,
          mode: "100644",
          type: "blob",
          sha: null,
        });
        resolvedPaths.push(resolvedPath);
        this.rememberResolvedPath(update.filePath, resolvedPath);
        continue;
      }

      if (typeof update.content !== "string") {
        throw new Error(`Missing content for update file: ${update.filePath}`);
      }

      const blobUrl = this.buildRepositoryUrl("/git/blobs");
      const blobResponse = await fetch(blobUrl, {
        method: "POST",
        headers: this.getHeaders(),
        cache: "no-store",
        body: JSON.stringify({
          content: update.content,
          encoding: update.contentEncoding || "utf-8",
        }),
      });
      if (!blobResponse.ok) {
        throw new Error(
          `GitHub API error: ${blobResponse.status} ${blobResponse.statusText}`
        );
      }
      const blobData = (await blobResponse.json()) as GitHubGitBlobResponse;

      treeEntries.push({
        path: resolvedPath,
        mode: "100644",
        type: "blob",
        sha: blobData.sha,
      });
      resolvedPaths.push(resolvedPath);
      this.rememberResolvedPath(update.filePath, resolvedPath);
    }

    if (treeEntries.length === 0) {
      throw new Error("No valid file changes were detected for batch commit");
    }

    const treeUrl = this.buildRepositoryUrl("/git/trees");
    const treeResponse = await fetch(treeUrl, {
      method: "POST",
      headers: this.getHeaders(),
      cache: "no-store",
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeEntries,
      }),
    });
    if (!treeResponse.ok) {
      throw new Error(
        `GitHub API error: ${treeResponse.status} ${treeResponse.statusText}`
      );
    }
    const treeData = (await treeResponse.json()) as GitHubGitTreeResponse;

    const newCommitUrl = this.buildRepositoryUrl("/git/commits");
    const newCommitResponse = await fetch(newCommitUrl, {
      method: "POST",
      headers: this.getHeaders(),
      cache: "no-store",
      body: JSON.stringify({
        message,
        tree: treeData.sha,
        parents: [parentCommitSha],
      }),
    });
    if (!newCommitResponse.ok) {
      throw new Error(
        `GitHub API error: ${newCommitResponse.status} ${newCommitResponse.statusText}`
      );
    }
    const newCommitData = (await newCommitResponse.json()) as GitHubGitCommitResponse;

    const updateRefUrl = this.buildRepositoryUrl(
      `/git/refs/heads/${encodeURIComponent(this.config.branch)}`
    );
    const updateRefResponse = await fetch(updateRefUrl, {
      method: "PATCH",
      headers: this.getHeaders(),
      cache: "no-store",
      body: JSON.stringify({
        sha: newCommitData.sha,
        force: false,
      }),
    });
    if (!updateRefResponse.ok) {
      throw new Error(
        `GitHub API error: ${updateRefResponse.status} ${updateRefResponse.statusText}`
      );
    }

    return {
      commitSha: newCommitData.sha,
      files: resolvedPaths,
    };
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
