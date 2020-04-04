document.getElementById('liToJsonButton').addEventListener('click', () => {
    chrome.tabs.executeScript(
        {
            file: 'main.js'
        },
        () => {
            chrome.tabs.executeScript(
                {
                    code: `isDebug = window.location.href.includes('li2jr_debug=true');(new LinkedinToResumeJson(false,isDebug)).parseAndShowOutput();window.LinkedinToResumeJson = isDebug ? LinkedinToResumeJson : window.LinkedinToResumeJson;`
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
