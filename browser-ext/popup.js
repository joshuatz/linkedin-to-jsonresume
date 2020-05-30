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
liToJrInstance = new LinkedinToResumeJson(false,isDebug);
`;
const runAndShowCode = `liToJrInstance.parseAndShowOutput();`;
const getLangStringsCode = `(async () => {
    //supported = await liToJrInstance.getSupportedLocales();
    supported = ['en_US', 'ru_RU'];
    user = 'en_US';
    payload = {
        supported,
        user
    }
    ${createMessageSenderInjectable('payload', 'locales')}
})();
`;

document.getElementById('liToJsonButton').addEventListener('click', () => {
    chrome.tabs.executeScript(
        {
            file: 'main.js'
        },
        () => {
            chrome.tabs.executeScript(
                {
                    code: `${createMainInstanceCode}${runAndShowCode}`
                },
                () => {
                    setTimeout(() => {
                        // Close popup
                        window.close();
                    }, 700);
                }
            );
        }
    );
});

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

chrome.runtime.onMessage.addListener((message, sender) => {
    console.log(message);
    if (sender.id === extensionId && message.key === 'locales') {
        /** @type {{supported: string[], user: string}} */
        const { supported, user } = message.value;
        // Make sure user's own locale comes as first option
        if (supported.includes(user)) {
            supported.splice(supported.indexOf(user));
        }
        supported.unshift(user);
        loadLangs(supported);
    }
});
