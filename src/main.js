/**
 * @preserve
 * @author Joshua Tzucker
 * @license MIT
 * WARNING: This tool is not affiliated with LinkedIn in any manner. Intended use is to export your own profile data, and you, as the user, are responsible for using it within the terms and services set out by LinkedIn. I am not resonsible for any misuse, or reprecussions of said misuse.
 */

const VCardsJS = require('@dan/vcards');
const { resumeJsonTemplateLatest, resumeJsonTemplateStable, resumeJsonTemplateBetaPartial } = require('./templates');

// ==Bookmarklet==
// @name linkedin-to-jsonresume-bookmarklet
// @author Joshua Tzucker
// ==/Bookmarklet==

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
     * If less than 10, zero pad left
     * @param {number} n - Numerical input
     * @returns {string} Left padded, stringified num
     */
    const zeroLeftPad = (n) => {
        if (n < 10) {
            return `0${n}`;
        }

        return n.toString();
    };

    /**
     * Returns month, padded to two digits
     * @param {Number} [m] month
     * @returns {string} month, padded to two digits
     */
    const getMonth = (m) => {
        if (!m) return `12`;

        return zeroLeftPad(m);
    };

    /**
     * Gets day, padded to two digits
     * @param {Number} d day
     * @param {Number} m month
     * @returns {string} day, padded to two digits
     */
    const getDay = (d, m) => {
        if (!d) {
            if (!m) return `31`;
            return maxDaysOfMonth[m].toString();
        }

        return zeroLeftPad(d);
    };

    /**
     * Parses an object with year, month and day and returns a string with the date.
     * If month is not present, should return 12, and if day is not present, should return last month day.
     * @param {LiDate} dateObj
     * @returns {string} Date, as string, formatted for JSONResume
     */
    const parseDate = (dateObj) => (dateObj && dateObj.year ? `${dateObj.year}-${getMonth(dateObj.month)}-${getDay(dateObj.day, dateObj.month)}` : '');

    /**
     * Converts a LI Voyager style date object into a native JS Date object
     * @param {LiDate} liDateObj
     * @returns {Date} date object
     */
    const liDateToJSDate = (liDateObj) => {
        // This is a cheat; by passing string + 00:00, we can force Date to not offset (by timezone), and also treat month as NOT zero-indexed, which is how LI uses it
        return new Date(`${parseDate(liDateObj)} 00:00`);
    };

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

    /** @type {ResumeSchemaStable} */
    let _outputJsonStable = JSON.parse(JSON.stringify(resumeJsonTemplateStable));
    /** @type {ResumeSchemaLatest} */
    let _outputJsonLatest = JSON.parse(JSON.stringify(resumeJsonTemplateLatest));
    /** @type {ResumeSchemaBeyondSpec} */
    let _outputJsonBetaPartial = JSON.parse(JSON.stringify(resumeJsonTemplateBetaPartial));
    /** @type {string[]} */
    let _supportedLocales = [];
    /** @type {string} */
    let _defaultLocale = `en_US`;
    /**
     * Lookup keys for the standard profileView object
     */
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
    /**
     * Try to maintain a mapping between generic section types, and LI's schema
     *  - tocKeys are pointers that often point to a collection of URNs
     *  - Try to put dash strings last, profileView first
     *  - Most recipes are dash only
     */
    const _liTypeMappings = {
        profile: {
            // There is no tocKey for profile in dash FullProfileWithEntries,
            // due to how entry-point is configured
            tocKeys: ['*profile'],
            types: [
                // regular profileView
                'com.linkedin.voyager.identity.profile.Profile',
                // dash FullProfile
                'com.linkedin.voyager.dash.identity.profile.Profile'
            ],
            recipes: ['com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities']
        },
        certificates: {
            tocKeys: ['*certificationView', '*profileCertifications'],
            types: ['com.linkedin.voyager.dash.identity.profile.Certification'],
            recipes: ['com.linkedin.voyager.dash.deco.identity.profile.FullProfileCertification']
        },
        education: {
            tocKeys: ['*educationView', '*profileEducations'],
            types: [
                'com.linkedin.voyager.identity.profile.Education',
                // Dash
                'com.linkedin.voyager.dash.identity.profile.Education'
            ],
            recipes: ['com.linkedin.voyager.dash.deco.identity.profile.FullProfileEducation']
        },
        // Individual work entries (not aggregate (workgroup) with date range)
        workPositions: {
            tocKeys: ['*positionView', '*profilePositionGroups'],
            types: ['com.linkedin.voyager.identity.profile.Position', 'com.linkedin.voyager.dash.identity.profile.Position'],
            recipes: ['com.linkedin.voyager.dash.deco.identity.profile.FullProfilePosition']
        },
        skills: {
            tocKeys: ['*skillView', '*profileSkills'],
            types: ['com.linkedin.voyager.identity.profile.Skill', 'com.linkedin.voyager.dash.identity.profile.Skill'],
            recipes: ['com.linkedin.voyager.dash.deco.identity.profile.FullProfileSkill']
        },
        projects: {
            tocKeys: ['*projectView', '*profileProjects'],
            types: ['com.linkedin.voyager.identity.profile.Project', 'com.linkedin.voyager.dash.identity.profile.Project'],
            recipes: ['com.linkedin.voyager.dash.deco.identity.profile.FullProfileProject']
        },
        attachments: {
            tocKeys: ['*summaryTreasuryMedias', '*profileTreasuryMediaPosition'],
            types: ['com.linkedin.voyager.identity.profile.Certification', 'com.linkedin.voyager.dash.identity.profile.treasury.TreasuryMedia'],
            recipes: ['com.linkedin.voyager.dash.deco.identity.profile.FullProfileTreasuryMedia']
        },
        volunteerWork: {
            tocKeys: ['*volunteerExperienceView', '*profileVolunteerExperiences'],
            types: ['com.linkedin.voyager.dash.identity.profile.VolunteerExperience'],
            recipes: ['com.linkedin.voyager.dash.deco.identity.profile.FullProfileVolunteerExperience']
        },
        awards: {
            tocKeys: ['*honorView', '*profileHonors'],
            types: ['com.linkedin.voyager.identity.profile.Honor', 'com.linkedin.voyager.dash.identity.profile.Honor'],
            recipes: ['com.linkedin.voyager.dash.deco.identity.profile.FullProfileHonor']
        },
        publications: {
            tocKeys: ['*publicationView', '*profilePublications'],
            types: ['com.linkedin.voyager.identity.profile.Publication', 'com.linkedin.voyager.dash.identity.profile.Publication'],
            recipes: ['com.linkedin.voyager.dash.deco.identity.profile.FullProfilePublication']
        }
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
     * Copy with `json.parse(json.stringify())`
     * @template T
     * @param {T & Record<string, any>} inputObj
     * @param {Array<keyof T>} [removeKeys] properties (top-level only) to remove
     * @returns {T}
     */
    function lazyCopy(inputObj, removeKeys = []) {
        const copied = JSON.parse(JSON.stringify(inputObj));
        removeKeys.forEach((k) => delete copied[k]);
        return copied;
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
         * @param {string | string[]} typeStr - Type, e.g. `$com.linkedin...`
         * @returns {LiEntity[]}
         */
        db.getElementsByType = function getElementByType(typeStr) {
            const typeStrArr = Array.isArray(typeStr) ? typeStr : [typeStr];
            return db.entities.filter((entity) => typeStrArr.indexOf(entity['$type']) !== -1);
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
        // Only meant for 1:1 lookups; will return first match, if more than one
        // key provided. Usually returns a "view" (kind of a collection)
        db.getValueByKey = function getValueByKey(key) {
            const keyArr = Array.isArray(key) ? key : [key];
            for (let x = 0; x < keyArr.length; x++) {
                const foundVal = db.entitiesByUrn[db.tableOfContents[keyArr[x]]];
                if (foundVal) {
                    return foundVal;
                }
            }
            return undefined;
        };
        // This, opposed to getValuesByKey, allow for multi-depth traversal
        /**
         * @type {InternalDb['getValuesByKey']}
         */
        db.getValuesByKey = function getValuesByKey(key, optTocValModifier) {
            const values = [];
            if (Array.isArray(key)) {
                return [].concat(
                    ...key.map((k) => {
                        return this.getValuesByKey(k, optTocValModifier);
                    })
                );
            }
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
     * "Remaps" data that is nested under a multilingual wrapper, hoisting it
     * back up to top-level keys (overwriting existing values).
     *
     * WARNING: Modifies object IN PLACE
     * @example
     * ```js
     * const input = {
     *     firstName: 'Алексе́й',
     *     multiLocaleFirstName: {
     *         ru_RU: 'Алексе́й',
     *         en_US: 'Alexey'
     *     }
     * }
     * console.log(remapNestedLocale(input, 'en_US').firstName);
     * // 'Alexey'
     * ```
     * @param {LiEntity | LiEntity[]} liObject The LI response object(s) to remap
     * @param {string} desiredLocale Desired Locale string (LI format / ISO-3166-1). Defaults to instance property
     * @param {boolean} [deep] Run remapper recursively, replacing at all applicable levels
     */
    function remapNestedLocale(liObject, desiredLocale, deep = true) {
        if (Array.isArray(liObject)) {
            liObject.forEach((o) => {
                remapNestedLocale(o, desiredLocale, deep);
            });
        } else {
            Object.keys(liObject).forEach((prop) => {
                const nestedVal = liObject[prop];
                if (!!nestedVal && typeof nestedVal === 'object') {
                    // Test for locale wrapped property
                    // example: `multiLocaleFirstName`
                    if (prop.startsWith('multiLocale')) {
                        /** @type {Record<string, any>} */
                        const localeMap = nestedVal;
                        // eslint-disable-next-line no-prototype-builtins
                        if (localeMap.hasOwnProperty(desiredLocale)) {
                            // Transform multiLocaleFirstName to firstName
                            const nonPrefixedKeyPascalCase = prop.replace(/multiLocale/i, '');
                            const nonPrefixedKeyLowerCamelCase = nonPrefixedKeyPascalCase.charAt(0).toLocaleLowerCase() + nonPrefixedKeyPascalCase.substring(1);
                            // Remap nested value to top level
                            liObject[nonPrefixedKeyLowerCamelCase] = localeMap[desiredLocale];
                        }
                    } else if (deep) {
                        remapNestedLocale(liObject[prop], desiredLocale, deep);
                    }
                }
            });
        }
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
        // Both stable and latest use same spec
        const skillNames = _outputJsonStable.skills.map((skill) => skill.name);
        if (skillNames.indexOf(skillName) === -1) {
            /** @type {ResumeSchemaStable['skills'][0]} */
            const formattedSkill = {
                name: skillName,
                level: '',
                keywords: []
            };
            _outputJsonStable.skills.push(formattedSkill);
            _outputJsonLatest.skills.push(formattedSkill);
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
                resumeObj.endDate = parseDate(end);
            }
            if (start) {
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
        /** @type {ResumeSchemaStable['education'][0]} */
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
        _outputJsonStable.education.push(parsedEdu);
        // Currently, same schema can be re-used; only difference is URL, which I'm not including
        _outputJsonLatest.education.push(parsedEdu);
    }

    /**
     * Parse a LI position object and push the parsed work entry to Resume
     * @param {LiEntity} positionObj
     */
    function parseAndPushPosition(positionObj) {
        /** @type {ResumeSchemaStable['work'][0]} */
        const parsedWork = {
            company: positionObj.companyName,
            endDate: '',
            highlights: [],
            position: positionObj.title,
            startDate: '',
            summary: positionObj.description,
            website: companyLiPageFromCompanyUrn(positionObj['companyUrn'])
        };
        parseAndAttachResumeDates(parsedWork, positionObj);
        // Lookup company website
        if (positionObj.company && positionObj.company['*miniCompany']) {
            // @TODO - website is not in schema. Use voyager?
            // let companyInfo = db.data[position.company['*miniCompany']];
        }

        // Push to final json
        _outputJsonStable.work.push(parsedWork);
        _outputJsonLatest.work.push({
            name: parsedWork.company,
            // This is description of company, not position
            // description: '',
            startDate: parsedWork.startDate,
            endDate: parsedWork.endDate,
            highlights: parsedWork.highlights,
            summary: parsedWork.summary,
            url: parsedWork.website
        });
    }

    /**
     * Main parser for giant profile JSON block
     * @param {LinkedinToResumeJson} instance
     * @param {LiResponse} liResponse
     * @param {ParseProfileSchemaResultSummary['profileSrc']} [endpoint]
     * @returns {Promise<ParseProfileSchemaResultSummary>}
     */
    async function parseProfileSchemaJSON(instance, liResponse, endpoint = 'profileView') {
        const _this = instance;
        const dash = endpoint === 'dashFullProfileWithEntities';
        let foundGithub = false;
        const foundPortfolio = false;
        /** @type {ParseProfileSchemaResultSummary} */
        const resultSummary = {
            liResponse,
            profileSrc: endpoint,
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
            let db = buildDbFromLiSchema(liResponse);

            if (dash && !liResponse.data.hoisted) {
                // For FullProfileWithEntities, the main entry point of response
                // (response.data) points directly to the profile object, by URN
                // This profile obj itself holds the ToC to its content, instead
                // of having the ToC in the res.data section (like profileView)
                const profileObj = db.getElementByUrn(db.tableOfContents['*elements'][0]);
                if (!profileObj || !profileObj.firstName) {
                    throw new Error('Could not extract nested profile object from Dash endpoint');
                }
                // To make this easier to work with lookup, we'll unpack the
                // profile view nested object BACK into the root (ToC), so
                // that lookups can be performed by key instead of type | recipe
                /** @type {LiResponse} */
                const hoistedRes = {
                    data: {
                        ...liResponse.data,
                        ...profileObj,
                        // Set flag for future
                        hoisted: true
                    },
                    included: liResponse.included
                };
                resultSummary.liResponse = hoistedRes;
                db = buildDbFromLiSchema(hoistedRes);
            }

            // Parse basics / profile
            let profileGrabbed = false;
            const profileObjs = dash ? [db.getElementByUrn(db.tableOfContents['*elements'][0])] : db.getValuesByKey(_liSchemaKeys.profile);
            instance.debugConsole.log({ profileObjs });
            profileObjs.forEach((profile) => {
                // There should only be one
                if (!profileGrabbed) {
                    profileGrabbed = true;
                    resultSummary.profileInfoObj = profile;
                    /**
                     * What the heck LI, this seems *intentionally* misleading
                     * @type {LiSupportedLocale}
                     */
                    const localeObject = !dash ? profile.defaultLocale : profile.primaryLocale;
                    /** @type {ResumeSchemaStable['basics']} */
                    const formattedProfileObj = {
                        name: `${profile.firstName} ${profile.lastName}`,
                        summary: noNullOrUndef(profile.summary),
                        label: noNullOrUndef(profile.headline),
                        location: {
                            countryCode: localeObject.country
                        }
                    };
                    if (profile.address) {
                        formattedProfileObj.location.address = noNullOrUndef(profile.address);
                    } else if (profile.locationName) {
                        formattedProfileObj.location.address = noNullOrUndef(profile.locationName);
                    }
                    _outputJsonStable.basics = {
                        ..._outputJsonStable.basics,
                        ...formattedProfileObj
                    };
                    _outputJsonLatest.basics = {
                        ..._outputJsonLatest.basics,
                        ...formattedProfileObj
                    };
                    /** @type {ResumeSchemaStable['languages'][0]} */
                    const formatttedLang = {
                        language: localeObject.language,
                        fluency: 'Native Speaker'
                    };
                    _outputJsonStable.languages.push(formatttedLang);
                    _outputJsonLatest.languages.push(formatttedLang);
                    resultSummary.sections.basics = 'success';

                    // Also make sure instance defaultLocale is correct, while we are parsing profile
                    const parsedLocaleStr = `${localeObject.language}_${localeObject.country}`;
                    _defaultLocale = parsedLocaleStr;
                    resultSummary.localeStr = parsedLocaleStr;
                }
            });

            // Parse attachments / portfolio links
            const attachments = db.getValuesByKey(_liTypeMappings.attachments.tocKeys);
            attachments.forEach((attachment) => {
                let captured = false;
                const url = attachment.data.url || attachment.data.Url;
                if (attachment.providerName === 'GitHub' || /github\.com/gim.test(url)) {
                    const usernameMatch = /github\.com\/([^\/\?]+)[^\/]+$/gim.exec(url);
                    if (usernameMatch && !foundGithub) {
                        foundGithub = true;
                        captured = true;
                        const formattedProfile = {
                            network: 'GitHub',
                            username: usernameMatch[1],
                            url
                        };
                        _outputJsonStable.basics.profiles.push(formattedProfile);
                        _outputJsonLatest.basics.profiles.push(formattedProfile);
                    }
                }
                // Since most people put potfolio as first link, guess that it will be
                if (!captured && !foundPortfolio) {
                    captured = true;
                    _outputJsonStable.basics.website = url;
                    _outputJsonLatest.basics.url = url;
                }
                // Finally, put in projects if not yet categorized
                if (!captured) {
                    captured = true;
                    _outputJsonLatest.projects = _outputJsonLatest.projects || [];
                    _outputJsonLatest.projects.push({
                        name: attachment.title || attachment.mediaTitle,
                        startDate: '',
                        endDate: '',
                        description: attachment.description || attachment.mediaDescription,
                        url
                    });
                }
            });
            resultSummary.sections.attachments = attachments.length ? 'success' : 'empty';

            // Parse education
            let allEducationCanBeCaptured = true;
            // educationView contains both paging data, and list of child elements
            const educationView = db.getValueByKey(_liTypeMappings.education.tocKeys);
            if (educationView.paging) {
                const { paging } = educationView;
                allEducationCanBeCaptured = paging.start + paging.count >= paging.total;
            }
            if (allEducationCanBeCaptured) {
                const educationEntries = db.getValuesByKey(_liTypeMappings.education.tocKeys);
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
            const positionView = db.getValueByKey(_liTypeMappings.workPositions.tocKeys);
            if (positionView.paging) {
                const { paging } = positionView;
                allWorkCanBeCaptured = paging.start + paging.count >= paging.total;
            }
            if (allWorkCanBeCaptured) {
                const workPositions = db.getElementsByType(_liTypeMappings.workPositions.types);
                workPositions.forEach((position) => {
                    parseAndPushPosition(position);
                });
                _this.debugConsole.log(`All work positions captured directly from profile result.`);
                resultSummary.sections.work = 'success';
            } else {
                _this.debugConsole.warn(`Work positions in profile are truncated.`);
                resultSummary.sections.work = 'incomplete';
            }

            // Parse volunteer experience
            const volunteerEntries = db.getValuesByKey(_liTypeMappings.volunteerWork.tocKeys);
            volunteerEntries.forEach((volunteering) => {
                /** @type {ResumeSchemaStable['volunteer'][0]} */
                const parsedVolunteerWork = {
                    organization: volunteering.companyName,
                    position: volunteering.role,
                    website: companyLiPageFromCompanyUrn(volunteering['companyUrn']),
                    startDate: '',
                    endDate: '',
                    summary: volunteering.description,
                    highlights: []
                };
                parseAndAttachResumeDates(parsedVolunteerWork, volunteering);

                // Push to final json
                _outputJsonStable.volunteer.push(parsedVolunteerWork);
                _outputJsonLatest.volunteer.push({
                    ...lazyCopy(parsedVolunteerWork, ['website']),
                    url: parsedVolunteerWork.website
                });
            });
            resultSummary.sections.volunteer = volunteerEntries.length ? 'success' : 'empty';

            /**
             * Parse certificates
             *  - NOTE: This is not currently supported by the official (stable / latest) JSON Resume spec,
             *  - Restricted to 'beta' template
             * @see https://github.com/jsonresume/resume-schema/pull/340
             */
            /** @type {ResumeSchemaBeyondSpec['certificates']} */
            const certificates = [];
            db.getValuesByKey(_liTypeMappings.certificates.tocKeys).forEach((cert) => {
                /** @type {ResumeSchemaBeyondSpec['certificates'][0]} */
                const certObj = {
                    title: cert.name,
                    issuer: cert.authority
                };
                parseAndAttachResumeDates(certObj, cert);
                if (typeof cert.url === 'string' && cert.url) {
                    certObj.url = cert.url;
                }
                certificates.push(certObj);
            });
            resultSummary.sections.certificates = certificates.length ? 'success' : 'empty';
            _outputJsonBetaPartial.certificates = certificates;

            // Parse skills
            /** @type {string[]} */
            const skillArr = [];
            db.getValuesByKey(_liTypeMappings.skills.tocKeys).forEach((skill) => {
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
            _outputJsonLatest.projects = _outputJsonLatest.projects || [];
            db.getValuesByKey(_liTypeMappings.projects.tocKeys).forEach((project) => {
                const parsedProject = {
                    name: project.title,
                    startDate: '',
                    summary: project.description,
                    url: project.url
                };
                parseAndAttachResumeDates(parsedProject, project);
                _outputJsonLatest.projects.push(parsedProject);
            });
            resultSummary.sections.projects = _outputJsonLatest.projects.length ? 'success' : 'empty';

            // Parse awards
            const awardEntries = db.getValuesByKey(_liTypeMappings.awards.tocKeys);
            awardEntries.forEach((award) => {
                /** @type {ResumeSchemaStable['awards'][0]} */
                const parsedAward = {
                    title: award.title,
                    date: '',
                    awarder: award.issuer,
                    summary: noNullOrUndef(award.description)
                };
                // profileView vs dash key
                const issueDateObject = award.issueDate || award.issuedOn;
                if (issueDateObject && typeof issueDateObject === 'object') {
                    parsedAward.date = parseDate(issueDateObject);
                }
                _outputJsonStable.awards.push(parsedAward);
                _outputJsonLatest.awards.push(parsedAward);
            });
            resultSummary.sections.awards = awardEntries.length ? 'success' : 'empty';

            // Parse publications
            const publicationEntries = db.getValuesByKey(_liTypeMappings.publications.tocKeys);
            publicationEntries.forEach((publication) => {
                /** @type {ResumeSchemaStable['publications'][0]} */
                const parsedPublication = {
                    name: publication.name,
                    publisher: publication.publisher,
                    releaseDate: '',
                    website: noNullOrUndef(publication.url),
                    summary: noNullOrUndef(publication.description)
                };
                // profileView vs dash key
                const publicationDateObj = publication.date || publication.publishedOn;
                if (publicationDateObj && typeof publicationDateObj === 'object' && typeof publicationDateObj.year !== 'undefined') {
                    parsedPublication.releaseDate = parseDate(publicationDateObj);
                }
                _outputJsonStable.publications.push(parsedPublication);
                _outputJsonLatest.publications.push({
                    ...lazyCopy(parsedPublication, ['website']),
                    url: parsedPublication.website
                });
            });
            resultSummary.sections.publications = publicationEntries.length ? 'success' : 'empty';

            if (_this.debug) {
                console.group(`parseProfileSchemaJSON complete: ${document.location.pathname}`);
                console.log({
                    db,
                    _outputJsonStable,
                    _outputJsonLatest,
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
     * @param {boolean} [OPT_debug] - Debug Mode?
     * @param {boolean} [OPT_preferApi] - Prefer Voyager API, rather than DOM scrape?
     * @param {boolean} [OPT_getFullSkills] - Retrieve full skills (behind additional API endpoint), rather than just basics
     */
    function LinkedinToResumeJson(OPT_debug, OPT_preferApi, OPT_getFullSkills) {
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
        _defaultLocale = this.getViewersLocalLang();
        this.scannedPageUrl = '';
        this.parseSuccess = false;
        this.getFullSkills = typeof OPT_getFullSkills === 'boolean' ? OPT_getFullSkills : true;
        this.preferApi = typeof OPT_preferApi === 'boolean' ? OPT_preferApi : true;
        this.debug = typeof OPT_debug === 'boolean' ? OPT_debug : false;
        if (this.debug) {
            console.warn('LinkedinToResumeJson - DEBUG mode is ON');
            this.internals = {
                buildDbFromLiSchema,
                parseProfileSchemaJSON,
                _defaultLocale,
                _liSchemaKeys,
                _liTypeMappings,
                _voyagerEndpoints,
                output: {
                    _outputJsonStable,
                    _outputJsonLatest,
                    _outputJsonBetaPartial
                }
            };
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
        const formattedProfile = {
            network: 'LinkedIn',
            username: this.profileId,
            url: `https://www.linkedin.com/in/${this.profileId}/`
        };
        _outputJsonStable.basics.profiles.push(formattedProfile);
        _outputJsonLatest.basics.profiles.push(formattedProfile);
    };

    LinkedinToResumeJson.prototype.parseViaInternalApiFullProfile = async function parseViaInternalApiFullProfile(useCache = true) {
        try {
            // Get full profile
            const profileParserResult = await this.getParsedProfile(useCache);

            // Some sections might require additional fetches to fill missing data
            if (profileParserResult.sections.work === 'incomplete') {
                _outputJsonStable.work = [];
                _outputJsonLatest.work = [];
                await this.parseViaInternalApiWork();
            }
            if (profileParserResult.sections.education === 'incomplete') {
                _outputJsonStable.education = [];
                _outputJsonLatest.education = [];
                await this.parseViaInternalApiEducation();
            }

            this.debugConsole.log({
                _outputJsonStable,
                _outputJsonLatest
            });

            return true;
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
                /** @type {Partial<ResumeSchemaStable['basics']>} */
                const partialBasics = {
                    location: _outputJsonStable.basics.location
                };
                partialBasics.location.address = noNullOrUndef(contactInfo.data.address, _outputJsonStable.basics.location.address);
                partialBasics.email = noNullOrUndef(emailAddress, _outputJsonStable.basics.email);
                if (phoneNumbers && phoneNumbers.length) {
                    partialBasics.phone = noNullOrUndef(phoneNumbers[0].number);
                }
                _outputJsonStable.basics = {
                    ..._outputJsonStable.basics,
                    ...partialBasics
                };
                _outputJsonLatest.basics = {
                    ..._outputJsonLatest.basics,
                    ...partialBasics
                };

                // Scrape Websites
                if (Array.isArray(websites)) {
                    for (let x = 0; x < websites.length; x++) {
                        if (/portfolio/i.test(websites[x].type.category)) {
                            _outputJsonStable.basics.website = websites[x].url;
                            _outputJsonLatest.basics.url = websites[x].url;
                        }
                    }
                }

                // Scrape Twitter
                if (Array.isArray(twitterHandles)) {
                    twitterHandles.forEach((handleMeta) => {
                        const handle = handleMeta.name;
                        const formattedProfile = {
                            network: 'Twitter',
                            username: handle,
                            url: `https://twitter.com/${handle}`
                        };
                        _outputJsonStable.basics.profiles.push(formattedProfile);
                        _outputJsonLatest.basics.profiles.push(formattedProfile);
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
                    /** @type {Partial<ResumeSchemaStable['basics']>} */
                    const partialBasics = {
                        name: `${data.firstName} ${data.LastName}`,
                        // Note - LI labels this as "occupation", but it is basically the callout that shows up in search results and is in the header of the profile
                        label: data.occupation
                    };
                    _outputJsonStable.basics = {
                        ..._outputJsonStable.basics,
                        ...partialBasics
                    };
                    _outputJsonLatest.basics = {
                        ..._outputJsonLatest.basics,
                        ...partialBasics
                    };
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
                /** @type {Partial<ResumeSchemaStable['basics']>} */
                const partialBasics = {
                    name: `${data.firstName} ${data.lastName}`,
                    label: data.headline,
                    summary: data.summary
                };
                _outputJsonStable.basics = {
                    ..._outputJsonStable.basics,
                    ...partialBasics
                };
                _outputJsonLatest.basics = {
                    ..._outputJsonLatest.basics,
                    ...partialBasics
                };
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
                    const formattedReference = {
                        name: `${recommenderElem.firstName} ${recommenderElem.lastName}`,
                        reference: elem.recommendationText
                    };
                    _outputJsonStable.references.push(formattedReference);
                    _outputJsonLatest.references.push(formattedReference);
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

    LinkedinToResumeJson.prototype.parseViaInternalApi = async function parseViaInternalApi(useCache = true) {
        try {
            let apiSuccessCount = 0;
            let fullProfileEndpointSuccess = false;

            fullProfileEndpointSuccess = await this.parseViaInternalApiFullProfile(useCache);
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

            this.debugConsole.log({
                _outputJsonStable,
                _outputJsonLatest,
                _outputJsonBetaPartial
            });
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
     * Get the parsed version of the LI profile response object
     *  - Caches profile object and re-uses when possible
     * @param {boolean} [useCache] default = true
     * @param {string} [optLocale] preferred locale. Defaults to instance.preferLocale
     * @returns {Promise<ParseProfileSchemaResultSummary>} profile object response summary
     */
    LinkedinToResumeJson.prototype.getParsedProfile = async function getParsedProfile(useCache = true, optLocale) {
        const localeToUse = optLocale || this.preferLocale;
        const localeMatchesUser = !localeToUse || optLocale === _defaultLocale;

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
        /** @type {ParseProfileSchemaResultSummary['profileSrc']} */
        let endpointType = 'profileView';
        /** @type {LiResponse} */
        let profileResponse;
        if (!localeMatchesUser) {
            /**
             * LI acts strange if user is a multilingual user, with defaultLocale different than the resource being requested. It will *not* respect x-li-lang header for profileView, and you instead have to use the Dash fullprofile endpoint
             */
            endpointType = 'dashFullProfileWithEntities';
            profileResponse = await this.voyagerFetch(_voyagerEndpoints.dash.fullProfile);
        } else {
            // use normal profileView
            profileResponse = await this.voyagerFetch(_voyagerEndpoints.fullProfileView);
        }

        // Try to use the same parser that I use for embedded
        const profileParserResult = await parseProfileSchemaJSON(this, profileResponse, endpointType);

        if (profileParserResult.parseSuccess) {
            this.debugConsole.log('getProfileResponse - Used API. Sucess', {
                profileResponse,
                endpointType,
                profileParserResult
            });
            this.profileParseSummary = profileParserResult;
            return this.profileParseSummary;
        }

        throw new Error('Could not get profile response object');
    };

    /**
     * Try to scrape / get API and parse
     *  - Has some basic cache checking to avoid redundant parsing
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
                _outputJsonStable = JSON.parse(JSON.stringify(resumeJsonTemplateStable));
                _outputJsonLatest = JSON.parse(JSON.stringify(resumeJsonTemplateLatest));
                _outputJsonBetaPartial = JSON.parse(JSON.stringify(resumeJsonTemplateBetaPartial));

                // Trigger full load
                await _this.triggerAjaxLoadByScrolling();
                _this.parseBasics();

                // Embedded schema can't be used for specific locales
                if (_this.preferApi === false && localeMatchesUser) {
                    await _this.parseEmbeddedLiSchema();
                    if (!_this.parseSuccess) {
                        await _this.parseViaInternalApi(false);
                    }
                } else {
                    await _this.parseViaInternalApi(false);
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

    /** @param {SchemaVersion} version */
    LinkedinToResumeJson.prototype.parseAndGetRawJson = async function parseAndGetRawJson(version = 'stable') {
        await this.tryParse();
        let rawJson = version === 'stable' ? _outputJsonStable : _outputJsonLatest;
        // If beta, combine with latest
        if (version === 'beta') {
            rawJson = {
                ...rawJson,
                ..._outputJsonBetaPartial
            };
        }
        return rawJson;
    };

    /** @param {SchemaVersion} version */
    LinkedinToResumeJson.prototype.parseAndDownload = async function parseAndDownload(version = 'stable') {
        const rawJson = await this.parseAndGetRawJson(version);
        const fileName = `${_outputJsonStable.basics.name.replace(/\s/g, '_')}.resume.json`;
        const fileContents = JSON.stringify(rawJson, null, 2);
        this.debugConsole.log(fileContents);
        promptDownload(fileContents, fileName, 'application/json');
    };

    /** @param {SchemaVersion} version */
    LinkedinToResumeJson.prototype.parseAndShowOutput = async function parseAndShowOutput(version = 'stable') {
        const rawJson = await this.parseAndGetRawJson(version);
        const parsedExport = {
            raw: rawJson,
            stringified: JSON.stringify(rawJson, null, 2)
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

    /**
     * Get the profile ID / User ID of the user by parsing URL first, then page.
     */
    LinkedinToResumeJson.prototype.getProfileId = function getProfileId() {
        let profileId = '';
        const linkedProfileRegUrl = /linkedin.com\/in\/([^\/?#]+)[\/?#]?.*$/im;
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
     *  - This should correspond to LI's defaultLocale, which persists, even across user configuration changes
     * @returns {string}
     */
    LinkedinToResumeJson.prototype.getViewersLocalLang = () => {
        // This *seems* to correspond with profile.defaultLocale, but I'm not 100% sure
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
     * Note: Uses cache
     * @returns {Promise<string[]>}
     */
    LinkedinToResumeJson.prototype.getSupportedLocales = async function getSupportedLocales() {
        if (!_supportedLocales.length) {
            const { liResponse } = await this.getParsedProfile(true, null);
            const profileDb = buildDbFromLiSchema(liResponse);
            const userDetails = profileDb.getValuesByKey(_liSchemaKeys.profile)[0];
            if (userDetails && Array.isArray(userDetails['supportedLocales'])) {
                _supportedLocales = userDetails.supportedLocales.map((locale) => {
                    return `${locale.language}_${locale.country}`;
                });
            }
        }
        return _supportedLocales;
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
            const profileDb = buildDbFromLiSchema(this.profileParseSummary.liResponse);
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
            const { liResponse, profileSrc, profileInfoObj } = await this.getParsedProfile();
            const profileDb = buildDbFromLiSchema(liResponse);
            const fullProfile = profileDb.getValuesByKey(_liSchemaKeys.profile)[0];
            let pictureMeta;
            if (profileSrc === 'profileView') {
                const miniProfile = profileDb.getElementByUrn(fullProfile['*miniProfile']);
                if (miniProfile && !!miniProfile.picture) {
                    pictureMeta = miniProfile.picture;
                }
            } else {
                pictureMeta = profileInfoObj.profilePicture.displayImageReference.vectorImage;
            }
            // @ts-ignore
            const smallestArtifact = pictureMeta.artifacts.sort((a, b) => a.width - b.width)[0];
            photoUrl = `${pictureMeta.rootUrl}${smallestArtifact.fileIdentifyingUrlPathSegment}`;
        }

        return photoUrl;
    };

    LinkedinToResumeJson.prototype.generateVCard = async function generateVCard() {
        const { liResponse } = await this.getParsedProfile();
        const contactInfoObj = await this.voyagerFetch(_voyagerEndpoints.contactInfo);
        this.exportVCard(liResponse, contactInfoObj);
    };

    /**
     * @param {LiResponse} profileResponse
     * @param {LiResponse} contactInfoObj
     */
    LinkedinToResumeJson.prototype.exportVCard = async function exportVCard(profileResponse, contactInfoObj) {
        const vCard = VCardsJS();
        const profileDb = buildDbFromLiSchema(profileResponse);
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
        // At a minimum, we need month and day in order to include BDAY
        if (profile.birthDate && 'day' in profile.birthDate && 'month' in profile.birthDate) {
            const birthdayLi = /** @type {LiDate} */ (profile.birthDate);
            if (!birthdayLi.year) {
                /**
                 * Users can choose to OMIT their birthyear, but leave month and day (thus hiding age)
                 * - vCard actually allows this in spec, but only in > v4 (RFC-6350): https://tools.ietf.org/html/rfc6350#:~:text=BDAY%3A--0415, https://tools.ietf.org/html/rfc6350#section-4.3.1
                 *       - Governed by ISO-8601, which allows truncated under ISO.8601.2000, such as `--MMDD`
                 *       - Example: `BDAY:--0415`
                 * - Since the vCard library I'm using (many platforms) only support V3, I'll just exclude it from the vCard; including a partial date in v3 (violating the spec) will result in a corrupt card that will crash many programs
                 */
                console.warn(`Warning: User has a "partial" birthdate (year is omitted). This is not supported in vCard version 3 or under.`);
            } else {
                // Full birthday (can be used for age)
                vCard.birthday = liDateToJSDate(birthdayLi);
            }
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
        let photoUrl;
        try {
            photoUrl = await this.getDisplayPhoto();
        } catch (e) {
            this.debugConsole.warn(`Could not extract profile picture.`, e);
        }
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
                                /** @type {LiResponse} */
                                const parsed = JSON.parse(text);
                                if (!!_this.preferLocale && _this.preferLocale !== _defaultLocale) {
                                    _this.debugConsole.log(`Checking for locale mapping and remapping if found.`);
                                    remapNestedLocale(parsed.included, this.preferLocale, true);
                                }

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
