/**
 * @file Represents the latest version of the schema that I'm willing to support / implement
 * @see https://github.com/joshuatz/linkedin-to-jsonresume/issues/33
 */
import {Iso8601} from './jsonresume.schema.stable';

// https://github.com/jsonresume/resume-schema/pull/340
export interface Certificate {
    /**
     * e.g. Certified Kubernetes Administrator
     */
    title: string;
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

export interface ResumeSchemaBeyondCurrentSpec {
    /**
     * $schema is not in schema itself, and blocked
     * by "additionalProperties": false, but needs to be in
     * output in order for VSCode to provide auto-intellisense
     * @see https://github.com/json-schema/json-schema/issues/220
     * @see https://github.com/DavidAnson/markdownlint/issues/227
     */
    $schema: string;
    // Soon to be added
    certificates: Certificate[];
}