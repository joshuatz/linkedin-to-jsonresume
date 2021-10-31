/** @type {Required<ResumeSchemaStable>} */
export const resumeJsonTemplateStable = {
    basics: {
        name: '',
        label: '',
        picture: '',
        email: '',
        phone: '',
        website: '',
        summary: '',
        location: {
            address: '',
            postalCode: '',
            city: '',
            countryCode: '',
            region: ''
        },
        profiles: []
    },
    work: [],
    volunteer: [],
    education: [],
    awards: [],
    publications: [],
    skills: [],
    languages: [],
    interests: [],
    references: []
};

/** @type {Required<ResumeSchemaLatest>} */
export const resumeJsonTemplateLatest = {
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: {
        name: '',
        label: '',
        image: '',
        email: '',
        phone: '',
        url: '',
        summary: '',
        location: {
            address: '',
            postalCode: '',
            city: '',
            countryCode: '',
            region: ''
        },
        profiles: []
    },
    work: [],
    volunteer: [],
    education: [],
    awards: [],
    certificates: [],
    publications: [],
    skills: [],
    languages: [],
    interests: [],
    references: [],
    projects: [],
    meta: {
        version: 'v1.0.0',
        canonical: 'https://github.com/jsonresume/resume-schema/blob/v1.0.0/schema.json'
    }
};

/**
 * Beta can be combined with latest, so this is a partial (diff)
 * @type {Partial<ResumeSchemaBeyondSpec>}
 */
export const resumeJsonTemplateBetaPartial = {
    certificates: []
};
