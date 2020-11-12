import {ResumeSchemaStable as _ResumeSchemaStable} from './jsonresume.schema.stable';
import {ResumeSchemaLatest as _ResumeSchemaLatest, ResumeSchemaBeyondSpec as _ResumeSchemaBeyondSpec} from './jsonresume.schema.latest';

declare global {
    interface GenObj {
        [k: string]: any;
    }

    /**
     * LI Types
     */

    type LiUrn = string;

    interface LiResponse {
        data: {
            $type: string;
            paging?: LiPaging;
            // This is kind of a ToC, where each string corresponds to an entityUrn ID of an entity in `included`
            '*elements'?: string[];
            // Any number of fields can be included, especially if this is a "flat" response (when `included` is empty, and all entity data is directly in `data`)
            [k: string]: IGenObj | string;
        } & Partial<LiEntity>;
        included: LiEntity[];
    }

    interface LiPaging {
        count: number;
        start: number;
        total?: number;
        $recipeTypes?: string[];
        // I've never actually seen this property populated...
        // This is probably actually `Array<com.linkedin.restli.common.Link>`
        links?: string[];
    }

    interface LiEntity {
        $type: string;
        entityUrn: LiUrn;
        [key: string]: any;
        paging?: LiPaging;
    }

    interface LiSupportedLocale {
        country: string;
        language: string;
        $type: string;
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
            $type: string;
            category: string;
        }
        $type: string;
    }

    type TocValModifier = (tocVal: string | string[]) => string | string[];

    interface InternalDb {
        tableOfContents: LiResponse['data'];
        entitiesByUrn: {
            [k: LiUrn]: LiEntity & {key: LiUrn}
            [k: string]: LiEntity & {key: LiUrn};
        }
        entities: Array<LiEntity & {key: LiUrn}>;
        // Methods
        getElementKeys: () => string[];
        getElements: () => Array<LiEntity & {key: LIUrn}>;
        getValueByKey: (key: string) => LiEntity;
        getValuesByKey: (key: LiUrn, optTocValModifier?: TocValModifier) => LiEntity[];
        getElementsByType: (typeStr: string) => LiEntity[];
        getElementByUrn: (urn: string) => LiEntity | undefined;
        /**
         * Get multiple elements by URNs
         */
        getElementsByUrns: (urns: string[]) => LiEntity[];
    }

    interface LiProfileContactInfoResponse extends LiResponse {
        data: LiResponse['data'] & Partial<LiEntity> & {
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
        }
    }

    /**
     * LI2JR Types
     */
    type CaptureResult = 'success' | 'fail' | 'incomplete' | 'empty';

    interface ParseProfileSchemaResultSummary {
        profileObj: LiResponse;
        pageUrl: string;
        localeStr?: string;
        parseSuccess: boolean;
        sections: {
            basics: CaptureResult,
            attachments: CaptureResult,
            education: CaptureResult,
            work: CaptureResult,
            volunteer: CaptureResult,
            certificates: CaptureResult,
            skills: CaptureResult,
            projects: CaptureResult,
            awards: CaptureResult,
            publications: CaptureResult
        }
    }

    type SchemaVersion = 'stable' | 'latest' | 'beta';

    type ResumeSchemaStable = _ResumeSchemaStable;
    type ResumeSchemaLatest = _ResumeSchemaLatest;
    type ResumeSchemaBeyondSpec = _ResumeSchemaBeyondSpec;
}
