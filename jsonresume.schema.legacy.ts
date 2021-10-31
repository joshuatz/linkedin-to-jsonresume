/**
 * @file Generated (and hand-modified) TS definition for JSON Resume Schema
 *  - Locked to v0.0.16, @see https://github.com/joshuatz/linkedin-to-jsonresume/issues/33
 * @see https://github.com/jsonresume/resume-schema/blob/v0.0.16/schema.json
 *  - Permalink of above: https://github.com/jsonresume/resume-schema/blob/a6d1ae5c990e3370de6ca305ef32477b9516391b/schema.json
 */

/**
 * e.g. 2014-06-29
 * Pattern: ^([1-2][0-9]{3}-[0-1][0-9]-[0-3][0-9]|[1-2][0-9]{3}-[0-1][0-9]|[1-2][0-9]{3})$
 */
export type Iso8601 = string;

export interface Award {
    /**
     * e.g. Time Magazine
     */
    awarder?: string;
    /**
     * e.g. 1989-06-12
     */
    date?: Iso8601;
    /**
     * e.g. Received for my work with Quantum Physics
     */
    summary?: string;
    /**
     * e.g. One of the 100 greatest minds of the century
     */
    title?: string;
}

export interface Profile {
    /**
     * e.g. Facebook or Twitter
     */
    network?: string;
    /**
     * e.g. https://twitter.com/TwitterDev
     */
    url?: string;
    /**
     * e.g. TwitterDev
     */
    username?: string;
}

export interface Location {
    /**
     * To add multiple address lines, use \n
     * For example, 1234 Glücklichkeit Straße\nHinterhaus 5. Etage li.
     */
    address?: string;
    city?: string;
    /**
     * code as per ISO-3166-1 ALPHA-2, e.g. US, AU, IN
     */
    countryCode?: string;
    postalCode?: string;
    /**
     * The general region where you live. Can be a US state, or a province, for instance.
     */
    region?: string;
}

export interface Basics {
    /**
     * e.g. thomas@gmail.com
     */
    email?: string;
    /**
     * e.g. Web Developer
     */
    label?: string;
    location?: Location;
    name: string;
    /**
     * Phone numbers are stored as strings so use any format you like, e.g. 712-117-2923
     */
    phone?: string;
    /**
     * URL (as per RFC 3986) to a picture in JPEG or PNG format
     */
    picture?: string;
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
    website?: string;
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
    /**
     * e.g. 2012-06-29
     */
    endDate?: Iso8601;
    /**
     * grade point average, e.g. 3.67/4.0
     */
    gpa?: string;
    /**
     * e.g. Massachusetts Institute of Technology
     */
    institution?: string;
    /**
     * e.g. 2014-06-29
     */
    startDate?: Iso8601;
    /**
     * e.g. Bachelor
     */
    studyType?: string;
}

export interface Interest {
    keywords?: string[];
    /**
     * e.g. Philosophy
     */
    name?: string;
}

export interface Language {
    /**
     * e.g. Fluent, Beginner
     */
    fluency?: string;
    /**
     * e.g. English, Spanish
     */
    language?: string;
}

export interface Publication {
    /**
     * e.g. The World Wide Web
     */
    name?: string;
    /**
     * e.g. IEEE, Computer Magazine
     */
    publisher?: string;
    /**
     * e.g. 1990-08-01
     */
    releaseDate?: Iso8601;
    /**
     * Short summary of publication. e.g. Discussion of the World Wide Web, HTTP, HTML.
     */
    summary?: string;
    /**
     * e.g. http://www.computer.org/csdl/mags/co/1996/10/rx069-abs.html
     */
    website?: string;
}

export interface Reference {
    /**
     * e.g. Timothy Cook
     */
    name?: string;
    /**
     * e.g. Joe blogs was a great employee, who turned up to work at least once a week. He
     * exceeded my expectations when it came to doing nothing.
     */
    reference?: string;
}

export interface Skill {
    /**
     * List some keywords pertaining to this skill
     */
    keywords?: string[];
    /**
     * e.g. Master
     */
    level?: string;
    /**
     * e.g. Web Development
     */
    name?: string;
}

export interface Volunteer {
    /**
     * e.g. 2012-06-29
     */
    endDate?: Iso8601;
    /**
     * Specify multiple accomplishments
     */
    highlights?: string[];
    /**
     * e.g. EFF
     */
    organization?: string;
    /**
     * e.g. Software Engineer
     */
    position?: string;
    /**
     * resume.json uses the ISO 8601 date standard e.g. 2014-06-29
     */
    startDate?: Iso8601;
    /**
     * Give an overview of your responsibilities at the company
     */
    summary?: string;
    /**
     * e.g. https://www.eff.org/
     */
    website?: string;
}

export interface Work {
    /**
     * e.g. Twitter
     */
    company?: string;
    /**
     * e.g. 2012-06-29
     */
    endDate?: Iso8601;
    /**
     * Specify multiple accomplishments
     */
    highlights?: string[];
    /**
     * e.g. Software Engineer
     */
    position?: string;
    /**
     * resume.json uses the ISO 8601 date standard e.g. 2014-06-29
     */
    startDate?: Iso8601;
    /**
     * Give an overview of your responsibilities at the company
     */
    summary?: string;
    /**
     * e.g. https://twitter.com
     */
    website?: string;
}

export interface ResumeSchemaLegacy {
    /**
     * Specify any awards you have received throughout your professional career
     */
    awards?: Award[];
    basics?: Basics;
    education?: Education[];
    interests?: Interest[];
    /**
     * List any other languages you speak
     */
    languages?: Language[];
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
