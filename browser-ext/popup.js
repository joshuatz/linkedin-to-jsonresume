document.getElementById('liToJsonButton').addEventListener('click',function(){
    chrome.tabs.executeScript({
        file: 'main.js'
    },function(){
        chrome.tabs.executeScript({
            code: 'window.linkedinToResumeJsonConverter = new LinkedinToResumeJson(false,false);\nwindow.linkedinToResumeJsonConverter.parseAndShowOutput();'
        },function(){
            setTimeout(function(){
                // Close popup
                window.close();
            },700);
        });
    });
});