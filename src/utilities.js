/** @type {Record<number,number>} */
export const maxDaysOfMonth = {
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
export function zeroLeftPad(n) {
    if (n < 10) {
        return `0${n}`;
    }

    return n.toString();
}

/**
 * Gets day, 1 if isStart=true else the last day of the month
 * @param {boolean} isStart
 * @returns {number} month
 */
function getDefaultMonth(isStart) {
    return isStart ? 1 : 12;
}

/**
 * Gets day, 1 if isStart=true else the last day of the month
 * @param {Number} month
 * @param {boolean} isStart
 * @returns {number} day
 */
function getDefaultDay(month, isStart) {
    return isStart ? 1 : maxDaysOfMonth[month];
}

/**
 * Parses an object with year, month and day and returns a string with the date.
 * @param {LiDate} dateObj
 * @param {boolean} isStart
 * @returns {string} Date, as string, formatted for JSONResume
 */
function parseDate(dateObj, isStart) {
    const year = dateObj?.year;

    if (year === undefined) {
        return '';
    }

    const month = dateObj.month ?? getDefaultMonth(isStart);
    const day = dateObj.day ?? getDefaultDay(month, isStart);

    return `${year}-${zeroLeftPad(month)}-${zeroLeftPad(day)}`;
}

/**
 * Parses an object with year, month and day and returns a string with the date.
 * - If month is not present, should return 1.
 * - If day is not present, should return 1.
 *
 * @param {LiDate} dateObj
 * @returns {string} Date, as string, formatted for JSONResume
 */
export function parseStartDate(dateObj) {
    return parseDate(dateObj, true);
}

/**
 * Parses an object with year, month and day and returns a string with the date.
 * - If month is not present, should return 12.
 * - If day is not present, should return last month day.
 *
 * @param {LiDate} dateObj
 * @returns {string} Date, as string, formatted for JSONResume
 */
export function parseEndDate(dateObj) {
    return parseDate(dateObj, false);
}

/**
 * Converts a LI Voyager style date object into a native JS Date object
 * @param {LiDate} liDateObj
 * @returns {Date} date object
 */
export function liDateToJSDate(liDateObj) {
    // This is a cheat; by passing string + 00:00, we can force Date to not offset (by timezone), and also treat month as NOT zero-indexed, which is how LI uses it
    return new Date(`${parseStartDate(liDateObj)} 00:00`);
}

/**
 * Trigger a file download prompt with given content
 * @see https://davidwalsh.name/javascript-download
 * @param {string} data
 * @param {string} fileName
 * @param {string} [type]
 */
export function promptDownload(data, fileName, type = 'text/plain') {
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
}

/**
 * Get a cookie by name
 * @param {string} name
 */
export function getCookie(name) {
    const v = document.cookie.match(`(^|;) ?${name}=([^;]*)(;|$)`);
    return v ? v[2] : null;
}

/**
 * Get URL response as base64
 * @param {string} url - URL to convert
 * @param {boolean} [omitDeclaration] - remove the `data:...` declaration prefix
 * @returns {Promise<{dataStr: string, mimeStr: string}>} base64 results
 */
export async function urlToBase64(url, omitDeclaration = false) {
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
export function setQueryParams(url, paramPairs) {
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
export function noNullOrUndef(value, optDefaultVal) {
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
export function lazyCopy(inputObj, removeKeys = []) {
    const copied = JSON.parse(JSON.stringify(inputObj));
    removeKeys.forEach((k) => delete copied[k]);
    return copied;
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
export function remapNestedLocale(liObject, desiredLocale, deep = true) {
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
 * Retrieve a LI Company Page URL from a company URN
 * @param {string} companyUrn
 * @param {InternalDb} db
 */
export function companyLiPageFromCompanyUrn(companyUrn, db) {
    if (typeof companyUrn === 'string') {
        // Dash
        const company = db.getElementByUrn(companyUrn);
        if (company && company.url) {
            return company.url;
        }

        // profileView
        const linkableCompanyIdMatch = /urn.+Company:(\d+)/.exec(companyUrn);
        if (linkableCompanyIdMatch) {
            return `https://www.linkedin.com/company/${linkableCompanyIdMatch[1]}`;
        }
    }
    return '';
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
export function parseAndAttachResumeDates(resumeObj, liEntity) {
    // Time period can either come as `timePeriod` or `dateRange` prop
    const timePeriod = liEntity.timePeriod || liEntity.dateRange;
    if (timePeriod) {
        const start = timePeriod.startDate || timePeriod.start;
        const end = timePeriod.endDate || timePeriod.end;
        if (end) {
            resumeObj.endDate = parseEndDate(end);
        }
        if (start) {
            resumeObj.startDate = parseStartDate(start);
        }
    }
}
