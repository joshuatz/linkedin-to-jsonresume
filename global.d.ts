interface GenObj {
    [k: string]: any;
}

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
    tota: number;
    // Haven't actually seen this filled in with data yet...
    links: any[];
}

interface LiEntity {
    $type: string;
    entityUrn: LiUrn;
    [key: string]: any;
}

interface LiSupportedLocale {
    country: string;
    language: string;
    $type: string;
}

interface LiDate {
    month?: number;
    day?: number;
    year?: number;
}

interface LiPhoneNum {
    number: string;
    type: string;
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
    getValuesByKey: (key: LiUrn, optTocValModifier?: TocValModifier) => LiEntity[];
    getElementsByType: (typeStr: string) => LiEntity[];
    getElementByUrn: (urn: string) => LiEntity | undefined;
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