var resumeJsonTemplate = {
	"basics": {
		"name" : "",
		"label" : "",
		"picture": "",
		"email" : "",
		"phone" : "",
		"website" : "",
		"summary" : "",
		"location": {
			"address" : "",
			"postalCode" : "",
			"city" : "",
			"countryCode" : "",
			"region" : ""
		},
		"profiles": [
			{
				"network" : "",
				"username" : "",
				"url" : ""
			}
		]
	},
	"work": [
		{
			"company" : "",
			"position" : "",
			"website" : "",
			"startDate" : "",
			"endDate" : "",
			"summary" : "",
			"highlights": []
		}
	],
	"volunteer": [
		{
			"organization" : "",
			"position" : "",
			"website" : "",
			"startDate" : "",
			"endDate" : "",
			"summary" : "",
			"highlights": []
		}
	],
	"education": [
		{
			"institution" : "",
			"area" : "",
			"studyType" : "",
			"startDate" : "",
			"endDate" : "",
			"gpa" : "",
			"courses": []
		}
	],
	"awards": [
		{
			"title" : "",
			"date" : "",
			"awarder" : "",
			"summary" : ""
		}
	],
	"publications": [
		{
			"name" : "",
			"publisher" : "",
			"releaseDate" : "",
			"website" : "",
			"summary" : ""
		}
	],
	"skills": [
		{
			"name" : "",
			"level" : "",
			"keywords": []
		}
	],
	"languages": [
		{
			"language" : "",
			"fluency" : ""
		}
	],
	"interests": [
		{
			"name" : "",
			"keywords": []
		}
	],
	"references": [
		{
			"name" : "",
			"reference" : ""
		}
	]
}

var linkedinToResumeJson = (function(){
    // private
    var _outputJson = resumeJsonTemplate;
    var _templateJson = resumeJsonTemplate;
    function getCookie(name) {
        var v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
        return v ? v[2] : null;
    }
    // Constructor
    function linkedinToResumeJson(){
        console.log("Constructed!");
        this.pageScanned = false;
        this.pageHasEmbeddedSchema = false;
        this.parseSuccess = false;
        this.profileId = this.getProfileId();
    }
    linkedinToResumeJson.prototype.parseEmbeddedLiSchema = function(){
        var possibleBlocks = document.querySelectorAll('code[id^="bpr-guid-"]');
        for (var x=0; x<possibleBlocks.length; x++){
            if (/educationView/.test(possibleBlocks[x].innerHTML) && /languageView/.test(possibleBlocks[x].innerHTML)){
                try {
                    var embeddedJson = JSON.parse(possibleBlocks[x].innerHTML);
                    console.log(embeddedJson);
                }
                catch (e){
                    console.log('Could not parse embedded schema!');
                }
            }
        }
    }
    linkedinToResumeJson.prototype.parseOldSchool = function(){
        //
    }
    linkedinToResumeJson.prototype.parseViaInternalApi = async function(){
        try {
            // Get basic contact info
            var contactInfo = await this.voyagerFetch('/identity/profiles/{profileId}/profileContactInfo');
            console.log(contactInfo);
        }
        catch (e){
            console.log('Error parsing using internal API (Voyager)');
        }
    }
    linkedinToResumeJson.prototype.forceReParse = function(){
        this.parseSuccess = false;
        this.tryParse();
    }
    linkedinToResumeJson.prototype.tryParse = function(){
        if (!this.parseSuccess){

        }
    }
    linkedinToResumeJson.prototype.getJSON = function(){
        if (this.parseSuccess){
            return _outputJson;
        }
        else {
            return _templateJson;
        }
    }
    /**
     * Get the profile ID / User ID of the user by parsing URL first, then page.
     */
    linkedinToResumeJson.prototype.getProfileId = function(){
        var linkedProfileRegUrl = /linkedin.com\/[^\/]*\/([^\/]+)\/[^\/]*$/im;
        var linkedProfileRegApi = /voyager\/api\/.*\/profiles\/([^\/]+)\/.*/im
        if (linkedProfileRegUrl.test(document.location.href)){
            return linkedProfileRegUrl.exec(document.location.href)[1];
        }
        if (linkedProfileRegApi.test(document.body.innerHTML)){
            return linkedProfileRegApi.exec(document.body.innerHTML)[1];
        }
        return false;
    }
    /**
     * Special - Fetch with authenticated internal API
     */
    linkedinToResumeJson.prototype.voyagerFetch = async function(endpoint){
        // Macro support
        endpoint = endpoint.replace('{profileId}',this.profileId);
        if (!endpoint.startsWith('https')){
            endpoint = 'https://www.linkedin.com/voyager/api' + endpoint;
        }
        cb = typeof(cb)==='function' ? cb : function(r){console.log(r);};
        return new Promise(function(resolve,reject){
            // Get the csrf token - should be stored as a cookie
            var csrfTokenString = getCookie('JSESSIONID').replace(/"/g,'');
            if (csrfTokenString){
                var fetchOptions = {
                    "credentials" : "include",
                    "headers" : {
                        "accept": "application/vnd.linkedin.normalized+json+2.1",
                        "csrf-token" : csrfTokenString,
                        "sec-fetch-mode" : "cors",
                        "sec-fetch-site" : "same-origin"
                    },
                    "referrer" : document.location.href,
                    "body" : null,
                    "method" : "GET",
                    "mode" : "cors"
                };
                console.log(fetchOptions);
                fetch(endpoint,fetchOptions).then(function(response){
                    if (response.status !== 200){
                        resolve(false);
                        console.warn('Error fetching internal API endpoint');
                    }
                    else {
                        response.text().then(function(text){
                            try {
                                var parsed = JSON.parse(text);
                                resolve(parsed);
                            }
                            catch (e){
                                console.warn('Error parsing internal API response');
                                resolve(false);
                            }
                        });
                    }
                });
            }
            else {
                resolve(false);
            }
        });
    }
    return linkedinToResumeJson;
})();

window.linkedinToResumeJsonConverter = new linkedinToResumeJson();