

// https://github.com/jsonresume/resume-schema/pull/340
export interface Certificate {
    /**
     * e.g. Certified Kubernetes Administrator
     */
    title: string;
    /**
     * e.g. 1989-06-12
     */
    date?: string;
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
    certificates: Certificate[];
}