/**
 * Type definitions for projects and services data
 */

/**
 * Service in a project
 */
export interface ProjectService {
  /** Service ID reference */
  id: string;
  /** Service title */
  title?: string;
}

/**
 * Project portfolio item
 */
export interface Project {
  /** Unique project identifier */
  id: string;
  /** Project title */
  title: string;
  /** Short project description */
  description: string;
  /** Project location */
  location: string;
  /** Project category (e.g., 'Residential', 'Commercial') */
  category: string;
  /** Primary project image path */
  image: string;
  /** Array of project image paths */
  images: string[];
  /** Project completion date or year */
  completedDate: string;
  /** Display order in the portfolio */
  sortOrder: number;
  /** Whether this project is visible/enabled */
  enabled: boolean;
  /** Whether gallery popup should be shown for this project */
  showGallery?: boolean;
}

/**
 * Service feature item
 */
export interface ServiceFeature {
  /** Feature title */
  title: string;
  /** Feature description */
  description?: string;
}

/**
 * Service offering
 */
export interface Service {
  /** Unique service identifier */
  id: string;
  /** Service title */
  title: string;
  /** Short service description for listing */
  shortDescription: string;
  /** Full detailed description */
  description: string;
  /** Icon name (for lucide-react) */
  icon: string;
  /** Service image path */
  image: string;
  /** Array of service features */
  features: (ServiceFeature | string)[];
  /** Gallery image paths for this service */
  gallery: string[];
  /** Display order in the services list */
  sortOrder: number;
  /** Whether this service is visible/enabled */
  enabled: boolean;
}

/**
 * Translation strings for a single language
 */
export interface LanguageTranslations {
  /** Navigation labels */
  nav: Record<string, string>;
  /** Hero section translations */
  hero: Record<string, string>;
  /** Services section translations */
  services: Record<string, string>;
  /** Projects section translations */
  projects: Record<string, string>;
  /** Contact section translations */
  contact: Record<string, string>;
  /** Footer translations */
  footer: Record<string, string>;
  /** Common/global translations */
  common: Record<string, string>;
  /** Additional custom sections */
  [key: string]: Record<string, string>;
}

/**
 * All translations indexed by language code
 */
export interface Translations {
  /** Translations indexed by language code (e.g., 'en', 'fr') */
  [languageCode: string]: LanguageTranslations;
}
