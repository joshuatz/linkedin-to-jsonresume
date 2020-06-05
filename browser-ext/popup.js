const extensionId = chrome.runtime.id;
/**
 * Generate injectable code for capturing a value from the contentScript scope and passing back via message
 * @param {string} valueToCapture - Name of the scoped variable to capture
 * @param {string} [optKey] - Key to use as message identifier. Defaults to valueToCapture
 */
const createMessageSenderInjectable = (valueToCapture, optKey) => {
    return `chrome.runtime.sendMessage('${extensionId}', {
        key: '${optKey || valueToCapture}',
        value: ${valueToCapture}
    });`;
};
const createMainInstanceCode = `
isDebug = window.location.href.includes('li2jr_debug=true');
window.LinkedinToResumeJson = isDebug ? LinkedinToResumeJson : window.LinkedinToResumeJson;
// Reuse existing instance if possible
liToJrInstance = typeof(liToJrInstance) !== 'undefined' ? liToJrInstance : new LinkedinToResumeJson(false, isDebug);
`;
const runAndShowCode = `liToJrInstance.parseAndShowOutput();`;
const getLangStringsCode = `(async () => {
    const supported = await liToJrInstance.getSupportedLocales();
    const user = liToJrInstance.getViewersLocalLang();
    const payload = {
        supported,
        user
    }
    ${createMessageSenderInjectable('payload', 'locales')}
})();
`;

document.getElementById('versionDisplay').innerText = chrome.runtime.getManifest().version;

/**
 * Toggle enabled state of popup
 * @param {boolean} isEnabled
 */
const toggleEnabled = (isEnabled) => {
    document.querySelectorAll('.toggle').forEach((elem) => {
        elem.classList.remove(isEnabled ? 'disabled' : 'enabled');
        elem.classList.add(isEnabled ? 'enabled' : 'disabled');
    });
};

/**
 * Load list of language strings to be displayed as options
 * @param {string[]} langs
 */
const loadLangs = (langs) => {
    /** @type {HTMLSelectElement} */
    const selectElem = document.querySelector('.langSelect');
    selectElem.innerHTML = '';
    langs.forEach((lang) => {
        const option = document.createElement('option');
        option.value = lang;
        option.innerText = lang;
        selectElem.appendChild(option);
    });
    toggleEnabled(langs.length > 0);
};

const exportVCard = () => {
    chrome.tabs.executeScript({
        code: `liToJrInstance.generateVCard()`
    });
};

/**
 * Set the desired export lang on the exporter instance
 * - Use `null` to unset
 * @param {string | null} lang
 */
const setLang = (lang) => {
    chrome.tabs.executeScript(
        {
            code: `liToJrInstance.preferLocale = '${lang}';`
        },
        () => {
            chrome.tabs.executeScript({
                code: `console.log(liToJrInstance);console.log(liToJrInstance.preferLocale);`
            });
        }
    );
};

chrome.tabs.executeScript(
    {
        file: 'main.js'
    },
    () => {
        chrome.tabs.executeScript({
            code: `${createMainInstanceCode}${getLangStringsCode}`
        });
    }
);

/**
 * =============================
 * =   Setup Event Listeners   =
 * =============================
 */

chrome.runtime.onMessage.addListener((message, sender) => {
    console.log(message);
    if (sender.id === extensionId && message.key === 'locales') {
        /** @type {{supported: string[], user: string}} */
        const { supported, user } = message.value;
        // Make sure user's own locale comes as first option
        if (supported.includes(user)) {
            supported.splice(supported.indexOf(user), 1);
        }
        supported.unshift(user);
        loadLangs(supported);
    }
});

document.getElementById('liToJsonButton').addEventListener('click', () => {
    chrome.tabs.executeScript(
        {
            code: `${runAndShowCode}`
        },
        () => {
            setTimeout(() => {
                // Close popup
                window.close();
            }, 700);
        }
    );
});

document.getElementById('liToJsonDownloadButton').addEventListener('click', () => {
    chrome.tabs.executeScript({
        code: `liToJrInstance.parseAndDownload();`
    });
});

document.getElementById('langSelect').addEventListener('change', (evt) => {
    const updatedLang = /** @type {HTMLSelectElement} */ (evt.target).value;
    setLang(updatedLang);
});

document.getElementById('vcardExportButton').addEventListener('click', () => {
    exportVCard();
});
