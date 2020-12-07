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
    $schema: 'https://json.schemastore.org/resume',
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
    publications: [],
    skills: [],
    languages: [],
    interests: [],
    references: [],
    projects: [],
    meta: {
        version: 'v0.1.3',
        canonical: 'https://github.com/jsonresume/resume-schema/blob/v0.1.3/schema.json'
    }
};

/**
 * Beta can be combined with latest, so this is a partial (diff)
 * @type {Partial<ResumeSchemaBeyondSpec>}
 */
export const resumeJsonTemplateBetaPartial = {
    certificates: []
};
