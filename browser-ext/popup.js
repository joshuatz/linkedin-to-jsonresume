document.getElementById('liToJsonButton').addEventListener('click',function(){
    chrome.tabs.executeScript({
        file: 'main.js'
    },function(){
        chrome.tabs.executeScript({
            code: '(new LinkedinToResumeJson(false,false)).parseAndShowOutput();'
        },function(){
            setTimeout(function(){
                // Close popup
                window.close();
            },700);
        });
    });
});