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

type TocValModifier = (tocVal: string | string[]) => string | string[];

interface InternalDb {
    tableOfContents: LiResponse['data'];
    data: {
        [k: LiUrn]: LiEntity & {key: LiUrn}
        [k: string]: LiEntity & {key: LiUrn};
    }
    // Methods
    getElementKeys: () => string[];
    getValuesByKey: (key: LiUrn, optTocValModifier?: TocValModifier) => LiEntity[]; 
}