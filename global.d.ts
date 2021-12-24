import { ResumeSchemaLegacy as _ResumeSchemaLegacy } from './jsonresume.schema.legacy';
import { ResumeSchemaStable as _ResumeSchemaStable, ResumeSchemaBeyondSpec as _ResumeSchemaBeyondSpec } from './jsonresume.schema.latest';

declare global {
    interface GenObj {
        [k: string]: any;
    }

    // LI Types

    /**
     * Uniform Resource Name (URN) - very common throughout LinkedIn APIs
     * @example urn:li:collectionResponse:acb123...
     * @see https://docs.microsoft.com/en-us/linkedin/shared/api-guide/concepts/urns
     */
    type LiUrn = string;

    /**
     * These are used throughout LI APIs, also referred to as "recipes" or "recipeTypes"
     * @example com.linkedin.voyager.identity.profile.Profile
     */
    type LiTypeStr = `com.linkedin.${string}`;

    interface LiPaging {
        count: number;
        start: number;
        total?: number;
        $recipeTypes?: LiTypeStr[];
        // I've never actually seen this property populated...
        // This is probably actually `Array<com.linkedin.restli.common.Link>`
        links?: string[];
    }

    interface LiEntity {
        $type: LiTypeStr;
        entityUrn: LiUrn;
        objectUrn?: LiUrn;
        [key: string]: any;
        paging?: LiPaging;
    }

    interface LiResponse {
        data: {
            $type: LiTypeStr;
            paging?: LiPaging;
            // This is kind of a ToC, where each string corresponds to an entityUrn ID of an entity in `included`
            '*elements'?: string[];
            // Any number of fields can be included, especially if this is a "flat" response (when `included` is empty, and all entity data is directly in `data`)
            [k: string]: GenObj | string | boolean;
        } & Partial<LiEntity>;
        included: LiEntity[];
        meta?: {
            microSchema?: {
                isGraphQL: boolean;
                types: {
                    [key: string]: {
                        baseType: LiTypeStr;
                        fields: GenObj;
                    };
                };
            };
        };
    }

    interface LiSupportedLocale {
        country: string;
        language: string;
        $type: LiTypeStr;
    }

    /**
     * ! WARNING ! - Month and day are *not* zero-indexed. E.g. "Feb" is represented as `2`, not `1`
     */
    interface LiDate {
        month?: number;
        day?: number;
        year?: number;
    }

    interface LiPhoneNum {
        number: string;
        type: 'MOBILE' | 'WORK' | 'HOME' | string;
    }

    interface LiWebsite {
        url: string;
        type: {
            $type: LiTypeStr;
            category: string;
        };
        $type: LiTypeStr;
    }

    type TocValModifier = (tocVal: string | string[]) => string | string[];

    interface InternalDb {
        tableOfContents: LiResponse['data'];
        entitiesByUrn: {
            [k: string]: LiEntity & { key: LiUrn };
        };
        entities: Array<LiEntity & { key: LiUrn }>;
        // Methods
        getElementKeys: () => string[];
        getElements: () => Array<LiEntity & { key: LiUrn }>;
        getValueByKey: (key: string | string[]) => LiEntity | undefined;
        getValuesByKey: (key: LiUrn | LiUrn[], optTocValModifier?: TocValModifier) => LiEntity[];
        getElementsByType: (typeStr: string | string[]) => LiEntity[];
        getElementByUrn: (urn: string) => LiEntity | undefined;
        /**
         * Get multiple elements by URNs
         *  - Allows passing a single URN, for convenience if unsure if you have an array
         */
        getElementsByUrns: (urns: string[] | string) => LiEntity[];
    }

    interface LiProfileContactInfoResponse extends LiResponse {
        data: LiResponse['data'] &
            Partial<LiEntity> & {
                $type: 'com.linkedin.voyager.identity.profile.ProfileContactInfo';
                address: string;
                birthDateOn: LiDate;
                birthdayVisibilitySetting: any;
                connectedAt: null | number;
                emailAddress: null | string;
                ims: any;
                interests: any;
                phoneNumbers: null | LiPhoneNum[];
                primaryTwitterHandle: null | string;
                twitterHandles: any[];
                weChatContactInfo: any;
                websites: null | LiWebsite[];
            };
    }

    /**
     * LI2JR Types
     */
    type CaptureResult = 'success' | 'fail' | 'incomplete' | 'empty';

    interface ParseProfileSchemaResultSummary {
        liResponse: LiResponse;
        profileInfoObj?: LiEntity;
        profileSrc: 'profileView' | 'dashFullProfileWithEntities';
        pageUrl: string;
        localeStr?: string;
        parseSuccess: boolean;
        sections: {
            basics: CaptureResult;
            languages: CaptureResult;
            attachments: CaptureResult;
            education: CaptureResult;
            work: CaptureResult;
            volunteer: CaptureResult;
            certificates: CaptureResult;
            skills: CaptureResult;
            projects: CaptureResult;
            awards: CaptureResult;
            publications: CaptureResult;
        };
    }

    type SchemaVersion = 'legacy' | 'stable' | 'beta';

    type ResumeSchemaLegacy = _ResumeSchemaLegacy;
    type ResumeSchemaStable = _ResumeSchemaStable;
    type ResumeSchemaBeyondSpec = _ResumeSchemaBeyondSpec;
}
