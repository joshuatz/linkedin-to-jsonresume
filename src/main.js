/**
 * @preserve
 * @author Joshua Tzucker
 * @license MIT
 * WARNING: This tool is not affiliated with LinkedIn in any manner. Intended use is to export your own profile data, and you, as the user, are responsible for using it within the terms and services set out by LinkedIn. I am not resonsible for any misuse, or reprecussions of said misuse.
 */

const VCardsJS = require('@dan/vcards');

/**
 * @typedef {import("../jsonresume.schema").ResumeSchema & Partial<import('../jsonresume.schema.beyond').ResumeSchemaBeyondCurrentSpec>} ResumeSchema
 */

// ==Bookmarklet==
// @name linkedin-to-jsonresume-bookmarklet
// @author Joshua Tzucker
// ==/Bookmarklet==

/** @type {ResumeSchema} */
const resumeJsonTemplate = {
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
    projects: []
};

// @ts-ignore
window.LinkedinToResumeJson = (() => {
    // private
    /** @type {{[key: number]: number}} */
    const maxDaysOfMonth = {
        1: 31,
        2: 28,
        3: 31,
        4: 30,
        5: 31,
        6: 30,
        7: 31,
        8: 31,
        9: 30,
        10: 31,
        11: 30,
        12: 31
    };

    /**
     * Checks if value passed is a one digit number
     * @param {Number} v
     */
    const isOneDigit = (v) => Number(v) < 10;

    /**
     * Returns month. If it is only one digit, adds a 0 and returns it as a string.
     * @param {Number} [m] month
     */
    const getMonth = (m) => {
        if (!m) return 12;
        if (isOneDigit(m)) {
            return `0${m}`;
        }
        return m;
    };

    /**
     * Gets day.
     * @param {Number} d day
     * @param {Number} m month
     */
    const getDay = (d, m) => {
        if (!d) {
            if (!m) return 31;
            return maxDaysOfMonth[m];
        }
        if (isOneDigit(d)) {
            return `0${d}`;
        }
        return d;
    };

    /**
     * Parses an object with year, month and day and returns a string with the date.
     * If month is not present, should return 12, and if day is not present, should return last month day.
     * @param {{year: number, month?: number, day?: number}} dateObj
     */
    const parseDate = (dateObj) => (dateObj && dateObj.year ? `${dateObj.year}-${getMonth(dateObj.month)}-${getDay(dateObj.day, dateObj.month)}` : '');

    /**
     * Trigger a file download prompt with given content
     * @see https://davidwalsh.name/javascript-download
     * @param {string} data
     * @param {string} fileName
     * @param {string} [type]
     */
    const promptDownload = (data, fileName, type = 'text/plain') => {
        // Create an invisible A element
        const a = document.createElement('a');
        a.style.display = 'none';
        document.body.appendChild(a);

        // Set the HREF to a Blob representation of the data to be downloaded
        a.href = window.URL.createObjectURL(new Blob([data], { type }));

        // Use download attribute to set set desired file name
        a.setAttribute('download', fileName);

        // Trigger download by simulating click
        a.click();

        // Cleanup
        window.URL.revokeObjectURL(a.href);
        document.body.removeChild(a);
    };

    /** @type {ResumeSchema} */
    let _outputJson = JSON.parse(JSON.stringify(resumeJsonTemplate));
    const _templateJson = resumeJsonTemplate;
    const _liSchemaKeys = {
        profile: '*profile',
        certificates: '*certificationView',
        education: '*educationView',
        workPositions: '*positionView',
        workPositionGroups: '*positionGroupView',
        skills: '*skillView',
        projects: '*projectView',
        attachments: '*summaryTreasuryMedias',
        volunteerWork: '*volunteerExperienceView',
        awards: '*honorView',
        publications: '*publicationView'
    };
    const _voyagerBase = 'https://www.linkedin.com/voyager/api';
    const _voyagerEndpoints = {
        following: '/identity/profiles/{profileId}/following',
        followingCompanies: '/identity/profiles/{profileId}/following?count=10&entityType=COMPANY&q=followedEntities',
        contactInfo: '/identity/profiles/{profileId}/profileContactInfo',
        basicAboutMe: '/me',
        advancedAboutMe: '/identity/profiles/{profileId}',
        fullProfileView: '/identity/profiles/{profileId}/profileView',
        fullSkills: '/identity/profiles/{profileId}/skillCategory',
        recommendations: '/identity/profiles/{profileId}/recommendations',
        dash: {
            profilePositionGroups:
                '/identity/dash/profilePositionGroups?q=viewee&profileUrn=urn:li:fsd_profile:{profileUrnId}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfilePositionGroup-21',
            fullProfile: '/identity/dash/profiles?q=memberIdentity&memberIdentity={profileId}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-53'
        }
    };
    let _scrolledToLoad = false;
    const _toolPrefix = 'jtzLiToResumeJson';
    const _stylesInjected = false;

    /**
     * Get a cookie by name
     * @param {string} name
     */
    function getCookie(name) {
        const v = document.cookie.match(`(^|;) ?${name}=([^;]*)(;|$)`);
        return v ? v[2] : null;
    }

    /**
     * Get URL response as base64
     * @param {string} url - URL to convert
     * @param {boolean} [omitDeclaration] - remove the `data:...` declaration prefix
     * @returns {Promise<{dataStr: string, mimeStr: string}>} base64 results
     */
    async function urlToBase64(url, omitDeclaration = false) {
        const res = await fetch(url);
        const blob = await res.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const declarationPatt = /^data:([^;]+)[^,]+base64,/i;
                let dataStr = /** @type {string} */ (reader.result);
                const mimeStr = dataStr.match(declarationPatt)[1];
                if (omitDeclaration) {
                    dataStr = dataStr.replace(declarationPatt, '');
                }

                resolve({
                    dataStr,
                    mimeStr
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Set multiple query string params by passing an object
     * @param {string} url
     * @param {Record<string, any>} paramPairs
     */
    function setQueryParams(url, paramPairs) {
        const urlInstance = new URL(url);
        /** @type {Record<string, any>} */
        const existingQueryPairs = {};
        urlInstance.searchParams.forEach((val, key) => {
            existingQueryPairs[key] = val;
        });
        urlInstance.search = new URLSearchParams({
            ...existingQueryPairs,
            ...paramPairs
        }).toString();
        return urlInstance.toString();
    }

    /**
     * Replace a value with a default if it is null or undefined
     * @param {any} value
     * @param {any} [optDefaultVal]
     */
    function noNullOrUndef(value, optDefaultVal) {
        const defaultVal = optDefaultVal || '';
        return typeof value === 'undefined' || value === null ? defaultVal : value;
    }

    /**
     * Builds a mini-db out of a LI schema obj
     * @param {LiResponse} schemaJson
     * @returns {InternalDb}
     */
    function buildDbFromLiSchema(schemaJson) {
        /** @type {Partial<InternalDb> & Pick<InternalDb, 'entitiesByUrn' | 'entities'>} */
        const template = {
            /** @type {InternalDb['entitiesByUrn']} */
            entitiesByUrn: {},
            /** @type {InternalDb['entities']} */
            entities: []
        };
        const db = template;
        db.tableOfContents = schemaJson.data;
        for (let x = 0; x < schemaJson.included.length; x++) {
            /** @type {LiEntity & {key: string}} */
            const currRow = {
                key: schemaJson.included[x].entityUrn,
                ...schemaJson.included[x]
            };
            db.entitiesByUrn[currRow.entityUrn] = currRow;
            db.entities.push(currRow);
        }
        delete db.tableOfContents['included'];
        /**
         * Get list of element keys (if applicable)
         *  - Certain LI responses will contain a list of keys that correspond to
         * entities via an URN mapping. I think these are in cases where the response
         * is returning a mix of entities, both directly related to the inquiry and
         * tangentially (e.g. `book` entities and `author` entities, return in the
         * same response). In this case, `elements` are those that directly satisfy
         *  the request, and the other items in `included` are those related
         * @returns {string[]}
         */
        db.getElementKeys = function getElementKeys() {
            /** @type {string[]} */
            const searchKeys = ['*elements', 'elements'];
            for (let x = 0; x < searchKeys.length; x++) {
                const key = searchKeys[x];
                const matchingArr = db.tableOfContents[key];
                if (Array.isArray(matchingArr)) {
                    return matchingArr;
                }
            }
            return [];
        };
        // Same as above (getElementKeys), but returns elements themselves
        db.getElements = function getElements() {
            return db.getElementKeys().map((key) => {
                return db.entitiesByUrn[key];
            });
        };
        /**
         * Get all elements that match type. Should usually just be one
         * @param {string} typeStr - Type, e.g. `$com.linkedin...`
         * @returns {LiEntity[]}
         */
        db.getElementsByType = function getElementByType(typeStr) {
            return db.entities.filter((entity) => entity['$type'] === typeStr);
        };
        /**
         * Get an element by URN
         * @param {string} urn - URN identifier
         * @returns {LiEntity | undefined}
         */
        db.getElementByUrn = function getElementByUrn(urn) {
            return db.entitiesByUrn[urn];
        };
        db.getElementsByUrns = function getElementsByUrns(urns) {
            return urns.map((urn) => db.entitiesByUrn[urn]);
        };
        db.getValueByKey = function getValueByKey(key) {
            return db.entitiesByUrn[db.tableOfContents[key]];
        };
        // This, opposed to getValuesByKey, allow for multi-depth traversal
        db.getValuesByKey = function getValuesByKey(key, optTocValModifier) {
            const values = [];
            let tocVal = this.tableOfContents[key];
            if (typeof optTocValModifier === 'function') {
                tocVal = optTocValModifier(tocVal);
            }
            // tocVal will usually be a single string that is a key to another lookup. In rare cases, it is an array of direct keys
            let matchingDbIndexs = [];
            // Array of direct keys to sub items
            if (Array.isArray(tocVal)) {
                matchingDbIndexs = tocVal;
            }
            // String pointing to sub item
            else if (tocVal) {
                const subToc = this.entitiesByUrn[tocVal];
                // Needs secondary lookup if has elements property with list of keys pointing to other sub items
                if (subToc['*elements'] && Array.isArray(subToc['*elements'])) {
                    matchingDbIndexs = subToc['*elements'];
                }
                // Sometimes they use 'elements' instead of '*elements"...
                else if (subToc['elements'] && Array.isArray(subToc['elements'])) {
                    matchingDbIndexs = subToc['elements'];
                } else {
                    // The object itself should be the return row
                    values.push(subToc);
                }
            }
            for (let x = 0; x < matchingDbIndexs.length; x++) {
                if (typeof this.entitiesByUrn[matchingDbIndexs[x]] !== 'undefined') {
                    values.push(this.entitiesByUrn[matchingDbIndexs[x]]);
                }
            }
            return values;
        };
        // @ts-ignore
        return db;
    }

    /**
     * Gets the profile ID from embedded (or api returned) Li JSON Schema
     * @param {LiResponse} jsonSchema
     * @returns {string} profileId
     */
    function getProfileIdFromLiSchema(jsonSchema) {
        let profileId = '';
        // miniprofile is not usually in the TOC, nor does its entry have an entityUrn for looking up (it has objectUrn), so best solution is just to iterate through all entries checking for match.
        if (jsonSchema.included && Array.isArray(jsonSchema.included)) {
            for (let x = 0; x < jsonSchema.included.length; x++) {
                const currEntity = jsonSchema.included[x];
                // Test for miniProfile match
                if (typeof currEntity['publicIdentifier'] === 'string') {
                    profileId = currEntity.publicIdentifier;
                }
            }
        }
        return profileId.toString();
    }

    /**
     * Retrieve a LI Company Page URL from a company URN
     * @param {string} companyUrn
     */
    function companyLiPageFromCompanyUrn(companyUrn) {
        let companyPageUrl = '';
        if (typeof companyUrn === 'string') {
            const companyIdMatch = /urn.+Company:(\d+)/.exec(companyUrn);
            if (companyIdMatch) {
                companyPageUrl = `https://www.linkedin.com/company/${companyIdMatch[1]}`;
            }
        }
        return companyPageUrl;
    }

    /**
     * Push a new skill to the resume object
     * @param {string} skillName
     */
    function pushSkill(skillName) {
        // Try to prevent duplicate skills
        const skillNames = _outputJson.skills.map((skill) => skill.name);
        if (skillNames.indexOf(skillName) === -1) {
            _outputJson.skills.push({
                name: skillName,
                level: '',
                keywords: []
            });
        }
    }

    /**
     * Since LI entities can store dates in different ways, but
     * JSONResume only stores in one, this utility method will detect
     * which format LI is using, parse it, and attach to Resume object
     * (e.g. work position entry), with correct date format
     *  - NOTE: This modifies object in-place
     * @param {GenObj} resumeObj
     * @param {LiEntity} liEntity
     */
    function parseAndAttachResumeDates(resumeObj, liEntity) {
        // Time period can either come as `timePeriod` or `dateRange` prop
        const timePeriod = liEntity.timePeriod || liEntity.dateRange;
        if (timePeriod) {
            const start = timePeriod.startDate || timePeriod.start;
            const end = timePeriod.endDate || timePeriod.end;
            if (end) {
                // eslint-disable-next-line no-param-reassign
                resumeObj.endDate = parseDate(end);
            }
            if (start) {
                // eslint-disable-next-line no-param-reassign
                resumeObj.startDate = parseDate(start);
            }
        }
    }

    /**
     * Parse a LI education object and push the parsed education entry to Resume
     * @param {LiEntity} educationObj
     * @param {InternalDb} db
     * @param {LinkedinToResumeJson} instance
     */
    function parseAndPushEducation(educationObj, db, instance) {
        const _this = instance;
        const edu = educationObj;
        /** @type {ResumeSchema['education'][0]} */
        const parsedEdu = {
            institution: noNullOrUndef(edu.schoolName),
            area: noNullOrUndef(edu.fieldOfStudy),
            studyType: noNullOrUndef(edu.degreeName),
            startDate: '',
            endDate: '',
            gpa: noNullOrUndef(edu.grade),
            courses: []
        };
        parseAndAttachResumeDates(parsedEdu, edu);
        if (Array.isArray(edu.courses)) {
            // Lookup course names
            edu.courses.forEach((courseKey) => {
                const courseInfo = db.entitiesByUrn[courseKey];
                if (courseInfo) {
                    parsedEdu.courses.push(`${courseInfo.number} - ${courseInfo.name}`);
                } else {
                    _this.debugConsole.warn('could not find course:', courseKey);
                }
            });
        }
        // Push to final json
        _outputJson.education.push(parsedEdu);
    }

    /**
     * Parse a LI position object and push the parsed work entry to Resume
     * @param {LiEntity} positionObj
     */
    function parseAndPushPosition(positionObj) {
        /** @type {ResumeSchema['work'][0]} */
        const parsedWork = {
            name: positionObj.companyName,
            endDate: '',
            highlights: [],
            position: positionObj.title,
            startDate: '',
            summary: positionObj.description,
            url: companyLiPageFromCompanyUrn(positionObj['companyUrn'])
        };
        parseAndAttachResumeDates(parsedWork, positionObj);
        // Lookup company website
        if (positionObj.company && positionObj.company['*miniCompany']) {
            // @TODO - website is not in schema. Use voyager?
            // let companyInfo = db.data[position.company['*miniCompany']];
        }

        // Push to final json
        _outputJson.work.push(parsedWork);
    }

    /**
     * Main parser for giant profile JSON block
     * @param {LinkedinToResumeJson} instance
     * @param {LiResponse} profileObj
     */
    async function parseProfileSchemaJSON(instance, profileObj) {
        const _this = instance;
        let foundGithub = false;
        const foundPortfolio = false;
        /** @type {ParseProfileSchemaResultSummary} */
        const resultSummary = {
            profileObj,
            pageUrl: null,
            parseSuccess: false,
            sections: {
                basics: 'fail',
                attachments: 'fail',
                education: 'fail',
                work: 'fail',
                volunteer: 'fail',
                certificates: 'fail',
                skills: 'fail',
                projects: 'fail',
                awards: 'fail',
                publications: 'fail'
            }
        };
        if (_this.preferLocale) {
            resultSummary.localeStr = _this.preferLocale;
        }
        try {
            // Build db object
            const db = buildDbFromLiSchema(profileObj);

            // Parse basics / profile
            let profileGrabbed = false;
            db.getValuesByKey(_liSchemaKeys.profile).forEach((profile) => {
                // There should only be one
                if (!profileGrabbed) {
                    profileGrabbed = true;
                    _outputJson.basics.name = `${profile.firstName} ${profile.lastName}`;
                    _outputJson.basics.summary = noNullOrUndef(profile.summary);
                    _outputJson.basics.label = noNullOrUndef(profile.headline);
                    if (profile.address) {
                        _outputJson.basics.location.address = noNullOrUndef(profile.address);
                    } else if (profile.locationName) {
                        _outputJson.basics.location.address = noNullOrUndef(profile.locationName);
                    }
                    _outputJson.basics.location.countryCode = profile.defaultLocale.country;
                    _outputJson.languages.push({
                        language: profile.defaultLocale.language,
                        fluency: 'Native Speaker'
                    });
                    resultSummary.sections.basics = 'success';
                }
            });

            // Parse attachments / portfolio links
            const attachments = db.getValuesByKey(_liSchemaKeys.attachments);
            attachments.forEach((attachment) => {
                let captured = false;
                const { url } = attachment.data;
                if (attachment.providerName === 'GitHub' || /github\.com/gim.test(url)) {
                    const usernameMatch = /github\.com\/([^\/\?]+)[^\/]+$/gim.exec(url);
                    if (usernameMatch && !foundGithub) {
                        foundGithub = true;
                        captured = true;
                        _outputJson.basics.profiles.push({
                            network: 'GitHub',
                            username: usernameMatch[1],
                            url
                        });
                    }
                }
                // Since most people put potfolio as first link, guess that it will be
                if (!captured && !foundPortfolio) {
                    captured = true;
                    _outputJson.basics.url = url;
                }
                // Finally, put in projects if not yet categorized
                if (!captured && _this.exportBeyondSpec) {
                    captured = true;
                    _outputJson.projects = _outputJson.projects || [];
                    _outputJson.projects.push({
                        name: attachment.title,
                        startDate: '',
                        endDate: '',
                        description: attachment.description,
                        url
                    });
                }
            });
            resultSummary.sections.attachments = attachments.length ? 'success' : 'empty';

            // Parse education
            let allEducationCanBeCaptured = true;
            // educationView contains both paging data, and list of child elements
            const educationView = db.getValueByKey(_liSchemaKeys.education);
            if (educationView.paging) {
                const { paging } = educationView;
                allEducationCanBeCaptured = paging.start + paging.count >= paging.total;
            }
            if (allEducationCanBeCaptured) {
                const educationEntries = db.getValuesByKey(_liSchemaKeys.education);
                educationEntries.forEach((edu) => {
                    parseAndPushEducation(edu, db, _this);
                });
                _this.debugConsole.log(`All education positions captured directly from profile result.`);
                resultSummary.sections.education = 'success';
            } else {
                _this.debugConsole.warn(`Education positions in profile are truncated.`);
                resultSummary.sections.education = 'incomplete';
            }

            // Parse work
            // First, check paging data
            let allWorkCanBeCaptured = true;
            const positionView = db.getValueByKey(_liSchemaKeys.workPositions);
            if (positionView.paging) {
                const { paging } = positionView;
                allWorkCanBeCaptured = paging.start + paging.count >= paging.total;
            }
            if (allWorkCanBeCaptured) {
                db.getValuesByKey(_liSchemaKeys.workPositions).forEach((position) => {
                    parseAndPushPosition(position);
                });
                _this.debugConsole.log(`All work positions captured directly from profile result.`);
                resultSummary.sections.work = 'success';
            } else {
                _this.debugConsole.warn(`Work positions in profile are truncated.`);
                resultSummary.sections.work = 'incomplete';
            }

            // Parse volunteer experience
            const volunteerEntries = db.getValuesByKey(_liSchemaKeys.volunteerWork);
            volunteerEntries.forEach((volunteering) => {
                /** @type {ResumeSchema['volunteer'][0]} */
                const parsedVolunteerWork = {
                    organization: volunteering.companyName,
                    position: volunteering.role,
                    url: companyLiPageFromCompanyUrn(volunteering['companyUrn']),
                    startDate: '',
                    endDate: '',
                    summary: volunteering.description,
                    highlights: []
                };
                parseAndAttachResumeDates(parsedVolunteerWork, volunteering);

                // Push to final json
                _outputJson.volunteer.push(parsedVolunteerWork);
            });
            resultSummary.sections.volunteer = volunteerEntries.length ? 'success' : 'empty';

            /**
             * Parse certificates
             *  - NOTE: This is not currently supported by the official JSON Resume spec,
             * so this is hidden behind the exportBeyondSpec setting / flag.
             *  - Once JSON Resume adds a certificate section to the offical specs,
             * this should be moved out and made automatic
             * @see https://github.com/jsonresume/resume-schema/pull/340
             */
            if (_this.exportBeyondSpec) {
                _outputJson.certificates = [];
                db.getValuesByKey(_liSchemaKeys.certificates).forEach((cert) => {
                    /** @type {ResumeSchema['certificates'][0]} */
                    const certObj = {
                        title: cert.name,
                        issuer: cert.authority
                    };
                    parseAndAttachResumeDates(certObj, cert);
                    if (typeof cert.url === 'string' && cert.url) {
                        certObj.url = cert.url;
                    }
                    _outputJson.certificates.push(certObj);
                });
                resultSummary.sections.certificates = _outputJson.certificates.length ? 'success' : 'empty';
            }

            // Parse skills
            /** @type {string[]} */
            const skillArr = [];
            db.getValuesByKey(_liSchemaKeys.skills).forEach((skill) => {
                skillArr.push(skill.name);
            });
            document.querySelectorAll('span[class*="skill-category-entity"][class*="name"]').forEach((skillNameElem) => {
                // @ts-ignore
                const skillName = skillNameElem.innerText;
                if (!skillArr.includes(skillName)) {
                    skillArr.push(skillName);
                }
            });
            skillArr.forEach((skillName) => {
                pushSkill(skillName);
            });
            resultSummary.sections.skills = skillArr.length ? 'success' : 'empty';

            // Parse projects
            // Not currently used by Resume JSON
            if (_this.exportBeyondSpec) {
                _outputJson.projects = _outputJson.projects || [];
                db.getValuesByKey(_liSchemaKeys.projects).forEach((project) => {
                    const parsedProject = {
                        name: project.title,
                        startDate: '',
                        summary: project.description,
                        url: project.url
                    };
                    parseAndAttachResumeDates(parsedProject, project);
                    _outputJson.projects.push(parsedProject);
                });
                resultSummary.sections.projects = _outputJson.projects.length ? 'success' : 'empty';
            }

            // Parse awards
            const awardEntries = db.getValuesByKey(_liSchemaKeys.awards);
            awardEntries.forEach((award) => {
                const parsedAward = {
                    title: award.title,
                    date: '',
                    awarder: award.issuer,
                    summary: noNullOrUndef(award.description)
                };
                if (award.issueDate && typeof award.issueDate === 'object') {
                    parsedAward.date = parseDate(award.issueDate);
                }
                _outputJson.awards.push(parsedAward);
            });
            resultSummary.sections.awards = awardEntries.length ? 'success' : 'empty';

            // Parse publications
            const publicationEntries = db.getValuesByKey(_liSchemaKeys.publications);
            publicationEntries.forEach((publication) => {
                const parsedPublication = {
                    name: publication.name,
                    publisher: publication.publisher,
                    releaseDate: '',
                    website: noNullOrUndef(publication.url),
                    summary: noNullOrUndef(publication.description)
                };
                if (publication.date && typeof publication.date === 'object' && typeof publication.date.year !== 'undefined') {
                    parsedPublication.releaseDate = parseDate(publication.date);
                }
                _outputJson.publications.push(parsedPublication);
            });
            resultSummary.sections.publications = publicationEntries.length ? 'success' : 'empty';

            if (_this.debug) {
                console.group(`parseProfileSchemaJSON complete: ${document.location.pathname}`);
                console.log({
                    db,
                    _outputJson,
                    resultSummary
                });
                console.groupEnd();
            }

            _this.parseSuccess = true;
            resultSummary.parseSuccess = true;
            resultSummary.pageUrl = _this.getUrlWithoutQuery();
        } catch (e) {
            if (_this.debug) {
                console.group('Error parsing profile schema');
                console.log(e);
                console.log('Instance');
                console.log(_this);
                console.groupEnd();
            }
            resultSummary.parseSuccess = false;
        }
        return resultSummary;
    }

    /**
     * Constructor
     * @param {boolean} [OPT_exportBeyondSpec] - Should the tool export additioanl details, beyond the official JSONResume specifications?
     * @param {boolean} [OPT_debug] - Debug Mode?
     * @param {boolean} [OPT_preferApi] - Prefer Voyager API, rather than DOM scrape?
     * @param {boolean} [OPT_getFullSkills] - Retrieve full skills (behind additional API endpoint), rather than just basics
     */
    function LinkedinToResumeJson(OPT_exportBeyondSpec, OPT_debug, OPT_preferApi, OPT_getFullSkills) {
        const _this = this;
        this.profileId = this.getProfileId();
        /** @type {string | null} */
        this.profileUrnId = null;
        /** @type {ParseProfileSchemaResultSummary} */
        this.profileParseSummary = null;
        /** @type {string | null} */
        this.lastScannedLocale = null;
        /** @type {string | null} */
        this.preferLocale = null;
        this.scannedPageUrl = '';
        this.parseSuccess = false;
        this.getFullSkills = typeof OPT_getFullSkills === 'boolean' ? OPT_getFullSkills : true;
        this.exportBeyondSpec = typeof OPT_exportBeyondSpec === 'boolean' ? OPT_exportBeyondSpec : false;
        this.preferApi = typeof OPT_preferApi === 'boolean' ? OPT_preferApi : true;
        this.debug = typeof OPT_debug === 'boolean' ? OPT_debug : false;
        if (this.debug) {
            console.warn('LinkedinToResumeJson - DEBUG mode is ON');
            this.buildDbFromLiSchema = buildDbFromLiSchema;
        }
        this.debugConsole = {
            /** @type {(...args: any[]) => void} */
            log: (...args) => {
                if (_this.debug) {
                    console.log.apply(null, args);
                }
            },
            /** @type {(...args: any[]) => void} */
            warn: (...args) => {
                if (_this.debug) {
                    console.warn.apply(null, args);
                }
            },
            /** @type {(...args: any[]) => void} */
            error: (...args) => {
                if (_this.debug) {
                    console.error.apply(null, args);
                }
            }
        };
    }

    // Regular Methods

    LinkedinToResumeJson.prototype.parseEmbeddedLiSchema = async function parseEmbeddedLiSchema() {
        const _this = this;
        let doneWithBlockIterator = false;
        let foundSomeSchema = false;
        const possibleBlocks = document.querySelectorAll('code[id^="bpr-guid-"]');
        for (let x = 0; x < possibleBlocks.length; x++) {
            const currSchemaBlock = possibleBlocks[x];
            // Check if current schema block matches profileView
            if (/educationView/.test(currSchemaBlock.innerHTML) && /positionView/.test(currSchemaBlock.innerHTML)) {
                try {
                    const embeddedJson = JSON.parse(currSchemaBlock.innerHTML);
                    // Due to SPA nature, tag could actually be for profile other than the one currently open
                    const desiredProfileId = _this.getProfileId();
                    const schemaProfileId = getProfileIdFromLiSchema(embeddedJson);
                    if (schemaProfileId === desiredProfileId) {
                        doneWithBlockIterator = true;
                        foundSomeSchema = true;
                        // eslint-disable-next-line no-await-in-loop
                        const profileParserResult = await parseProfileSchemaJSON(_this, embeddedJson);
                        _this.debugConsole.log(`Parse from embedded schema, success = ${profileParserResult.parseSuccess}`);
                        if (profileParserResult.parseSuccess) {
                            this.profileParseSummary = profileParserResult;
                        }
                    } else {
                        _this.debugConsole.log(`Valid schema found, but schema profile id of "${schemaProfileId}" does not match desired profile ID of "${desiredProfileId}".`);
                    }
                } catch (e) {
                    if (_this.debug) {
                        throw e;
                    }
                    _this.debugConsole.warn('Could not parse embedded schema!', e);
                }
            }
            if (doneWithBlockIterator) {
                _this.parseSuccess = true;
                break;
            }
        }
        if (!foundSomeSchema) {
            _this.debugConsole.warn('Failed to find any embedded schema blocks!');
        }
    };

    // This should be called every time
    LinkedinToResumeJson.prototype.parseBasics = function parseBasics() {
        this.profileId = this.getProfileId();
        _outputJson.basics.profiles.push({
            network: 'LinkedIn',
            username: this.profileId,
            url: `https://www.linkedin.com/in/${this.profileId}/`
        });
    };

    LinkedinToResumeJson.prototype.parseViaInternalApiFullProfile = async function parseViaInternalApiFullProfile() {
        try {
            // Get full profile
            const fullProfileView = await this.voyagerFetch(_voyagerEndpoints.fullProfileView);
            if (fullProfileView && typeof fullProfileView.data === 'object') {
                // Try to use the same parser that I use for embedded
                const profileParserResult = await parseProfileSchemaJSON(this, fullProfileView);
                this.debugConsole.log(`Parse full profile via internal API, success = ${profileParserResult.parseSuccess}`);
                if (profileParserResult.parseSuccess) {
                    this.profileParseSummary = profileParserResult;
                }
                // Some sections might require additional fetches to fill missing data
                if (profileParserResult.sections.work === 'incomplete') {
                    _outputJson.work = [];
                    await this.parseViaInternalApiWork();
                }
                if (profileParserResult.sections.education === 'incomplete') {
                    _outputJson.education = [];
                    await this.parseViaInternalApiEducation();
                }
                this.debugConsole.log(_outputJson);
                return true;
            }
        } catch (e) {
            this.debugConsole.warn('Error parsing using internal API (Voyager) - FullProfile', e);
        }
        return false;
    };

    LinkedinToResumeJson.prototype.parseViaInternalApiFullSkills = async function parseViaInternalApiFullSkills() {
        try {
            const fullSkillsInfo = await this.voyagerFetch(_voyagerEndpoints.fullSkills);
            if (fullSkillsInfo && typeof fullSkillsInfo.data === 'object') {
                if (Array.isArray(fullSkillsInfo.included)) {
                    for (let x = 0; x < fullSkillsInfo.included.length; x++) {
                        const skillObj = fullSkillsInfo.included[x];
                        if (typeof skillObj.name === 'string') {
                            pushSkill(skillObj.name);
                        }
                    }
                }
                return true;
            }
        } catch (e) {
            this.debugConsole.warn('Error parsing using internal API (Voyager) - FullSkills', e);
        }
        return false;
    };

    LinkedinToResumeJson.prototype.parseViaInternalApiContactInfo = async function parseViaInternalApiContactInfo() {
        try {
            const contactInfo = await this.voyagerFetch(_voyagerEndpoints.contactInfo);
            if (contactInfo && typeof contactInfo.data === 'object') {
                const { websites, twitterHandles, phoneNumbers, emailAddress } = contactInfo.data;
                _outputJson.basics.location.address = noNullOrUndef(contactInfo.data.address, _outputJson.basics.location.address);
                _outputJson.basics.email = noNullOrUndef(emailAddress, _outputJson.basics.email);
                if (phoneNumbers && phoneNumbers.length) {
                    _outputJson.basics.phone = noNullOrUndef(phoneNumbers[0].number);
                }

                // Scrape Websites
                if (Array.isArray(websites)) {
                    for (let x = 0; x < websites.length; x++) {
                        if (/portfolio/i.test(websites[x].type.category)) {
                            _outputJson.basics.url = websites[x].url;
                        }
                    }
                }

                // Scrape Twitter
                if (Array.isArray(twitterHandles)) {
                    twitterHandles.forEach((handleMeta) => {
                        const handle = handleMeta.name;
                        _outputJson.basics.profiles.push({
                            network: 'Twitter',
                            username: handle,
                            url: `https://twitter.com/${handle}`
                        });
                    });
                }
                return true;
            }
        } catch (e) {
            this.debugConsole.warn('Error parsing using internal API (Voyager) - Contact Info', e);
        }
        return false;
    };

    LinkedinToResumeJson.prototype.parseViaInternalApiBasicAboutMe = async function parseViaInternalApiBasicAboutMe() {
        try {
            const basicAboutMe = await this.voyagerFetch(_voyagerEndpoints.basicAboutMe);
            if (basicAboutMe && typeof basicAboutMe.data === 'object') {
                if (Array.isArray(basicAboutMe.included) && basicAboutMe.included.length > 0) {
                    const data = basicAboutMe.included[0];
                    _outputJson.basics.name = `${data.firstName} ${data.LastName}`;
                    // Note - LI labels this as "occupation", but it is basically the callout that shows up in search results and is in the header of the profile
                    _outputJson.basics.label = data.occupation;
                }
                return true;
            }
        } catch (e) {
            this.debugConsole.warn('Error parsing using internal API (Voyager) - Basic About Me', e);
        }
        return false;
    };

    LinkedinToResumeJson.prototype.parseViaInternalApiAdvancedAboutMe = async function parseViaInternalApiAdvancedAboutMe() {
        try {
            const advancedAboutMe = await this.voyagerFetch(_voyagerEndpoints.advancedAboutMe);
            if (advancedAboutMe && typeof advancedAboutMe.data === 'object') {
                const { data } = advancedAboutMe;
                _outputJson.basics.name = `${data.firstName} ${data.lastName}`;
                _outputJson.basics.label = data.headline;
                _outputJson.basics.summary = data.summary;
                return true;
            }
        } catch (e) {
            this.debugConsole.warn('Error parsing using internal API (Voyager) - AdvancedAboutMe', e);
        }
        return false;
    };

    LinkedinToResumeJson.prototype.parseViaInternalApiRecommendations = async function parseViaInternalApiRecommendations() {
        try {
            const recommendationJson = await this.voyagerFetch(`${_voyagerEndpoints.recommendations}?q=received&recommendationStatuses=List(VISIBLE)`);
            // This endpoint return a LI db
            const db = buildDbFromLiSchema(recommendationJson);
            db.getElementKeys().forEach((key) => {
                const elem = db.entitiesByUrn[key];
                if (elem && 'recommendationText' in elem) {
                    // Need to do a secondary lookup to get the name of the person who gave the recommendation
                    const recommenderElem = db.entitiesByUrn[elem['*recommender']];
                    _outputJson.references.push({
                        name: `${recommenderElem.firstName} ${recommenderElem.lastName}`,
                        reference: elem.recommendationText
                    });
                }
            });
        } catch (e) {
            this.debugConsole.warn('Error parsing using internal API (Voyager) - Recommendations', e);
        }
        return false;
    };

    LinkedinToResumeJson.prototype.parseViaInternalApiWork = async function parseViaInternalApiWork() {
        try {
            const workResponses = await this.voyagerFetchAutoPaginate(_voyagerEndpoints.dash.profilePositionGroups);
            workResponses.forEach((response) => {
                const db = buildDbFromLiSchema(response);
                // profilePositionGroup responses are a little annoying; the direct children don't point directly to position entities
                // Instead, you have to follow path of `profilePositionGroup` -> `*profilePositionInPositionGroup` -> `*elements` -> `Position`
                // You can bypass by looking up by `Position` type, but then original ordering is not preserved
                db.getElements().forEach((positionGroup) => {
                    // This element is how LI groups positions
                    // - E.g. promotions within same company are all grouped
                    // - Instead of storing *elements (positions) directly,
                    // there is a pointer to a "collection" that has to be followed
                    // - This multi-level traversal within the LI response could
                    // probably be refactored into a `db.*` method.
                    const collectionResponse = db.getElementByUrn(positionGroup['*profilePositionInPositionGroup']);
                    if (collectionResponse && Array.isArray(collectionResponse['*elements'])) {
                        db.getElementsByUrns(collectionResponse['*elements']).forEach((position) => {
                            // This is *finally* the "Position" element
                            parseAndPushPosition(position);
                        });
                    }
                });
            });
        } catch (e) {
            this.debugConsole.warn('Error parsing using internal API (Voyager) - Work', e);
        }
    };

    LinkedinToResumeJson.prototype.parseViaInternalApiEducation = async function parseViaInternalApiEducation() {
        try {
            // This is a really annoying lookup - I can't find a separate API endpoint, so I have to use the full-FULL (dash) profile endpoint...
            const fullDashProfileObj = await this.voyagerFetch(_voyagerEndpoints.dash.fullProfile);
            const db = buildDbFromLiSchema(fullDashProfileObj);
            // Response is missing ToC, so just look up by namespace / schema
            const eduEntries = db.getElementsByType('com.linkedin.voyager.dash.identity.profile.Education');
            eduEntries.forEach((edu) => {
                parseAndPushEducation(edu, db, this);
            });
        } catch (e) {
            this.debugConsole.warn('Error parsing using internal API (Voyager) - Education', e);
        }
    };

    LinkedinToResumeJson.prototype.parseViaInternalApi = async function parseViaInternalApi() {
        try {
            let apiSuccessCount = 0;
            let fullProfileEndpointSuccess = false;

            fullProfileEndpointSuccess = await this.parseViaInternalApiFullProfile();
            if (fullProfileEndpointSuccess) {
                apiSuccessCount++;
            }

            // Get full skills, behind voyager endpoint
            if (this.getFullSkills && (await this.parseViaInternalApiFullSkills())) {
                apiSuccessCount++;
            }

            // Always get full contact info, behind voyager endpoint
            if (await this.parseViaInternalApiContactInfo()) {
                apiSuccessCount++;
            }

            // References / recommendations should also come via voyager; DOM is extremely unreliable for this
            if (await this.parseViaInternalApiRecommendations()) {
                apiSuccessCount++;
            }

            // Only continue with other endpoints if full profile API failed
            if (!fullProfileEndpointSuccess) {
                if (await this.parseViaInternalApiBasicAboutMe()) {
                    apiSuccessCount++;
                }
                if (await this.parseViaInternalApiAdvancedAboutMe()) {
                    apiSuccessCount++;
                }
            }

            this.debugConsole.log(_outputJson);
            if (apiSuccessCount > 0) {
                this.parseSuccess = true;
            } else {
                this.debugConsole.error('Using internal API (Voyager) failed completely!');
            }
        } catch (e) {
            this.debugConsole.warn('Error parsing using internal API (Voyager)', e);
        }
    };

    /**
     * Trigger AJAX loading of content by scrolling
     * @param {boolean} [forceReScroll]
     */
    LinkedinToResumeJson.prototype.triggerAjaxLoadByScrolling = async function triggerAjaxLoadByScrolling(forceReScroll = false) {
        _scrolledToLoad = forceReScroll ? false : _scrolledToLoad;
        if (!_scrolledToLoad) {
            // Capture current location
            const startingLocY = window.scrollY;
            // Scroll to bottom
            const scrollToBottom = () => {
                const maxHeight = document.body.scrollHeight;
                window.scrollTo(0, maxHeight);
            };
            scrollToBottom();
            await new Promise((resolve) => {
                setTimeout(() => {
                    scrollToBottom();
                    window.scrollTo(0, startingLocY);
                    _scrolledToLoad = true;
                    resolve();
                }, 400);
            });
        }

        return true;
    };

    /**
     * Force a re-parse / scrape
     * @param {string} [optLocale]
     */
    LinkedinToResumeJson.prototype.forceReParse = async function forceReParse(optLocale) {
        _scrolledToLoad = false;
        this.parseSuccess = false;
        await this.tryParse(optLocale);
    };

    /**
     * See if profile has changed (either URL or otherwise) since last scrape
     * @param {string} [optLocale] preferred locale
     * @returns {boolean} hasProfileChanged
     */
    LinkedinToResumeJson.prototype.getHasChangedSinceLastParse = function getHasChangedSinceLastParse(optLocale) {
        const localeToUse = optLocale || this.preferLocale;
        const localeStayedSame = !localeToUse || optLocale === this.lastScannedLocale;
        const pageUrlChanged = this.scannedPageUrl === this.getUrlWithoutQuery();

        return localeStayedSame && pageUrlChanged;
    };

    /**
     * Get the LI profile response
     * @param {boolean} useCache
     * @param {string} [optLocale] preferred locale
     * @returns {Promise<ParseProfileSchemaResultSummary>} profile object response summary
     */
    LinkedinToResumeJson.prototype.getProfileResponseSummary = async function getProfileResponseSummary(useCache = true, optLocale) {
        const localeToUse = optLocale || this.preferLocale;
        const localeMatchesUser = !localeToUse || optLocale === this.getViewersLocalLang();

        if (this.profileParseSummary && useCache) {
            const { pageUrl, localeStr, parseSuccess } = this.profileParseSummary;
            const urlChanged = pageUrl !== this.getUrlWithoutQuery();
            const langChanged = !!localeToUse && localeToUse !== localeStr;
            if (parseSuccess && !urlChanged && !langChanged) {
                this.debugConsole.log('getProfileResponse - Used Cache');
                return this.profileParseSummary;
            }
        }

        // Embedded schema can't be used for specific locales
        if (this.preferApi === false && localeMatchesUser) {
            await this.triggerAjaxLoadByScrolling(true);
            await this.parseEmbeddedLiSchema();
            if (this.parseSuccess) {
                this.debugConsole.log('getProfileResponse - Used embedded schema. Success.');
                return this.profileParseSummary;
            }
        }

        // Get directly via API
        const fullProfileView = await this.voyagerFetch(_voyagerEndpoints.fullProfileView);
        // Try to use the same parser that I use for embedded
        const profileParserResult = await parseProfileSchemaJSON(this, fullProfileView);
        if (profileParserResult.parseSuccess) {
            this.debugConsole.log('getProfileResponse - Used API. Sucess');
            this.profileParseSummary = profileParserResult;
            return this.profileParseSummary;
        }

        throw new Error('Could not get profile response object');
    };

    /**
     * Try to scrape / get API and parse
     * @param {string} [optLocale]
     */
    LinkedinToResumeJson.prototype.tryParse = async function tryParse(optLocale) {
        const _this = this;
        const localeToUse = optLocale || _this.preferLocale;
        const localeStayedSame = !localeToUse || localeToUse === _this.lastScannedLocale;
        const localeMatchesUser = !localeToUse || localeToUse === _this.getViewersLocalLang();
        _this.preferLocale = localeToUse || null;

        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve) => {
            if (_this.parseSuccess) {
                if (_this.scannedPageUrl === _this.getUrlWithoutQuery() && localeStayedSame) {
                    // No need to reparse!
                    _this.debugConsole.log('Skipped re-parse; page has not changed');
                    resolve(true);
                } else {
                    // Parse already done, but page changed (ajax)
                    _this.debugConsole.warn('Re-parsing for new results; page has changed between scans');
                    await _this.forceReParse(localeToUse);
                    resolve(true);
                }
            } else {
                // Reset output to empty template
                _outputJson = JSON.parse(JSON.stringify(_templateJson));
                // Trigger full load
                await _this.triggerAjaxLoadByScrolling();
                _this.parseBasics();
                // Embedded schema can't be used for specific locales
                if (_this.preferApi === false && localeMatchesUser) {
                    await _this.parseEmbeddedLiSchema();
                    if (!_this.parseSuccess) {
                        await _this.parseViaInternalApi();
                    }
                } else {
                    await _this.parseViaInternalApi();
                    if (!_this.parseSuccess) {
                        await _this.parseEmbeddedLiSchema();
                    }
                }
                _this.scannedPageUrl = _this.getUrlWithoutQuery();
                _this.lastScannedLocale = localeToUse;
                _this.debugConsole.log(_this);
                resolve(true);
            }
        });
    };

    LinkedinToResumeJson.prototype.parseAndDownload = async function parseAndDownload() {
        await this.tryParse();
        const fileName = `${_outputJson.basics.name.replace(/\s/g, '_')}.resume.json`;
        const fileContents = JSON.stringify(_outputJson, null, 2);
        this.debugConsole.log(fileContents);
        promptDownload(fileContents, fileName, 'application/json');
    };

    LinkedinToResumeJson.prototype.parseAndShowOutput = async function parseAndShowOutput() {
        await this.tryParse();
        const parsedExport = {
            raw: _outputJson,
            stringified: JSON.stringify(_outputJson, null, 2)
        };
        console.log(parsedExport);
        if (this.parseSuccess) {
            this.showModal(parsedExport.raw);
        } else {
            alert('Could not extract JSON from current page. Make sure you are on a profile page that you have access to');
        }
    };

    LinkedinToResumeJson.prototype.closeModal = function closeModal() {
        const modalWrapperId = `${_toolPrefix}_modalWrapper`;
        const modalWrapper = document.getElementById(modalWrapperId);
        if (modalWrapper) {
            modalWrapper.style.display = 'none';
        }
    };

    /**
     * Show the output modal with the results
     * @param {{[key: string]: any}} jsonResume - JSON Resume
     */
    LinkedinToResumeJson.prototype.showModal = function showModal(jsonResume) {
        const _this = this;
        const modalWrapperId = `${_toolPrefix}_modalWrapper`;
        let modalWrapper = document.getElementById(modalWrapperId);
        if (modalWrapper) {
            modalWrapper.style.display = 'block';
        } else {
            _this.injectStyles();
            modalWrapper = document.createElement('div');
            modalWrapper.id = modalWrapperId;
            modalWrapper.innerHTML = `<div class="${_toolPrefix}_modal">
                <div class="${_toolPrefix}_topBar">
                    <div class="${_toolPrefix}_titleText">Profile Export:</div>
                    <div class="${_toolPrefix}_closeButton">X</div>
                </div>
                <div class="${_toolPrefix}_modalBody">
                    <textarea id="${_toolPrefix}_exportTextField">Export will appear here...</textarea>
                </div>
            </div>`;
            document.body.appendChild(modalWrapper);
            // Add event listeners
            modalWrapper.addEventListener('click', (evt) => {
                // Check if click was on modal content, or wrapper (outside content, to trigger close)
                // @ts-ignore
                if (evt.target.id === modalWrapperId) {
                    _this.closeModal();
                }
            });
            modalWrapper.querySelector(`.${_toolPrefix}_closeButton`).addEventListener('click', () => {
                _this.closeModal();
            });
            /** @type {HTMLTextAreaElement} */
            const textarea = modalWrapper.querySelector(`#${_toolPrefix}_exportTextField`);
            textarea.addEventListener('click', () => {
                textarea.select();
            });
        }
        // Actually set textarea text
        /** @type {HTMLTextAreaElement} */
        const outputTextArea = modalWrapper.querySelector(`#${_toolPrefix}_exportTextField`);
        outputTextArea.value = JSON.stringify(jsonResume, null, 2);
    };

    LinkedinToResumeJson.prototype.injectStyles = function injectStyles() {
        if (!_stylesInjected) {
            const styleElement = document.createElement('style');
            styleElement.innerText = `#${_toolPrefix}_modalWrapper {
                width: 100%;
                height: 100%;
                position: fixed;
                top: 0;
                left: 0;
                background-color: rgba(0, 0, 0, 0.8);
                z-index: 99999999999999999999999999999999
            }
            .${_toolPrefix}_modal {
                width: 80%;
                margin-top: 10%;
                margin-left: 10%;
                background-color: white;
                padding: 20px;
                border-radius: 13px;
            }
            .${_toolPrefix}_topBar {
                width: 100%;
                position: relative;
            }
            .${_toolPrefix}_titleText {
                text-align: center;
                font-size: x-large;
                width: 100%;
                padding-top: 8px;
            }
            .${_toolPrefix}_closeButton {
                position: absolute;
                top: 0px;
                right: 0px;
                padding: 0px 8px;
                margin: 3px;
                border: 4px double black;
                border-radius: 10px;
                font-size: x-large;
            }
            .${_toolPrefix}_modalBody {
                width: 90%;
                margin-left: 5%;
                margin-top: 20px;
                padding-top: 8px;
            }
            #${_toolPrefix}_exportTextField {
                width: 100%;
                min-height: 300px;
            }`;
            document.body.appendChild(styleElement);
        }
    };

    LinkedinToResumeJson.prototype.getUrlWithoutQuery = function getUrlWithoutQuery() {
        return document.location.origin + document.location.pathname;
    };

    LinkedinToResumeJson.prototype.getJSON = function getJSON() {
        if (this.parseSuccess) {
            return _outputJson;
        }

        return _templateJson;
    };

    /**
     * Get the profile ID / User ID of the user by parsing URL first, then page.
     */
    LinkedinToResumeJson.prototype.getProfileId = function getProfileId() {
        let profileId = '';
        const linkedProfileRegUrl = /linkedin.com\/[^\/]*\/([^\/]+)\/[^\/]*$/im;
        const linkedProfileRegApi = /voyager\/api\/.*\/profiles\/([^\/]+)\/.*/im;
        if (linkedProfileRegUrl.test(document.location.href)) {
            profileId = linkedProfileRegUrl.exec(document.location.href)[1];
        }

        // Fallback to finding in HTML source.
        // Warning: This can get stale between pages, or might return your own ID instead of current profile
        if (!profileId && linkedProfileRegApi.test(document.body.innerHTML)) {
            profileId = linkedProfileRegApi.exec(document.body.innerHTML)[1];
        }

        // In case username contains special characters
        return decodeURI(profileId);
    };

    /**
     * Get the local language identifier of the *viewer* (not profile)
     * @returns {string}
     */
    LinkedinToResumeJson.prototype.getViewersLocalLang = () => {
        const metaTag = document.querySelector('meta[name="i18nDefaultLocale"]');
        /** @type {HTMLSelectElement | null} */
        const selectTag = document.querySelector('select#globalfooter-select_language');
        if (metaTag) {
            return metaTag.getAttribute('content');
        }
        if (selectTag) {
            return selectTag.value;
        }
        // Default to English
        return 'en_US';
    };

    /**
     * Get the locales that the *current* profile (natively) supports (based on `supportedLocales`)
     * @returns {Promise<string[]>}
     */
    LinkedinToResumeJson.prototype.getSupportedLocales = async function getSupportedLocales() {
        /** @type {string[]} */
        let supportedLocales = [];
        const { profileObj } = await this.getProfileResponseSummary();
        const profileDb = buildDbFromLiSchema(profileObj);
        const userDetails = profileDb.getValuesByKey(_liSchemaKeys.profile)[0];
        if (userDetails && Array.isArray(userDetails['supportedLocales'])) {
            supportedLocales = userDetails.supportedLocales.map((locale) => {
                return `${locale.language}_${locale.country}`;
            });
        }
        return supportedLocales;
    };

    /**
     * Get the internal URN ID of the active profile
     *  - Not needed for JSON Resume, but for Voyager calls
     *  - ID is also used as part of other URNs
     * @param {boolean} [allowFetch] If DOM search fails, allow Voyager call to determine profile URN.
     * @returns {Promise<string>} profile URN ID
     */
    LinkedinToResumeJson.prototype.getProfileUrnId = async function getProfileUrnId(allowFetch = true) {
        const profileViewUrnPatt = /urn:li:fs_profileView:(.+)$/i;

        if (this.profileUrnId && this.scannedPageUrl === this.getUrlWithoutQuery()) {
            return this.profileUrnId;
        }

        // Try to use cache
        if (this.profileParseSummary && this.profileParseSummary.parseSuccess) {
            const profileDb = buildDbFromLiSchema(this.profileParseSummary.profileObj);
            this.profileUrnId = profileDb.tableOfContents['entityUrn'].match(profileViewUrnPatt)[1];
            return this.profileUrnId;
        }

        const endpoint = _voyagerEndpoints.fullProfileView;
        // Make a new API call to get ID - be wary of recursive calls
        if (allowFetch && !endpoint.includes(`{profileUrnId}`)) {
            const fullProfileView = await this.voyagerFetch(endpoint);
            const profileDb = buildDbFromLiSchema(fullProfileView);
            this.profileUrnId = profileDb.tableOfContents['entityUrn'].match(profileViewUrnPatt)[1];
            return this.profileUrnId;
        }
        this.debugConsole.warn('Could not scrape profileUrnId from cache, but fetch is disallowed. Might be using a stale ID!');

        // Try to find in DOM, as last resort
        const urnPatt = /miniprofiles\/([A-Za-z0-9-_]+)/g;
        const matches = document.body.innerHTML.match(urnPatt);
        if (matches && matches.length > 1) {
            // eslint-disable-next-line prettier/prettier
            // prettier-ignore
            this.profileUrnId = (urnPatt.exec(matches[matches.length - 1]))[1];
            return this.profileUrnId;
        }

        return this.profileUrnId;
    };

    LinkedinToResumeJson.prototype.getDisplayPhoto = async function getDisplayPhoto() {
        let photoUrl = '';
        /** @type {HTMLImageElement | null} */
        const photoElem = document.querySelector('[class*="profile"] img[class*="profile-photo"]');
        if (photoElem) {
            photoUrl = photoElem.src;
        } else {
            // Get via miniProfile entity in full profile db
            const { profileObj } = await this.getProfileResponseSummary();
            const profileDb = buildDbFromLiSchema(profileObj);
            const fullProfile = profileDb.getValuesByKey(_liSchemaKeys.profile)[0];
            const miniProfile = profileDb.getElementByUrn(fullProfile['*miniProfile']);
            if (miniProfile && !!miniProfile.picture) {
                const pictureMeta = miniProfile.picture;
                // @ts-ignore
                const smallestArtifact = pictureMeta.artifacts.sort((a, b) => a.width - b.width)[0];
                photoUrl = `${pictureMeta.rootUrl}${smallestArtifact.fileIdentifyingUrlPathSegment}`;
            }
        }

        return photoUrl;
    };

    LinkedinToResumeJson.prototype.generateVCard = async function generateVCard() {
        const { profileObj } = await this.getProfileResponseSummary();
        const contactInfoObj = await this.voyagerFetch(_voyagerEndpoints.contactInfo);
        this.exportVCard(profileObj, contactInfoObj);
    };

    /**
     * @param {LiResponse} profileObj
     * @param {LiResponse} contactInfoObj
     */
    LinkedinToResumeJson.prototype.exportVCard = async function exportVCard(profileObj, contactInfoObj) {
        const vCard = VCardsJS();
        const profileDb = buildDbFromLiSchema(profileObj);
        const contactDb = buildDbFromLiSchema(contactInfoObj);
        // Contact info is stored directly in response; no lookup
        const contactInfo = /** @type {LiProfileContactInfoResponse['data']} */ (contactDb.tableOfContents);
        const profile = profileDb.getValuesByKey(_liSchemaKeys.profile)[0];
        vCard.formattedName = `${profile.firstName} ${profile.lastName}`;
        vCard.firstName = profile.firstName;
        vCard.lastName = profile.lastName;
        // Geo
        if ('postalCode' in profile.geoLocation) {
            // @ts-ignore
            vCard.homeAddress.postalCode = profile.geoLocation.postalCode;
        }
        vCard.email = contactInfo.emailAddress;
        if (contactInfo.twitterHandles.length) {
            // @ts-ignore
            vCard.socialUrls['twitter'] = `https://twitter.com/${contactInfo.twitterHandles[0]}`;
        }
        if (contactInfo.phoneNumbers) {
            contactInfo.phoneNumbers.forEach((numberObj) => {
                if (numberObj.type === 'MOBILE') {
                    vCard.cellPhone = numberObj.number;
                } else if (numberObj.type === 'WORK') {
                    vCard.workPhone = numberObj.number;
                } else {
                    vCard.homePhone = numberObj.number;
                }
            });
        }
        if (profile.birthDate && 'day' in profile.birthDate) {
            const birthdayLi = /** @type {LiDate} */ (profile.birthDate);
            vCard.birthday = new Date(birthdayLi.year, birthdayLi.month, birthdayLi.day);
        }
        // Try to get currently employed organization
        const positions = profileDb.getValuesByKey(_liSchemaKeys.workPositions);
        if (positions.length) {
            vCard.organization = positions[0].companyName;
            vCard.title = positions[0].title;
        }
        vCard.workUrl = this.getUrlWithoutQuery();
        vCard.note = profile.headline;
        // Try to get profile picture
        const photoUrl = await this.getDisplayPhoto();
        if (photoUrl) {
            try {
                // Since LI photo URLs are temporary, convert to base64 first
                const photoDataBase64 = await urlToBase64(photoUrl, true);
                // @ts-ignore
                vCard.photo.embedFromString(photoDataBase64.dataStr, photoDataBase64.mimeStr);
            } catch (e) {
                this.debugConsole.error(`Failed to convert LI image to base64`, e);
            }
        }
        const fileName = `${profile.firstName}_${profile.lastName}.vcf`;
        const fileContents = vCard.getFormattedString();
        this.debugConsole.log('vCard generated', fileContents);
        promptDownload(fileContents, fileName, 'text/vcard');
        return vCard;
    };

    /**
     *
     * @param {string} fetchEndpoint
     * @param {Record<string, string | number>} [optHeaders]
     * @param {number} [start]
     * @param {number} [limitPerPage]
     * @param {number} [requestLimit]
     * @param {number} [throttleDelayMs]
     * @returns {Promise<LiResponse[]>} responseArr
     */
    LinkedinToResumeJson.prototype.voyagerFetchAutoPaginate = async function voyagerFetchAutoPaginate(
        fetchEndpoint,
        optHeaders = {},
        start = 0,
        limitPerPage = 20,
        requestLimit = 100,
        throttleDelayMs = 100
    ) {
        /** @type {LiResponse[]} */
        const responseArr = [];
        let url = await this.formatVoyagerUrl(fetchEndpoint);
        let done = false;
        let currIndex = start;
        let requestsMade = 0;
        /** @type {(value?: any) => void} */
        let resolver;
        /** @type {(reason?: any) => void} */
        let rejector;

        /**
         * @param {any} pagingObj
         */
        const handlePagingData = (pagingObj) => {
            if (pagingObj && typeof pagingObj === 'object' && 'total' in pagingObj) {
                currIndex = pagingObj.start + pagingObj.count;
                done = currIndex >= pagingObj.total;
            } else {
                done = true;
            }
        };

        /** @param {LiResponse} liResponse */
        const handleResponse = async (liResponse) => {
            requestsMade++;
            responseArr.push(liResponse);
            handlePagingData(liResponse.data.paging);
            if (!done && requestsMade < requestLimit) {
                await new Promise((res) => {
                    setTimeout(() => {
                        res();
                    }, throttleDelayMs);
                });
                url = setQueryParams(url, {
                    start: currIndex,
                    count: limitPerPage
                });
                try {
                    const response = await this.voyagerFetch(url, optHeaders);
                    // Recurse
                    handleResponse(response);
                } catch (e) {
                    // BAIL
                    done = true;
                    this.debugConsole.warn(`Bailing out of auto-fetch, request failed.`, e);
                }
            } else {
                done = true;
            }

            if (done) {
                if (responseArr.length) {
                    resolver(responseArr);
                } else {
                    rejector(new Error(`Failed to make any requests`));
                }
            }
        };

        // Start off the pagination chain
        this.voyagerFetch(
            setQueryParams(url, {
                start: currIndex,
                count: limitPerPage
            })
        ).then(handleResponse);

        return new Promise((res, rej) => {
            resolver = res;
            rejector = rej;
        });
    };

    /**
     * Simple formatting for Voyager URLs - macro support, etc.
     * @param {string} fetchEndpoint
     * @returns {Promise<string>} formattedUrl
     */
    LinkedinToResumeJson.prototype.formatVoyagerUrl = async function formatVoyagerUrl(fetchEndpoint) {
        // Macro support
        let endpoint = fetchEndpoint;
        if (endpoint.includes('{profileId}')) {
            endpoint = fetchEndpoint.replace(/{profileId}/g, this.getProfileId());
        }
        if (endpoint.includes('{profileUrnId}')) {
            const profileUrnId = await this.getProfileUrnId();
            endpoint = endpoint.replace(/{profileUrnId}/g, profileUrnId);
        }
        if (!endpoint.startsWith('https')) {
            endpoint = _voyagerBase + endpoint;
        }
        return endpoint;
    };

    /**
     * Special - Fetch with authenticated internal API
     * @param {string} fetchEndpoint
     * @param {Record<string, string | number>} [optHeaders]
     * @returns {Promise<LiResponse>}
     */
    LinkedinToResumeJson.prototype.voyagerFetch = async function voyagerFetch(fetchEndpoint, optHeaders = {}) {
        const _this = this;
        const endpoint = await _this.formatVoyagerUrl(fetchEndpoint);
        // Set requested language
        let langHeaders = {};
        if (_this.preferLocale) {
            langHeaders = {
                'x-li-lang': _this.preferLocale
            };
        }
        return new Promise((resolve, reject) => {
            // Get the csrf token - should be stored as a cookie
            const csrfTokenString = getCookie('JSESSIONID').replace(/"/g, '');
            if (csrfTokenString) {
                /** @type {RequestInit} */
                const fetchOptions = {
                    credentials: 'include',
                    headers: {
                        ...langHeaders,
                        ...optHeaders,
                        accept: 'application/vnd.linkedin.normalized+json+2.1',
                        'csrf-token': csrfTokenString,
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-site': 'same-origin'
                    },
                    referrer: document.location.href,
                    body: null,
                    method: 'GET',
                    mode: 'cors'
                };
                _this.debugConsole.log(`Fetching: ${endpoint}`, fetchOptions);
                fetch(endpoint, fetchOptions).then((response) => {
                    if (response.status !== 200) {
                        const errStr = 'Error fetching internal API endpoint';
                        reject(new Error(errStr));
                        console.warn(errStr, response);
                    } else {
                        response.text().then((text) => {
                            try {
                                const parsed = JSON.parse(text);
                                resolve(parsed);
                            } catch (e) {
                                console.warn('Error parsing internal API response', response, e);
                                reject(e);
                            }
                        });
                    }
                });
            } else {
                reject(new Error('Could not find valid LI cookie'));
            }
        });
    };

    return LinkedinToResumeJson;
})();
