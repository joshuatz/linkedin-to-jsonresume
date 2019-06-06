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
        /*
		{
			"institution" : "",
			"area" : "",
			"studyType" : "",
			"startDate" : "",
			"endDate" : "",
			"gpa" : "",
			"courses": []
        }
        */
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
    var _liSchemaKeys = {
        certificates : '*certificationView',
        education: '*educationView',
        workPositions: '*positionGroupView'
    }
    function getCookie(name) {
        var v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
        return v ? v[2] : null;
    }
    function noNull(value,OPT_defaultVal){
        var defaultVal = (OPT_defaultVal || '');
        return value===null ? '' : defaultVal;
    }
    function safeString(value){
        value = (value || '');
        if (typeof(value)==='object'){
            value = JSON.stringify(value);
        }
        else {
            value = value.toString();
        }
        return value;
    }
    function buildDbFromLiSchema(schemaJson){
        var template = {
            tableOfContents : {},
            data : {
                /*
                key : {
                    key : '',
                    $type : '',
                    ...
                }
                */
            }
        }
        var db = template;
        db.tableOfContents = schemaJson.data;
        for (var x=0; x<schemaJson.included.length; x++){
            var currRow = schemaJson.included[x];
            currRow.key = currRow.entityUrn;
            db.data[currRow.entityUrn] = currRow;
        }
        db.getValuesByKey = function(key){
            var values = [];
            var tocVal = this.tableOfContents[key]
            if(tocVal){
                var subToc = this.data[tocVal];
                if (subToc['*elements'] && Array.isArray(subToc['*elements'])){
                    var matchingDbIndexs = subToc['*elements'];
                    for (var x=0; x<matchingDbIndexs.length; x++){
                        values.push(this.data[matchingDbIndexs[x]]);
                    }
                }
            }
            return values;
        }
        return db;
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
            var currSchemaBlock = possibleBlocks[x];
            if (/educationView/.test(currSchemaBlock.innerHTML) && /languageView/.test(currSchemaBlock.innerHTML)){
                console.log(currSchemaBlock);
                try {
                    var embeddedJson = JSON.parse(currSchemaBlock.innerHTML);
                    console.log(embeddedJson);
                    var db = buildDbFromLiSchema(embeddedJson);

                    // Parse education
                    db.getValuesByKey(_liSchemaKeys.education).forEach(function(edu){
                        var parsedEdu = {
                            institution : edu.schoolName,
                            area: noNull(edu.fieldOfStudy),
                            studyType: edu.degreeName,
                            startDate: edu.timePeriod.startDate.year + '-12-31',
                            endDate: edu.timePeriod.endDate.year + '-12-31',
                            gpa: noNull(edu.grade),
                            courses : []
                        }
                        if (Array.isArray(edu.courses)){
                            // Lookup course names
                            edu.courses.forEach(function(courseKey){
                                var courseInfo = db.data[courseKey];
                                console.log(courseKey);
                                if (courseInfo){
                                    parsedEdu.courses.push(courseInfo.number + ' - ' + courseInfo.name);
                                }
                                else {
                                    console.warn('could not find course:');
                                    console.warn(courseKey);
                                }
                            });
                        }
                        // Push to final json
                        _outputJson.education.push(parsedEdu);
                    });

                    // Parse work
                    db.getValuesByKey(_liSchemaKeys.workPositions).forEach(function(position){
                        var parsedWork = {
                            //
                        }

                        // Push to final json
                        _outputJson.work.push(parsedWork);
                    });

                    // @TODO
                    console.log(_outputJson);
                }
                catch (e){
                    console.warn(e);
                    console.log('Could not parse embedded schema!');
                }
            }
        }
    }
    // This should be called every time
    linkedinToResumeJson.prototype.parseBasics = function(){
        _outputJson.basics.profiles.push({
            "network" : "LinkedIn",
            "username" : this.profileId,
            "url" : "https://www.linkedin.com/in/" + this.profileId + "/"
        });
    }
    linkedinToResumeJson.prototype.parseOldSchool = function(){
        //
    }
    linkedinToResumeJson.prototype.parseViaInternalApi = async function(){
        try {
            // Get basic contact info
            var contactInfo = await this.voyagerFetch('/identity/profiles/{profileId}/profileContactInfo');
            console.log(contactInfo);
            if (contactInfo && typeof(contactInfo.data)==='object'){
                _outputJson.basics.location.address = contactInfo.data.address;
                _outputJson.basics.email = contactInfo.data.emailAddress;
                _outputJson.basics.phone = noNull(contactInfo.data.phoneNumbers);
                if (Array.isArray(contactInfo.data.websites)){
                    var websites = contactInfo.data.websites;
                    for (var x=0; x<websites.length; x++){
                        if (/portfolio/i.test(websites[x].type.category)){
                            _outputJson.basics.website = websites[x].url;
                        }
                    }
                }
            }
            var basicAboutMe = await this.voyagerFetch('/me');
            console.log(basicAboutMe);
            if (basicAboutMe && typeof(basicAboutMe.data)==='object'){
                if (Array.isArray(basicAboutMe.included) && basicAboutMe.included.length > 0){
                    var data = basicAboutMe.included[0];
                    _outputJson.basics.name = data.firstName + ' ' + data.LastName;
                    // Note - LI labels this as "occupation", but it is basically the callout that shows up in search results and is in the header of the profile
                    _outputJson.basics.label = data.occupation;
                    _outputJson.basics.picture = data.picture.rootUrl + data.picture.artifacts[data.picture.artifacts.length-1].fileIdentifyingUrlPathSegment;
                }
            }
            var advancedAboutMe = await this.voyagerFetch('/identity/profiles/{profileId}');
            console.log(advancedAboutMe);
            if (advancedAboutMe && typeof(advancedAboutMe.data)==='object'){
                var data = advancedAboutMe.data;
                _outputJson.basics.name = data.firstName + ' ' + data.lastName;
                _outputJson.basics.label = data.headline;
                _outputJson.basics.summary = data.summary;
            }
            console.log(_outputJson);
        }
        catch (e){
            console.warn(e);
            console.log('Error parsing using internal API (Voyager)');
        }
    }
    linkedinToResumeJson.prototype.forceReParse = function(){
        this.parseSuccess = false;
        this.tryParse();
    }
    linkedinToResumeJson.prototype.tryParse = function(){
        if (!this.parseSuccess){
            this.parseBasics();
            this.parseViaInternalApi();
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