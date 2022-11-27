/**
 * @preserve
 * @author Joshua Tzucker
 * @license MIT
 * WARNING: This tool is not affiliated with LinkedIn in any manner. Intended use is to export your own profile data, and you, as the user, are responsible for using it within the terms and services set out by LinkedIn. I am not responsible for any misuse, or repercussions of said misuse.
 */

// @ts-ignore
import VCardsJS from '@dan/vcards';
import { resumeJsonTemplateLegacy, resumeJsonTemplateStable, resumeJsonTemplateBetaPartial } from './templates';
import { liSchemaKeys as _liSchemaKeys, liTypeMappings as _liTypeMappings } from './schema';
import {
    getCookie,
    lazyCopy,
    liDateToJSDate,
    noNullOrUndef,
    parseStartDate,
    promptDownload,
    setQueryParams,
    urlToBase64,
    remapNestedLocale,
    companyLiPageFromCompanyUrn,
    parseAndAttachResumeDates
} from './utilities';

// ==Bookmarklet==
// @name linkedin-to-jsonresume-bookmarklet
// @author Joshua Tzucker
// ==/Bookmarklet==

// @ts-ignore
window.LinkedinToResumeJson = (() => {
    // private
    /** @type {ResumeSchemaLegacy} */
    let _outputJsonLegacy = JSON.parse(JSON.stringify(resumeJsonTemplateLegacy));
    /** @type {ResumeSchemaStable} */
    let _outputJsonStable = JSON.parse(JSON.stringify(resumeJsonTemplateStable));
    /** @type {ResumeSchemaBeyondSpec} */
    let _outputJsonBetaPartial = JSON.parse(JSON.stringify(resumeJsonTemplateBetaPartial));
    /** @type {string[]} */
    let _supportedLocales = [];
    /** @type {string} */
    let _defaultLocale = `en_US`;
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
            profilePositionGroups: {
                path: '/identity/dash/profilePositionGroups?q=viewee&profileUrn=urn:li:fsd_profile:{profileUrnId}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfilePositionGroup-50',
                template: '/identity/dash/profilePositionGroups?q=viewee&profileUrn=urn:li:fsd_profile:{profileUrnId}&decorationId={decorationId}',
                recipe: 'com.linkedin.voyager.dash.deco.identity.profile.FullProfilePositionGroup'
            },
            fullProfile: {
                path: '/identity/dash/profiles?q=memberIdentity&memberIdentity={profileId}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93',
                template: '/identity/dash/profiles?q=memberIdentity&memberIdentity={profileId}&decorationId={decorationId}',
                recipe: 'com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities'
            },
            profileVolunteerExperiences: '/identity/dash/profileVolunteerExperiences?q=viewee&profileUrn=urn:li:fsd_profile:{profileUrnId}'
        }
    };
    let _scrolledToLoad = false;
    const _toolPrefix = 'jtzLiToResumeJson';
    const _stylesInjected = false;

    /**
     * Builds a mini-db out of a LI schema obj
     * @param {LiResponse} schemaJson
     * @returns {InternalDb}
     */
    function buildDbFromLiSchema(schemaJson) {
        /**
         * In LI response, `response.data.*elements _can_ contain an array of ordered URNs
         */
        const possibleResponseDirectUrnArrayKeys = ['*elements', 'elements'];
        /** @type {InternalDb['entitiesByUrn']} */
        const entitiesByUrn = {};
        /** @type {InternalDb['entities']} */
        const entities = [];

        // `response.included` often has a sort order that does *not* match the page. If `response.data.*elements` is
        // included, we should try to reorder `included` before passing it through to other parts of the DB, so as to
        // preserve intended sort order as much as possible
        for (let x = 0; x < possibleResponseDirectUrnArrayKeys.length; x++) {
            /** @type {string[] | undefined} */
            const elementsUrnArr = schemaJson.data[possibleResponseDirectUrnArrayKeys[x]];
            if (Array.isArray(elementsUrnArr)) {
                const sorted = [];
                elementsUrnArr.forEach((urn) => {
                    const matching = schemaJson.included.find((e) => e.entityUrn === urn);
                    if (matching) {
                        sorted.push(matching);
                    }
                });
                // Put any remaining elements in last
                sorted.push(...schemaJson.included.filter((e) => !elementsUrnArr.includes(e.entityUrn)));
                schemaJson.included = sorted;
                break;
            }
        }

        // Copy all `included` entities to internal DB arrays, which might or might not be sorted at this point
        for (let x = 0; x < schemaJson.included.length; x++) {
            /** @type {LiEntity & {key: string}} */
            const currRow = {
                key: schemaJson.included[x].entityUrn,
                ...schemaJson.included[x]
            };
            entitiesByUrn[currRow.entityUrn] = currRow;
            entities.push(currRow);
        }

        /** @type {Partial<InternalDb> & Pick<InternalDb,'entitiesByUrn' | 'entities' | 'tableOfContents'>} */
        const db = {
            entitiesByUrn,
            entities,
            tableOfContents: schemaJson.data
        };
        delete db.tableOfContents['included'];
        /**
         * Get list of element keys (if applicable)
         *  - Certain LI responses will contain a list of keys that correspond to
         * entities via an URN mapping. I think these are in cases where the response
         * is returning a mix of entities, both directly related to the inquiry and
         * tangentially (e.g. `book` entities and `author` entities, return in the
         * same response). In this case, `elements` are those that directly satisfy
         *  the request, and the other items in `included` are those related
         *
         * Order provided by LI in HTTP response is passed through, if exists
         * @returns {string[]}
         */
        db.getElementKeys = function getElementKeys() {
            for (let x = 0; x < possibleResponseDirectUrnArrayKeys.length; x++) {
                const key = possibleResponseDirectUrnArrayKeys[x];
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
         * Get all elements that match type.
         * WARNING: Since this gets elements directly by simply iterating through all results, not via ToC, order of entities returned is simply whatever order LI provides them in the response. Not guaranteed to be in order! Use a ToC approach if you need ordered results.
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
            if (typeof urns === 'string') {
                urns = [urns];
            }
            return Array.isArray(urns) ? urns.map((urn) => db.entitiesByUrn[urn]) : [];
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
            /** @type {LiEntity[]} */
            const values = [];
            if (Array.isArray(key)) {
                return values.concat(
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
            let matchingDbIndexes = [];
            // Array of direct keys to sub items
            if (Array.isArray(tocVal)) {
                matchingDbIndexes = tocVal;
            }
            // String pointing to sub item
            else if (tocVal) {
                const subToc = this.entitiesByUrn[tocVal];
                // Needs secondary lookup if has elements property with list of keys pointing to other sub items
                if (subToc['*elements'] && Array.isArray(subToc['*elements'])) {
                    matchingDbIndexes = subToc['*elements'];
                }
                // Sometimes they use 'elements' instead of '*elements"...
                else if (subToc['elements'] && Array.isArray(subToc['elements'])) {
                    matchingDbIndexes = subToc['elements'];
                } else {
                    // The object itself should be the return row
                    values.push(subToc);
                }
            }
            for (let x = 0; x < matchingDbIndexes.length; x++) {
                if (typeof this.entitiesByUrn[matchingDbIndexes[x]] !== 'undefined') {
                    values.push(this.entitiesByUrn[matchingDbIndexes[x]]);
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
     * Push a new skill to the resume object
     * @param {string} skillName
     */
    function pushSkill(skillName) {
        // Try to prevent duplicate skills
        // Both legacy and stable use same spec
        const skillNames = _outputJsonLegacy.skills.map((skill) => skill.name);
        if (skillNames.indexOf(skillName) === -1) {
            /** @type {ResumeSchemaLegacy['skills'][0]} */
            const formattedSkill = {
                name: skillName,
                level: '',
                keywords: []
            };
            _outputJsonLegacy.skills.push(formattedSkill);
            _outputJsonStable.skills.push(formattedSkill);
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
        /** @type {ResumeSchemaLegacy['education'][0]} */
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
        } else {
            // new version (Dash) of education <--> course relationship
            // linked on "union" field, instead of directly, so have to iterate
            db.getElementsByType(_liTypeMappings.courses.types).forEach((c) => {
                if (c.occupationUnion && c.occupationUnion.profileEducation) {
                    if (c.occupationUnion.profileEducation === edu.entityUrn) {
                        // union joined!
                        parsedEdu.courses.push(`${c.number} - ${c.name}`);
                    }
                }
            });
        }
        // Push to final json
        _outputJsonLegacy.education.push(parsedEdu);
        // Currently, same schema can be re-used; only difference is URL, which I'm not including
        _outputJsonStable.education.push({
            institution: noNullOrUndef(edu.schoolName),
            area: noNullOrUndef(edu.fieldOfStudy),
            studyType: noNullOrUndef(edu.degreeName),
            startDate: parsedEdu.startDate,
            endDate: parsedEdu.endDate,
            score: noNullOrUndef(edu.grade),
            courses: parsedEdu.courses
        });
    }

    /**
     * Parse a LI position object and push the parsed work entry to Resume
     * @param {LiEntity} positionObj
     * @param {InternalDb} db
     */
    function parseAndPushPosition(positionObj, db) {
        /** @type {ResumeSchemaLegacy['work'][0]} */
        const parsedWork = {
            company: positionObj.companyName,
            endDate: '',
            highlights: [],
            position: positionObj.title,
            startDate: '',
            summary: positionObj.description,
            website: companyLiPageFromCompanyUrn(positionObj['companyUrn'], db)
        };
        parseAndAttachResumeDates(parsedWork, positionObj);
        // Lookup company website
        if (positionObj.company && positionObj.company['*miniCompany']) {
            // @TODO - website is not in schema. Use voyager?
            // let companyInfo = db.data[position.company['*miniCompany']];
        }

        // Push to final json
        _outputJsonLegacy.work.push(parsedWork);
        _outputJsonStable.work.push({
            name: parsedWork.company,
            position: parsedWork.position,
            // This is description of company, not position
            // description: '',
            startDate: parsedWork.startDate,
            endDate: parsedWork.endDate,
            highlights: parsedWork.highlights,
            summary: parsedWork.summary,
            url: parsedWork.website,
            location: positionObj.locationName
        });
    }

    /**
     * Parse a LI volunteer experience object and push the parsed volunteer entry to Resume
     * @param {LiEntity} volunteerEntryObj
     * @param {InternalDb} db
     */
    function parseAndPushVolunteerExperience(volunteerEntryObj, db) {
        /** @type {ResumeSchemaLegacy['volunteer'][0]} */
        const parsedVolunteerWork = {
            organization: volunteerEntryObj.companyName,
            position: volunteerEntryObj.role,
            website: companyLiPageFromCompanyUrn(volunteerEntryObj['companyUrn'], db),
            startDate: '',
            endDate: '',
            summary: volunteerEntryObj.description,
            highlights: []
        };
        parseAndAttachResumeDates(parsedVolunteerWork, volunteerEntryObj);

        // Push to final json
        _outputJsonLegacy.volunteer.push(parsedVolunteerWork);
        _outputJsonStable.volunteer.push({
            ...lazyCopy(parsedVolunteerWork, ['website']),
            url: parsedVolunteerWork.website
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
                languages: 'fail',
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
                // that subsequent lookups can be performed by key instead of type | recipe
                // This is critical for lookups that require precise ordering, preserved by ToCs
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
                    /** @type {ResumeSchemaLegacy['basics']} */
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
                    _outputJsonLegacy.basics = {
                        ..._outputJsonLegacy.basics,
                        ...formattedProfileObj
                    };
                    _outputJsonStable.basics = {
                        ..._outputJsonStable.basics,
                        ...formattedProfileObj
                    };
                    /** @type {ResumeSchemaLegacy['languages'][0]} */
                    const formatttedLang = {
                        language: localeObject.language.toLowerCase() === 'en' ? 'English' : localeObject.language,
                        fluency: 'Native Speaker'
                    };
                    _outputJsonLegacy.languages.push(formatttedLang);
                    _outputJsonStable.languages.push(formatttedLang);
                    resultSummary.sections.basics = 'success';

                    // Also make sure instance defaultLocale is correct, while we are parsing profile
                    const parsedLocaleStr = `${localeObject.language}_${localeObject.country}`;
                    _defaultLocale = parsedLocaleStr;
                    resultSummary.localeStr = parsedLocaleStr;
                }
            });

            // Parse languages (in _addition_ to the core profile language)
            /** @type {ResumeSchemaStable['languages']} */
            let languages = [];
            const languageElements = db.getValuesByKey(_liTypeMappings.languages.tocKeys);
            languageElements.forEach((languageMeta) => {
                /** @type {Record<string,string>} */
                const liProficiencyEnumToJsonResumeStr = {
                    NATIVE_OR_BILINGUAL: 'Native Speaker',
                    FULL_PROFESSIONAL: 'Full Professional',
                    EXPERT: 'Expert',
                    ADVANCED: 'Advanced',
                    PROFESSIONAL_WORKING: 'Professional Working',
                    LIMITED_WORKING: 'Limited Working',
                    INTERMEDIATE: 'intermediate',
                    BEGINNER: 'Beginner',
                    ELEMENTARY: 'Elementary'
                };
                const liProficiency = typeof languageMeta.proficiency === 'string' ? languageMeta.proficiency.toUpperCase() : undefined;
                if (liProficiency && liProficiency in liProficiencyEnumToJsonResumeStr) {
                    languages.push({
                        fluency: liProficiencyEnumToJsonResumeStr[liProficiency],
                        language: languageMeta.name
                    });
                }
            });
            // Merge with main profile language, while preventing duplicate
            languages = [
                ..._outputJsonStable.languages.filter((e) => {
                    return !languages.find((l) => l.language === e.language);
                }),
                ...languages
            ];
            _outputJsonLegacy.languages = languages;
            _outputJsonStable.languages = languages;
            resultSummary.sections.languages = languages.length ? 'success' : 'empty';

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
                        _outputJsonLegacy.basics.profiles.push(formattedProfile);
                        _outputJsonStable.basics.profiles.push(formattedProfile);
                    }
                }
                // Since most people put potfolio as first link, guess that it will be
                if (!captured && !foundPortfolio) {
                    captured = true;
                    _outputJsonLegacy.basics.website = url;
                    _outputJsonStable.basics.url = url;
                }
                // Finally, put in projects if not yet categorized
                if (!captured) {
                    captured = true;
                    _outputJsonStable.projects = _outputJsonStable.projects || [];
                    _outputJsonStable.projects.push({
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
            // Work can be grouped in multiple ways - check all
            // this is [positionView, positionGroupView]
            const views = [_liTypeMappings.workPositionGroups.tocKeys, _liTypeMappings.workPositions.tocKeys].map(db.getValueByKey);
            for (let x = 0; x < views.length; x++) {
                const view = views[x];
                if (view && view.paging) {
                    const { paging } = view;
                    if (paging.start + paging.count >= paging.total !== true) {
                        allWorkCanBeCaptured = false;
                        break;
                    }
                }
            }
            if (allWorkCanBeCaptured) {
                _this.getWorkPositions(db).forEach((position) => {
                    parseAndPushPosition(position, db);
                });
                _this.debugConsole.log(`All work positions captured directly from profile result.`);
                resultSummary.sections.work = 'success';
            } else {
                _this.debugConsole.warn(`Work positions in profile are truncated.`);
                resultSummary.sections.work = 'incomplete';
            }

            // Parse volunteer experience
            let allVolunteerCanBeCaptured = true;
            const volunteerView = db.getValueByKey([..._liTypeMappings.volunteerWork.tocKeys]);
            if (volunteerView.paging) {
                const { paging } = volunteerView;
                allVolunteerCanBeCaptured = paging.start + paging.count >= paging.total;
            }
            if (allVolunteerCanBeCaptured) {
                const volunteerEntries = db.getValuesByKey(_liTypeMappings.volunteerWork.tocKeys);
                volunteerEntries.forEach((volunteering) => {
                    parseAndPushVolunteerExperience(volunteering, db);
                });
                resultSummary.sections.volunteer = volunteerEntries.length ? 'success' : 'empty';
            } else {
                _this.debugConsole.warn('Volunteer entries in profile are truncated');
                resultSummary.sections.volunteer = 'incomplete';
            }

            /** @type {ResumeSchemaBeyondSpec['certificates']} */
            const certificates = [];
            db.getValuesByKey(_liTypeMappings.certificates.tocKeys).forEach((cert) => {
                /** @type {ResumeSchemaBeyondSpec['certificates'][0]} */
                const certObj = {
                    name: cert.name,
                    issuer: cert.authority
                };
                parseAndAttachResumeDates(certObj, cert);
                if (typeof cert.url === 'string' && cert.url) {
                    certObj.url = cert.url;
                }
                certificates.push(certObj);
            });
            resultSummary.sections.certificates = certificates.length ? 'success' : 'empty';
            _outputJsonStable.certificates = certificates;

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
            _outputJsonStable.projects = _outputJsonStable.projects || [];
            db.getValuesByKey(_liTypeMappings.projects.tocKeys).forEach((project) => {
                const parsedProject = {
                    name: project.title,
                    startDate: '',
                    summary: project.description,
                    url: project.url
                };
                parseAndAttachResumeDates(parsedProject, project);
                _outputJsonStable.projects.push(parsedProject);
            });
            resultSummary.sections.projects = _outputJsonStable.projects.length ? 'success' : 'empty';

            // Parse awards
            const awardEntries = db.getValuesByKey(_liTypeMappings.awards.tocKeys);
            awardEntries.forEach((award) => {
                /** @type {ResumeSchemaLegacy['awards'][0]} */
                const parsedAward = {
                    title: award.title,
                    date: '',
                    awarder: award.issuer,
                    summary: noNullOrUndef(award.description)
                };
                // profileView vs dash key
                const issueDateObject = award.issueDate || award.issuedOn;
                if (issueDateObject && typeof issueDateObject === 'object') {
                    parsedAward.date = parseStartDate(issueDateObject);
                }
                _outputJsonLegacy.awards.push(parsedAward);
                _outputJsonStable.awards.push(parsedAward);
            });
            resultSummary.sections.awards = awardEntries.length ? 'success' : 'empty';

            // Parse publications
            const publicationEntries = db.getValuesByKey(_liTypeMappings.publications.tocKeys);
            publicationEntries.forEach((publication) => {
                /** @type {ResumeSchemaLegacy['publications'][0]} */
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
                    parsedPublication.releaseDate = parseStartDate(publicationDateObj);
                }
                _outputJsonLegacy.publications.push(parsedPublication);
                _outputJsonStable.publications.push({
                    ...lazyCopy(parsedPublication, ['website']),
                    url: parsedPublication.website
                });
            });
            resultSummary.sections.publications = publicationEntries.length ? 'success' : 'empty';

            if (_this.debug) {
                console.group(`parseProfileSchemaJSON complete: ${document.location.pathname}`);
                console.log({
                    db,
                    _outputJsonLegacy,
                    _outputJsonStable,
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

        // Try to patch _voyagerEndpoints with correct paths, if possible
        // @TODO - get around extension sandbox issue (this doesn't really currently work unless executed outside extension)
        if (typeof window.require === 'function') {
            try {
                const recipeMap = window.require('deco-recipes/pillar-recipes/profile/recipes');
                ['profilePositionGroups', 'fullProfile'].forEach((_key) => {
                    const key = /** @type {'profilePositionGroups' | 'fullProfile'} */ (_key);
                    const decorationId = recipeMap[_voyagerEndpoints.dash[key].recipe];
                    if (decorationId) {
                        const oldPath = _voyagerEndpoints.dash[key].path;
                        _voyagerEndpoints.dash[key].path = _voyagerEndpoints.dash[key].template.replace('{decorationId}', decorationId);
                        this.debugConsole.log(`Patched voyagerEndpoint for ${key}; old = ${oldPath}, new = ${_voyagerEndpoints.dash[key].path}`);
                    }
                });
            } catch (err) {
                console.error(`Error trying to patch _voyagerEndpoints, `, err);
            }
        } else {
            this.debugConsole.log(`Could not live-patch _voyagerEndpoints - missing window.require`);
        }

        // Force use of newer Dash endpoints when possible, for debugging
        this.preferDash = this.debug && /forceDashEndpoint=true/i.test(document.location.href);
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
                    _outputJsonLegacy,
                    _outputJsonStable,
                    _outputJsonBetaPartial
                }
            };
        }
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
        _outputJsonLegacy.basics.profiles.push(formattedProfile);
        _outputJsonStable.basics.profiles.push(formattedProfile);
    };

    LinkedinToResumeJson.prototype.parseViaInternalApiFullProfile = async function parseViaInternalApiFullProfile(useCache = true) {
        try {
            // Get full profile
            const profileParserResult = await this.getParsedProfile(useCache);

            // Some sections might require additional fetches to fill missing data
            if (profileParserResult.sections.work === 'incomplete') {
                _outputJsonLegacy.work = [];
                _outputJsonStable.work = [];
                await this.parseViaInternalApiWork();
            }
            if (profileParserResult.sections.education === 'incomplete') {
                _outputJsonLegacy.education = [];
                _outputJsonStable.education = [];
                await this.parseViaInternalApiEducation();
            }
            if (profileParserResult.sections.volunteer === 'incomplete') {
                _outputJsonLegacy.volunteer = [];
                _outputJsonStable.volunteer = [];
                await this.parseViaInternalApiVolunteer();
            }

            this.debugConsole.log({
                _outputJsonLegacy,
                _outputJsonStable
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
                /** @type {Partial<ResumeSchemaLegacy['basics']>} */
                const partialBasics = {
                    location: _outputJsonLegacy.basics.location
                };
                partialBasics.location.address = noNullOrUndef(contactInfo.data.address, _outputJsonLegacy.basics.location.address);
                partialBasics.email = noNullOrUndef(emailAddress, _outputJsonLegacy.basics.email);
                if (phoneNumbers && phoneNumbers.length) {
                    partialBasics.phone = noNullOrUndef(phoneNumbers[0].number);
                }
                _outputJsonLegacy.basics = {
                    ..._outputJsonLegacy.basics,
                    ...partialBasics
                };
                _outputJsonStable.basics = {
                    ..._outputJsonStable.basics,
                    ...partialBasics
                };

                // Scrape Websites
                if (Array.isArray(websites)) {
                    for (let x = 0; x < websites.length; x++) {
                        if (/portfolio/i.test(websites[x].type.category)) {
                            _outputJsonLegacy.basics.website = websites[x].url;
                            _outputJsonStable.basics.url = websites[x].url;
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
                        _outputJsonLegacy.basics.profiles.push(formattedProfile);
                        _outputJsonStable.basics.profiles.push(formattedProfile);
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
                    /** @type {Partial<ResumeSchemaLegacy['basics']>} */
                    const partialBasics = {
                        name: `${data.firstName} ${data.LastName}`,
                        // Note - LI labels this as "occupation", but it is basically the callout that shows up in search results and is in the header of the profile
                        label: data.occupation
                    };
                    _outputJsonLegacy.basics = {
                        ..._outputJsonLegacy.basics,
                        ...partialBasics
                    };
                    _outputJsonStable.basics = {
                        ..._outputJsonStable.basics,
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
                /** @type {Partial<ResumeSchemaLegacy['basics']>} */
                const partialBasics = {
                    name: `${data.firstName} ${data.lastName}`,
                    label: data.headline,
                    summary: data.summary
                };
                _outputJsonLegacy.basics = {
                    ..._outputJsonLegacy.basics,
                    ...partialBasics
                };
                _outputJsonStable.basics = {
                    ..._outputJsonStable.basics,
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
                    _outputJsonLegacy.references.push(formattedReference);
                    _outputJsonStable.references.push(formattedReference);
                }
            });
        } catch (e) {
            this.debugConsole.warn('Error parsing using internal API (Voyager) - Recommendations', e);
        }
        return false;
    };

    /**
     * Some LI entities are "rolled-up" through intermediate groupings; this function takes a multi-pronged approach to
     * try and traverse through to the underlying elements. Right now only used for work position groupings
     * @param {InternalDb} db
     * @param {object} lookupConfig
     * @param {string | string[]} lookupConfig.multiRootKey Example: `'*profilePositionGroups'`
     * @param {string} lookupConfig.singleRootVoyagerTypeString Example: `'com.linkedin.voyager.dash.identity.profile.PositionGroup'`
     * @param {string} lookupConfig.elementsInGroupCollectionResponseKey Example: `'*profilePositionInPositionGroup'`
     * @param {string | undefined} lookupConfig.fallbackElementGroupViewKey Example: `'*positionGroupView'`
     * @param {string | undefined} lookupConfig.fallbackElementGroupUrnArrayKey Example: `'*positions'`
     * @param {string | string[] | undefined} lookupConfig.fallbackTocKeys Example: `['*positionView']`
     * @param {string | string[] | undefined} lookupConfig.fallbackTypeStrings Example: `['com.linkedin.voyager.identity.profile.Position', 'com.linkedin.voyager.dash.identity.profile.Position']`
     */
    LinkedinToResumeJson.prototype.getElementsThroughGroup = function getElementsThroughGroup(
        db,
        { multiRootKey, singleRootVoyagerTypeString, elementsInGroupCollectionResponseKey, fallbackElementGroupViewKey, fallbackElementGroupUrnArrayKey, fallbackTocKeys, fallbackTypeStrings }
    ) {
        const rootElements = db.getElements() || [];
        /** @type {LiEntity[]} */
        let finalEntities = [];

        /**
         * There are multiple ways that ordered / grouped elements can be nested within a profileView, or other data structure
         * Using example of work positions:
         *  A) **ROOT** -> *profilePositionGroups -> PositionGroup[] -> *profilePositionInPositionGroup (COLLECTION) -> Position[]
         *  B) **ROOT** -> *positionGroupView -> PositionGroupView -> PositionGroup[] -> *positions -> Position[]
         */

        // This is route A - longest recursion chain
        // profilePositionGroup responses are a little annoying; the direct children don't point directly to position entities
        // Instead, you have to follow path of `profilePositionGroup` -> `*profilePositionInPositionGroup` -> `*elements` -> `Position`
        // You can bypass by looking up by `Position` type, but then original ordering is not preserved
        let profileElementGroups = db.getValuesByKey(multiRootKey);
        // Check for voyager profilePositionGroups response, where all groups are direct children of root element
        if (!profileElementGroups.length && rootElements.length && rootElements[0].$type === singleRootVoyagerTypeString) {
            profileElementGroups = rootElements;
        }
        profileElementGroups.forEach((pGroup) => {
            // This element (profileElementsGroup) is one way how LI groups positions
            // - Instead of storing *elements (positions) directly,
            // there is a pointer to a "collection" that has to be followed
            /** @type {string | string[] | undefined} */
            const profilePositionInGroupCollectionUrns = pGroup[elementsInGroupCollectionResponseKey];
            if (profilePositionInGroupCollectionUrns) {
                const positionCollections = db.getElementsByUrns(profilePositionInGroupCollectionUrns);
                // Another level... traverse collections
                positionCollections.forEach((collection) => {
                    // Final lookup via standard collection['*elements']
                    finalEntities = finalEntities.concat(db.getElementsByUrns(collection['*elements'] || []));
                });
            }
        });

        if (!finalEntities.length && !!fallbackElementGroupViewKey && !!fallbackElementGroupUrnArrayKey) {
            db.getValuesByKey(fallbackElementGroupViewKey).forEach((pGroup) => {
                finalEntities = finalEntities.concat(db.getElementsByUrns(pGroup[fallbackElementGroupUrnArrayKey] || []));
            });
        }

        if (!finalEntities.length && !!fallbackTocKeys) {
            // Direct lookup - by main TOC keys
            finalEntities = db.getValuesByKey(fallbackTocKeys);
        }

        if (!finalEntities.length && !!fallbackTypeStrings) {
            // Direct lookup - by type
            finalEntities = db.getElementsByType(fallbackTypeStrings);
        }

        return finalEntities;
    };

    /**
     * Extract work positions via traversal through position groups
     *  - LI groups "positions" by "positionGroups" - e.g. if you had three positions at the same company, with no breaks in-between to work at another company, those three positions are grouped under a single positionGroup
     *  - LI also uses positionGroups to preserve order, whereas a direct lookup by type or recipe might not return ordered results
     *  - This method will try to return ordered results first, and then fall back to any matching position entities if it can't find an ordered lookup path
     * @param {InternalDb} db
     */
    LinkedinToResumeJson.prototype.getWorkPositions = function getWorkPositions(db) {
        return this.getElementsThroughGroup(db, {
            multiRootKey: '*profilePositionGroups',
            singleRootVoyagerTypeString: 'com.linkedin.voyager.dash.identity.profile.PositionGroup',
            elementsInGroupCollectionResponseKey: '*profilePositionInPositionGroup',
            fallbackElementGroupViewKey: '*positionGroupView',
            fallbackElementGroupUrnArrayKey: '*positions',
            fallbackTocKeys: _liTypeMappings.workPositions.tocKeys,
            fallbackTypeStrings: _liTypeMappings.workPositions.types
        });
    };

    LinkedinToResumeJson.prototype.parseViaInternalApiWork = async function parseViaInternalApiWork() {
        try {
            const workResponses = await this.voyagerFetchAutoPaginate(_voyagerEndpoints.dash.profilePositionGroups.path);
            workResponses.forEach((response) => {
                const db = buildDbFromLiSchema(response);
                this.getWorkPositions(db).forEach((position) => {
                    parseAndPushPosition(position, db);
                });
            });
        } catch (e) {
            this.debugConsole.warn('Error parsing using internal API (Voyager) - Work', e);
        }
    };

    LinkedinToResumeJson.prototype.parseViaInternalApiEducation = async function parseViaInternalApiEducation() {
        try {
            // This is a really annoying lookup - I can't find a separate API endpoint, so I have to use the full-FULL (dash) profile endpoint...
            const fullDashProfileObj = await this.voyagerFetch(_voyagerEndpoints.dash.fullProfile.path);
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

    LinkedinToResumeJson.prototype.parseViaInternalApiVolunteer = async function parseViaInternalApiVolunteer() {
        try {
            const volunteerResponses = await this.voyagerFetchAutoPaginate(_voyagerEndpoints.dash.profileVolunteerExperiences);
            volunteerResponses.forEach((response) => {
                const db = buildDbFromLiSchema(response);
                db.getElementsByType(_liTypeMappings.volunteerWork.types).forEach((volunteerEntry) => {
                    parseAndPushVolunteerExperience(volunteerEntry, db);
                });
            });
        } catch (e) {
            this.debugConsole.warn('Error parsing using internal API (Voyager) - Volunteer Entries', e);
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
                _outputJsonLegacy,
                _outputJsonStable,
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
    LinkedinToResumeJson.prototype.getParsedProfile = async function getParsedProfile(useCache = true, optLocale = undefined) {
        const localeToUse = optLocale || this.preferLocale;
        const localeMatchesUser = !localeToUse || localeToUse === _defaultLocale;

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
        /**
         * LI acts strange if user is a multilingual user, with defaultLocale different than the resource being requested. It will *not* respect x-li-lang header for profileView, and you instead have to use the Dash fullprofile endpoint
         */
        if (!localeMatchesUser || this.preferDash === true) {
            endpointType = 'dashFullProfileWithEntities';
            profileResponse = await this.voyagerFetch(_voyagerEndpoints.dash.fullProfile.path);
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
                _outputJsonLegacy = JSON.parse(JSON.stringify(resumeJsonTemplateLegacy));
                _outputJsonStable = JSON.parse(JSON.stringify(resumeJsonTemplateStable));
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
        let rawJson = version === 'stable' ? _outputJsonStable : _outputJsonLegacy;
        // If beta, combine with stable
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
        const fileName = `${_outputJsonLegacy.basics.name.replace(/\s/g, '_')}.resume.json`;
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
            let pictureMeta;
            if (profileSrc === 'profileView') {
                const miniProfile = profileDb.getElementByUrn(profileInfoObj['*miniProfile']);
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
        const profileResSummary = await this.getParsedProfile();
        const contactInfoObj = await this.voyagerFetch(_voyagerEndpoints.contactInfo);
        this.exportVCard(profileResSummary, contactInfoObj);
    };

    /**
     * @param {ParseProfileSchemaResultSummary} profileResult
     * @param {LiResponse} contactInfoObj
     */
    LinkedinToResumeJson.prototype.exportVCard = async function exportVCard(profileResult, contactInfoObj) {
        const vCard = VCardsJS();
        const profileDb = buildDbFromLiSchema(profileResult.liResponse);
        const contactDb = buildDbFromLiSchema(contactInfoObj);
        // Contact info is stored directly in response; no lookup
        const contactInfo = /** @type {LiProfileContactInfoResponse['data']} */ (contactDb.tableOfContents);
        const profile = profileResult.profileInfoObj;
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
            vCard.socialUrls['twitter'] = `https://twitter.com/${contactInfo.twitterHandles[0].name}`;
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
        const positions = this.getWorkPositions(profileDb);
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
     * API fetching, with auto pagination
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
