/**
 * @author Joshua Tzucker
 * @license MIT
 * Warning: This tool is not affiliated with LinkedIn in any manner. Intended use is to export your own profile data, and you, as the user, are responsible for using it within the terms and services set out by LinkedIn. I am not resonsible for any misuse, or reprecussions of said misuse.
 */

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
            /*
			{
				"network" : "",
				"username" : "",
				"url" : ""
            }
            */
		]
	},
	"work": [
        /*
		{
			"company" : "",
			"position" : "",
			"website" : "",
			"startDate" : "",
			"endDate" : "",
			"summary" : "",
			"highlights": []
        }
        */
	],
	"volunteer": [
        /*
		{
			"organization" : "",
			"position" : "",
			"website" : "",
			"startDate" : "",
			"endDate" : "",
			"summary" : "",
			"highlights": []
        }
        */
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
        /*
		{
			"title" : "",
			"date" : "",
			"awarder" : "",
			"summary" : ""
        }
        */
	],
	"publications": [
        /*
		{
			"name" : "",
			"publisher" : "",
			"releaseDate" : "",
			"website" : "",
			"summary" : ""
        }
        */
	],
	"skills": [
        /*
		{
			"name" : "",
			"level" : "",
			"keywords": []
        }
        */
	],
	"languages": [
        /*
		{
			"language" : "",
			"fluency" : ""
        }
        */
	],
	"interests": [
        /*
		{
			"name" : "",
			"keywords": []
        }
        */
	],
	"references": [
        /*
		{
			"name" : "",
			"reference" : ""
        }
        */
	]
}

var linkedinToResumeJson = (function(){
    // private
    let _outputJson = resumeJsonTemplate;
    let _templateJson = resumeJsonTemplate;
    let _liSchemaKeys = {
        profile: '*profile',
        certificates : '*certificationView',
        education: '*educationView',
        workPositions: '*positionView',
        skills: '*skillView',
        projects: '*projectView',
        attachments: '*summaryTreasuryMedias',
        volunteerWork: '*volunteerExperienceView',
        awards: '*honorView',
        publications: '*publicationView'
    }
    let _voyagerEndpoints = {
        following : '/identity/profiles/{profileId}/following',
        followingCompanies: '/identity/profiles/{profileId}/following?count=10&entityType=COMPANY&q=followedEntities',
        contactInfo : '/identity/profiles/{profileId}/profileContactInfo',
        basicAboutMe : '/me',
        advancedAboutMe : '/identity/profiles/{profileId}'
    }
    let _scrolledToLoad = false;
    function getCookie(name) {
        let v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
        return v ? v[2] : null;
    }
    function noNull(value,OPT_defaultVal){
        let defaultVal = (OPT_defaultVal || '');
        return value===null ? defaultVal : value;
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
        let template = {
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
        let db = template;
        db.tableOfContents = schemaJson.data;
        for (let x=0; x<schemaJson.included.length; x++){
            let currRow = schemaJson.included[x];
            currRow.key = currRow.entityUrn;
            db.data[currRow.entityUrn] = currRow;
        }
        db.getValuesByKey = function(key){
            let values = [];
            let tocVal = this.tableOfContents[key]
            // tocVal will usually be a single string that is a key to another lookup. In rare cases, it is an array of direct keys
            let matchingDbIndexs = [];
            // Array of direct keys to sub items
            if (Array.isArray(tocVal)){
                matchingDbIndexs = tocVal;
            }
            // String pointing to sub item
            else if(tocVal){
                let subToc = this.data[tocVal];
                // Needs secondary lookup if has elements property with list of keys pointing to other sub items
                if (subToc['*elements'] && Array.isArray(subToc['*elements'])){
                    matchingDbIndexs = subToc['*elements'];
                }
                // Sometimes they use 'elements' instead of '*elements"...
                else if (subToc['elements'] && Array.isArray(subToc['elements'])){
                    matchingDbIndexs = subToc['elements'];
                }
                else {
                    // The object itself should be the return row
                    values.push(subToc);
                }
            }
            for (let x=0; x<matchingDbIndexs.length; x++){
                if (typeof(this.data[matchingDbIndexs[x]])!=='undefined'){
                    values.push(this.data[matchingDbIndexs[x]]);
                }
            }
            return values;
        }
        return db;
    }
    // Constructor
    function linkedinToResumeJson(OPT_exportBeyondSpec){
        console.log("Constructed!");
        this.pageScanned = false;
        this.pageHasEmbeddedSchema = false;
        this.parseSuccess = false;
        this.profileId = this.getProfileId();
        this.exportBeyondSpec = (OPT_exportBeyondSpec || false);
    }
    linkedinToResumeJson.prototype.setExportBeyondSpec = function(setting){
        if (typeof(setting)==='boolean'){
            this.exportBeyondSpec = setting;
        }
    }
    linkedinToResumeJson.prototype.parseEmbeddedLiSchema = function(){
        let _this = this;
        let foundGithub = false;
        let foundPortfolio = false;
        let possibleBlocks = document.querySelectorAll('code[id^="bpr-guid-"]');
        for (let x=0; x<possibleBlocks.length; x++){
            let currSchemaBlock = possibleBlocks[x];
            if (/educationView/.test(currSchemaBlock.innerHTML) && /languageView/.test(currSchemaBlock.innerHTML)){
                console.log(currSchemaBlock);
                try {
                    let embeddedJson = JSON.parse(currSchemaBlock.innerHTML);
                    console.log(embeddedJson);
                    let db = buildDbFromLiSchema(embeddedJson);

                    // Parse basics / profile
                    let profileGrabbed = false;
                    db.getValuesByKey(_liSchemaKeys.profile).forEach(function(profile){
                        // There should only be one
                        if (!profileGrabbed){
                            profileGrabbed = true;
                            _outputJson.basics.name = profile.firstName + ' ' + profile.lastName;
                            _outputJson.basics.summary = noNull(profile.summary);
                            _outputJson.basics.label = noNull(profile.headline);
                            if(profile.address){
                                _outputJson.basics.location.address = profile.address;
                            }
                            else if (profile.locationName) {
                                _outputJson.basics.location.address = profile.locationName;
                            }
                            _outputJson.basics.location.countryCode = profile.defaultLocale.country;
                            _outputJson.languages.push({
                                language: profile.defaultLocale.language,
                                fluency: 'Native Speaker'
                            });
                        }
                    });

                    // Parse attachments / portfolio links
                    db.getValuesByKey(_liSchemaKeys.attachments).forEach(function(attachment){
                        let captured = false;
                        let url = attachment.data.url;
                        if ((attachment.providerName === 'GitHub' || /github\.com/gim.test(url))){
                            let usernameMatch = /github\.com\/([^\/\?]+)[^\/]+$/gim.exec(url)
                            if (usernameMatch && !foundGithub){
                                foundGithub = true;
                                captured = true;
                                _outputJson.basics.profiles.push({
                                    network: 'GitHub',
                                    username: usernameMatch[1],
                                    url: url
                                });
                            }
                        }
                        // Since most people put potfolio as first link, guess that it will be
                        if (!captured && !foundPortfolio){
                            captured = true;
                            _outputJson.basics.website = url;
                        }
                        // Finally, put in projects if not yet categorized
                        if (!captured && this.exportBeyondSpec){
                            captured = true;
                            _outputJson.projects = (_outputJson.projects || []);
                            _outputJson.projects.push({
                                name: attachment.title,
                                startDate: '',
                                summary: attachment.description,
                                url: project.url
                            });
                        }
                    });

                    // Parse education
                    db.getValuesByKey(_liSchemaKeys.education).forEach(function(edu){
                        let parsedEdu = {
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
                                let courseInfo = db.data[courseKey];
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
                        let parsedWork = {
                            company: position.companyName,
                            endDate: '',
                            highlights: [],
                            position: position.title,
                            startDate: '',
                            summary: position.description,
                            website: _this.companyLiPageFromCompanyUrn(position['companyUrn'])
                        }
                        if (typeof(position.timePeriod)==='object'){
                            if (typeof(position.timePeriod.endDate)==='object'){
                                parsedWork.endDate = position.timePeriod.endDate.year + '-' + position.timePeriod.endDate.month + '-31';
                            }
                            if (typeof(position.timePeriod.startDate)==='object'){
                                parsedWork.startDate = position.timePeriod.startDate.year + '-' + position.timePeriod.startDate.month + '-31';
                            }
                        }
                        // Lookup company website
                        if (position.company && position.company['*miniCompany']){
                            let companyInfo = db.data[position.company['*miniCompany']];
                            // @TODO - website is not in schema. Use voyager?
                        }

                        // Push to final json
                        _outputJson.work.push(parsedWork);
                    });

                    // Parse volunteer experience
                    db.getValuesByKey(_liSchemaKeys.volunteerWork).forEach(function(volunteering){
                        debugger;
                        let parsedVolunteerWork = {
                            organization: volunteering.companyName,
                            position: volunteering.role,
                            website: _this.companyLiPageFromCompanyUrn(volunteering['companyUrn']),
                            startDate: '',
                            endDate: '',
                            summary: volunteering.description,
                            highlights: []
                        }
                        if (typeof(volunteering.timePeriod)==='object'){
                            if (typeof(volunteering.timePeriod.endDate)==='object'){
                                parsedVolunteerWork.endDate = volunteering.timePeriod.endDate.year + '-' + volunteering.timePeriod.endDate.month + '-31';
                            }
                            if (typeof(volunteering.timePeriod.startDate)==='object'){
                                parsedVolunteerWork.startDate = volunteering.timePeriod.startDate.year + '-' + volunteering.timePeriod.startDate.month + '-31';
                            }
                        }

                        // Push to final json
                        _outputJson.volunteer.push(parsedVolunteerWork);
                    });

                    // Parse certificates
                    // Not currently used by JsonResume
                    /*
                    db.getValuesByKey(_liSchemaKeys.certificates).forEach(function(cert){
                        //
                    });
                    */

                    // Parse skills
                    let skillArr = [];
                    db.getValuesByKey(_liSchemaKeys.skills).forEach(function(skill){
                        skillArr.push(skill.name);
                    });
                    document.querySelectorAll('span[class*="skill-category-entity"][class*="name"]').forEach(function(skillName){
                        skillName = skillName.innerText;
                        if (!skillArr.includes(skillName)){
                            skillArr.push(skillName);
                        }
                    });
                    skillArr.forEach(function(skillName){
                        _outputJson.skills.push({
                            name: skillName,
                            level: '',
                            keywords: []
                        });
                    });

                    // Parse recommendations
                    let recommendationHashes = [];
                    document.querySelectorAll('#recommendation-list > li').forEach(function(elem){
                        // Click the see more button
                        // let clickMore = elem.querySelector('a[class*="__more"][href="#"]');
                        // if (clickMore){
                        //     clickMore.click();
                        // }
                        if (elem.querySelector('blockquote span[class*="line-clamp"][class*="raw"]')){
                            let rawRefData = {
                                name: elem.querySelector('h3').innerText,
                                title: elem.querySelector('p[class*="headline"]').innerText,
                                text: elem.querySelector('blockquote span[class*="line-clamp"][class*="raw"]').innerText
                            }
                            let hash = rawRefData.name + '|' + rawRefData.title;
                            if (!recommendationHashes.includes(hash)){
                                recommendationHashes.push(hash);
                                _outputJson.references.push({
                                    name: rawRefData.name,
                                    reference: rawRefData.text
                                });
                            }
                        }
                    });

                    // Parse projects
                    // Not currently used by Resume JSON
                    if (this.exportBeyondSpec){
                        _outputJson.projects = (_outputJson.projects || []);
                        db.getValuesByKey(_liSchemaKeys.projects).forEach(function(project){
                            _outputJson.projects.push({
                                name: project.title,
                                startDate: project.timePeriod.startDate + '-12-31',
                                summary: project.description,
                                url: project.url
                            });
                        });
                    }

                    // Parse awards
                    db.getValuesByKey(_liSchemaKeys.awards).forEach(function(award){
                        let parsedAward = {
                            title: award.title,
                            date: '',
                            awarder: award.issuer,
                            summary: noNull(award.description)
                        };
                        if (typeof(award.issueDate)==='object'){
                            parsedAward.date = award.issueDate.year + '-' + award.issueDate.month + '-31';
                        }
                        _outputJson.awards.push(parsedAward);
                    });

                    // Parse publications
                    db.getValuesByKey(_liSchemaKeys.publications).forEach(function(publication){
                        let parsedPublication = {
                            name: publication.name,
                            publisher: publication.publisher,
                            releaseDate: '',
                            website: noNull(publication.url),
                            summary: noNull(publication.description)
                        };
                        if (typeof(publication.date)==='object'){
                            parsedPublication.releaseDate = publication.date.year + '-' + publication.date.month + '-' + publication.date.day;
                        }
                        _outputJson.publications.push(parsedPublication);
                    });

                    console.log(_outputJson);
                }
                catch (e){
                    throw(e);
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
    linkedinToResumeJson.prototype.parseViaInternalApi = async function(){
        try {
            // Get basic contact info
            let contactInfo = await this.voyagerFetch(_voyagerEndpoints.contactInfo);
            console.log(contactInfo);
            if (contactInfo && typeof(contactInfo.data)==='object'){
                _outputJson.basics.location.address = contactInfo.data.address;
                _outputJson.basics.email = contactInfo.data.emailAddress;
                _outputJson.basics.phone = noNull(contactInfo.data.phoneNumbers);
                if (Array.isArray(contactInfo.data.websites)){
                    let websites = contactInfo.data.websites;
                    for (let x=0; x<websites.length; x++){
                        if (/portfolio/i.test(websites[x].type.category)){
                            _outputJson.basics.website = websites[x].url;
                        }
                    }
                }
            }
            let basicAboutMe = await this.voyagerFetch(_voyagerEndpoints.basicAboutMe);
            console.log(basicAboutMe);
            if (basicAboutMe && typeof(basicAboutMe.data)==='object'){
                if (Array.isArray(basicAboutMe.included) && basicAboutMe.included.length > 0){
                    let data = basicAboutMe.included[0];
                    _outputJson.basics.name = data.firstName + ' ' + data.LastName;
                    // Note - LI labels this as "occupation", but it is basically the callout that shows up in search results and is in the header of the profile
                    _outputJson.basics.label = data.occupation;
                    _outputJson.basics.picture = data.picture.rootUrl + data.picture.artifacts[data.picture.artifacts.length-1].fileIdentifyingUrlPathSegment;
                }
            }
            let advancedAboutMe = await this.voyagerFetch(_voyagerEndpoints.advancedAboutMe);
            console.log(advancedAboutMe);
            if (advancedAboutMe && typeof(advancedAboutMe.data)==='object'){
                let data = advancedAboutMe.data;
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
    linkedinToResumeJson.prototype.triggerAjaxLoadByScrolling = async function(cb){
        cb = typeof(cb)==='function' ? cb : function(){};
        if (!_scrolledToLoad){
            // Capture current location
            let startingLocY = window.scrollY;
            // Scroll to bottom
            function scrollToBottom(){
                let maxHeight = document.body.scrollHeight;
                window.scrollTo(x,maxHeight);
            }
            scrollToBottom();
            await new Promise((resolve,reject)=>{
                setTimeout(function(){
                    scrollToBottom();
                    window.scrollTo(x,startingLocY);
                    _scrolledToLoad = true;
                    resolve();
                },400);
            });
        }
        cb();
        return true;
    }
    linkedinToResumeJson.prototype.forceReParse = function(){
        this.parseSuccess = false;
        this.tryParse();
    }
    linkedinToResumeJson.prototype.tryParse = function(){
        this.triggerAjaxLoadByScrolling(function(){
            if (!this.parseSuccess){
                this.parseBasics();
                this.parseEmbeddedLiSchema();
            }
        });
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
        let linkedProfileRegUrl = /linkedin.com\/[^\/]*\/([^\/]+)\/[^\/]*$/im;
        let linkedProfileRegApi = /voyager\/api\/.*\/profiles\/([^\/]+)\/.*/im
        if (linkedProfileRegUrl.test(document.location.href)){
            return linkedProfileRegUrl.exec(document.location.href)[1];
        }
        if (linkedProfileRegApi.test(document.body.innerHTML)){
            return linkedProfileRegApi.exec(document.body.innerHTML)[1];
        }
        return false;
    }
    linkedinToResumeJson.prototype.companyLiPageFromCompanyUrn = function(companyUrn){
        let companyPageUrl = '';
        if (typeof(companyUrn)==='string'){
            let companyIdMatch = /urn.+Company:(\d+)/.exec(companyUrn);
            if (companyIdMatch){
                companyPageUrl = 'https://www.linkedin.com/company/' + companyIdMatch[1];
            }
        }
        return companyPageUrl;
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
            let csrfTokenString = getCookie('JSESSIONID').replace(/"/g,'');
            if (csrfTokenString){
                let fetchOptions = {
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
                                let parsed = JSON.parse(text);
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