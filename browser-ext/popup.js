document.getElementById('inject').addEventListener('click',function(){
    chrome.tabs.executeScript({
        file: 'main.js'
    },function(){
        chrome.tabs.executeScript({
            code: 'window.linkedinToResumeJsonConverter = new LinkedinToResumeJson(null,true);\nwindow.linkedinToResumeJsonConverter.parseAndShowOutput();'
        });
    });
});