document.getElementById('liToJsonButton').addEventListener('click', () => {
    chrome.tabs.executeScript(
        {
            file: 'main.js'
        },
        () => {
            chrome.tabs.executeScript(
                {
                    code: '(new LinkedinToResumeJson(false,false)).parseAndShowOutput();'
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
