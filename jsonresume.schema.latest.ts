/**
 * @file Represents the current version(s) of the schema
 *   - Currently v1.0.0
 * @see https://github.com/jsonresume/resume-schema/blob/v1.0.0/schema.json
 *  - Permalink of above: https://github.com/jsonresume/resume-schema/blob/8a5b3982f8e5b9f8840398e162a6e0c418d023da/schema.json
 */

// All of these imports are because the spec is the same for the sub-section in both stable and latest (this doc)
import { Iso8601, Award, Location, Profile, Interest, Language, Reference, Skill, ResumeSchemaLegacy } from './jsonresume.schema.legacy.js';

// Re-export
export { Iso8601, Award, Location, Profile, Interest, Language, Reference, Skill };

export interface Certificate {
    /**
     * e.g. Certified Kubernetes Administrator
     */
    name: string;
    /**
     * e.g. 1989-06-12
     */
    date?: Iso8601;
    /**
     * e.g. http://example.com
     */
    url?: string;
    /**
     * e.g. CNCF
     */
    issuer?: string;
}

export interface Basics {
    /**
     * e.g. thomas@gmail.com
     */
    email?: string;
    /**
     * URL (as per RFC 3986) to a image in JPEG or PNG format
     */
    image?: string;
    /**
     * e.g. Web Developer
     */
    label?: string;
    location?: Location;
    name?: string;
    /**
     * Phone numbers are stored as strings so use any format you like, e.g. 712-117-2923
     */
    phone?: string;
    /**
     * Specify any number of social networks that you participate in
     */
    profiles?: Profile[];
    /**
     * Write a short 2-3 sentence biography about yourself
     */
    summary?: string;
    /**
     * URL (as per RFC 3986) to your website, e.g. personal homepage
     */
    url?: string;
}

export interface Education {
    /**
     * e.g. Arts
     */
    area?: string;
    /**
     * List notable courses/subjects
     */
    courses?: string[];
    endDate?: Iso8601;
    /**
     * grade point average, e.g. 3.67/4.0
     */
    score?: string;
    /**
     * e.g. Massachusetts Institute of Technology
     */
    institution?: string;
    startDate?: Iso8601;
    /**
     * e.g. Bachelor
     */
    studyType?: string;
    /**
     * e.g. https://www.mit.edu/
     */
    url?: string;
}

/**
 * The schema version and any other tooling configuration lives here
 */
export interface Meta {
    /**
     * URL (as per RFC 3986) to latest version of this document
     */
    canonical?: string;
    /**
     * Using ISO 8601 with YYYY-MM-DDThh:mm:ss
     */
    lastModified?: string;
    /**
     * A version field which follows semver - e.g. v1.0.0
     */
    version?: string;
}

export interface Project {
    /**
     * Short summary of project. e.g. Collated works of 2017.
     */
    description?: string;
    endDate?: Iso8601;
    /**
     * Specify the relevant company/entity affiliations e.g. 'greenpeace', 'corporationXYZ'
     */
    entity?: string;
    /**
     * Specify multiple features
     */
    highlights?: string[];
    /**
     * Specify special elements involved
     */
    keywords?: string[];
    /**
     * e.g. The World Wide Web
     */
    name?: string;
    /**
     * Specify your role on this project or in company
     */
    roles?: string[];
    startDate?: Iso8601;
    /**
     * e.g. 'volunteering', 'presentation', 'talk', 'application', 'conference'
     */
    type?: string;
    /**
     * e.g. http://www.computer.org/csdl/mags/co/1996/10/rx069-abs.html
     */
    url?: string;
}

export type Publication = Omit<ResumeSchemaLegacy['publications'][0], 'website'> & {
    /**
     * e.g. http://www.computer.org.example.com/csdl/mags/co/1996/10/rx069-abs.html
     */
    url?: string;
};

export type Volunteer = Omit<ResumeSchemaLegacy['volunteer'][0], 'website'> & {
    /**
     * e.g. https://www.eff.org/
     */
    url?: string;
};

export interface Work {
    /**
     * e.g. Social Media Company
     */
    description?: string;
    endDate?: Iso8601;
    /**
     * Specify multiple accomplishments
     */
    highlights?: string[];
    /**
     * e.g. San Francisco, CA
     */
    location?: string;
    /**
     * e.g. Twitter
     */
    name?: string;
    /**
     * e.g. Software Engineer
     */
    position?: string;
    startDate?: Iso8601;
    /**
     * Give an overview of your responsibilities at the company
     */
    summary?: string;
    /**
     * e.g. https://twitter.com
     */
    url?: string;
}

export interface ResumeSchemaStable {
    /**
     * link to the version of the schema that can validate the resume
     */
    $schema?: string;
    /**
     * Specify any awards you have received throughout your professional career
     */
    awards?: Award[];
    basics?: Basics;
    certificates: Certificate[];
    education?: Education[];
    interests?: Interest[];
    /**
     * List any other languages you speak
     */
    languages?: Language[];
    /**
     * The schema version and any other tooling configuration lives here
     */
    meta?: Meta;
    /**
     * Specify career projects
     */
    projects?: Project[];
    /**
     * Specify your publications through your career
     */
    publications?: Publication[];
    /**
     * List references you have received
     */
    references?: Reference[];
    /**
     * List out your professional skill-set
     */
    skills?: Skill[];
    volunteer?: Volunteer[];
    work?: Work[];
}

/**
 * Currently even - nothing beyond v1
 */
export interface ResumeSchemaBeyondSpec extends ResumeSchemaStable {}
