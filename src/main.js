/**
 * @preserve
 * @author Joshua Tzucker
 * @license MIT
 * WARNING: This tool is not affiliated with LinkedIn in any manner. Intended use is to export your own profile data, and you, as the user, are responsible for using it within the terms and services set out by LinkedIn. I am not resonsible for any misuse, or reprecussions of said misuse.
 */

// ==Bookmarklet==
// @name linkedin-to-jsonresume-bookmarklet
// @author Joshua Tzucker
// ==/Bookmarklet==

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
		"profiles": []
	},
	"work": [],
	"volunteer": [],
	"education": [],
	"awards": [],
	"publications": [],
	"skills": [],
	"languages": [],
	"interests": [],
	"references": []
}

window.LinkedinToResumeJson = (function(){
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
    let _voyagerBase = 'https://www.linkedin.com/voyager/api';
    let _voyagerEndpoints = {
        following : '/identity/profiles/{profileId}/following',
        followingCompanies: '/identity/profiles/{profileId}/following?count=10&entityType=COMPANY&q=followedEntities',
        contactInfo : '/identity/profiles/{profileId}/profileContactInfo',
        basicAboutMe : '/me',
        advancedAboutMe : '/identity/profiles/{profileId}',
        fullProfileView : '/identity/profiles/{profileId}/profileView',
        fullSkills: '/identity/profiles/{profileId}/skillCategory'
    }
    let _scrolledToLoad = false;
    let _toolPrefix = 'jtzLiToResumeJson';
    let _stylesInjected = false;
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
        db.getValuesByKey = function(key,OPT_tocValModifier){
            let values = [];
            let tocVal = this.tableOfContents[key];
            if (typeof(OPT_tocValModifier)==='function'){
                tocVal = OPT_tocValModifier(tocVal);
            }
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
    /**
     * Gets the profile ID from embedded (or api returned) Li JSON Schema
     */
    function getProfileIdFromLiSchema(jsonSchema){
        let profileId = false;
        // miniprofile is not usually in the TOC, nor does its entry have an entityUrn for looking up (it has objectUrn), so best solution is just to iterate through all entries checking for match.
        if (jsonSchema.included && Array.isArray(jsonSchema.included)){
            for (let x=0; x<jsonSchema.included.length; x++){
                let currEntity = jsonSchema.included[x];
                // Test for miniProfile match
                if (typeof(currEntity['publicIdentifier'])==='string'){
                    profileId = currEntity.publicIdentifier;
                }
            }
        }
        return profileId.toString();
    }
    function parseProfileSchemaJSON(instance,json){
        let profileParseSuccess = false;
        let _this = instance;
        let foundGithub = false;
        let foundPortfolio = false;
        try {
            let db = buildDbFromLiSchema(json);
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
                if (!captured && _this.exportBeyondSpec){
                    captured = true;
                    _outputJson.projects = (_outputJson.projects || []);
                    _outputJson.projects.push({
                        name: attachment.title,
                        startDate: '',
                        summary: attachment.description,
                        url: url
                    });
                }
            });

            // Parse education
            db.getValuesByKey(_liSchemaKeys.education).forEach(function(edu){
                let parsedEdu = {
                    institution : noNull(edu.schoolName),
                    area: noNull(edu.fieldOfStudy),
                    studyType: noNull(edu.degreeName),
                    startDate: '',
                    endDate: '',
                    gpa: noNull(edu.grade),
                    courses : []
                }
                if (edu.timePeriod && typeof(edu.timePeriod)==='object'){
                    if (edu.timePeriod.startDate && typeof(edu.timePeriod.startDate)==='object'){
                        parsedEdu.startDate = edu.timePeriod.startDate.year + '-12-31';
                    }
                    if (edu.timePeriod.endDate && typeof(edu.timePeriod.endDate)==='object'){
                        parsedEdu.endDate = edu.timePeriod.endDate.year + '-12-31';
                    }
                }
                if (Array.isArray(edu.courses)){
                    // Lookup course names
                    edu.courses.forEach(function(courseKey){
                        let courseInfo = db.data[courseKey];
                        if (courseInfo){
                            parsedEdu.courses.push(courseInfo.number + ' - ' + courseInfo.name);
                        }
                        else {
                            if (_this.debug){
                                console.warn('could not find course:');
                                console.warn(courseKey);
                            }
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
                if (position.timePeriod && typeof(position.timePeriod)==='object'){
                    if (position.timePeriod.endDate && typeof(position.timePeriod.endDate)==='object'){
                        parsedWork.endDate = position.timePeriod.endDate.year + '-' + position.timePeriod.endDate.month + '-31';
                    }
                    if (position.timePeriod.startDate && typeof(position.timePeriod.startDate)==='object'){
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
                let parsedVolunteerWork = {
                    organization: volunteering.companyName,
                    position: volunteering.role,
                    website: _this.companyLiPageFromCompanyUrn(volunteering['companyUrn']),
                    startDate: '',
                    endDate: '',
                    summary: volunteering.description,
                    highlights: []
                }
                if (volunteering.timePeriod && typeof(volunteering.timePeriod)==='object'){
                    if (typeof(volunteering.timePeriod.endDate)==='object' && volunteering.timePeriod.endDate!==null){
                        parsedVolunteerWork.endDate = volunteering.timePeriod.endDate.year + '-' + volunteering.timePeriod.endDate.month + '-31';
                    }
                    if (typeof(volunteering.timePeriod.startDate)==='object' && volunteering.timePeriod.startDate!==null){
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
                pushSkill(skillName);
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
            if (_this.exportBeyondSpec){
                _outputJson.projects = (_outputJson.projects || []);
                db.getValuesByKey(_liSchemaKeys.projects).forEach(function(project){
                    let parsedProject = {
                        name: project.title,
                        startDate: '',
                        summary: project.description,
                        url: project.url
                    };
                    if (project.timePeriod && typeof(project.timePeriod)==='object'){
                        parsedProject.startDate = project.timePeriod.startDate + '-12-31';
                    }
                    _outputJson.projects.push(parsedProject);
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
                if (award.issueDate && typeof(award.issueDate)==='object'){
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
                if (typeof(publication.date)==='object' && typeof(publication.date.year)!=='undefined'){
                    parsedPublication.releaseDate = publication.date.year + '-' + publication.date.month + '-' + publication.date.day;
                }
                _outputJson.publications.push(parsedPublication);
            });
            if (_this.debug){
                console.log(_outputJson);
            }
            _this.parseSuccess = true;
            profileParseSuccess = true;
        }
        catch (e){
            if (_this.debug){
                console.error('Error parsing profile schema');
                console.group('Error parsing profile schema');
                    console.log(e);
                    console.log('Instance');
                    console.log(_this);
                console.groupEnd();
            }
            profileParseSuccess = false;
        }
        return profileParseSuccess;
    }
    function pushSkill(skillName){
        // Try to prevent duplicate skills
        let skillNames = _outputJson.skills.map((skill)=>skill.name);
        if (skillNames.indexOf(skillName)==-1){
            _outputJson.skills.push({
                name: skillName,
                level: '',
                keywords: []
            });
        }
    }
    // Constructor
    function LinkedinToResumeJson(OPT_exportBeyondSpec,OPT_debug,OPT_preferApi,OPT_getFullSkills){
        this.scannedPageUrl = '';
        this.parseSuccess = false;
        this.getFullSkills = typeof(OPT_getFullSkills)==='boolean' ? OPT_getFullSkills : true;
        this.exportBeyondSpec = typeof(OPT_exportBeyondSpec)==='boolean' ? OPT_exportBeyondSpec : false;
        this.preferApi = typeof(OPT_preferApi)==='boolean' ? OPT_preferApi : true;
        this.debug = typeof(OPT_debug)==='boolean' ? OPT_debug : false;
        if (this.debug){
            console.warn('LinkedinToResumeJson - DEBUG mode is ON');
        }
    }
    LinkedinToResumeJson.prototype.setExportBeyondSpec = function(setting){
        if (typeof(setting)==='boolean'){
            this.exportBeyondSpec = setting;
        }
    }
    LinkedinToResumeJson.prototype.parseEmbeddedLiSchema = function(){
        let _this = this;
        let doneWithBlockIterator = false;
        let foundSomeSchema = false;
        let possibleBlocks = document.querySelectorAll('code[id^="bpr-guid-"]');
        for (let x=0; x<possibleBlocks.length; x++){
            let currSchemaBlock = possibleBlocks[x];
            if (/educationView/.test(currSchemaBlock.innerHTML) && /positionView/.test(currSchemaBlock.innerHTML)){
                try {
                    let embeddedJson = JSON.parse(currSchemaBlock.innerHTML);
                    // Due to SPA nature, tag could actually be for profile other than the one currently open
                    let desiredProfileId = _this.getProfileId();
                    let schemaProfileId = getProfileIdFromLiSchema(embeddedJson);
                    if (schemaProfileId === desiredProfileId){
                        doneWithBlockIterator = true;
                        foundSomeSchema = true;
                        let profileParserResult = parseProfileSchemaJSON(_this,embeddedJson);
                        if (_this.debug){
                            console.log('Parse from embedded schema, success = ' + profileParserResult);
                        }
                    }
                    else {
                        if (_this.debug){
                            console.log('Valid schema found, but schema profile id of "' + schemaProfileId + '" does not match desired profile ID of "' + desiredProfileId + '".');
                        }
                    }
                }
                catch (e){
                    if (_this.debug){
                        throw(e);
                    }
                    console.warn(e);
                    console.log('Could not parse embedded schema!');
                }
            }
            if (doneWithBlockIterator){
                _this.parseSuccess = true;
                break;
            }
        }
        if (!foundSomeSchema && _this.debug){
            console.warn('Failed to find any embedded schema blocks!');
        }
    }
    // This should be called every time
    LinkedinToResumeJson.prototype.parseBasics = function(){
        this.profileId = this.getProfileId();
        _outputJson.basics.profiles.push({
            "network" : "LinkedIn",
            "username" : this.profileId,
            "url" : "https://www.linkedin.com/in/" + this.profileId + "/"
        });
    }
    LinkedinToResumeJson.prototype.parseViaInternalApi = async function(){
        try {
            let apiSuccessCount = 0;
            let fullProfileEndpointSuccess = false;

            // Get full profile
            let fullProfileView = await this.voyagerFetch(_voyagerEndpoints.fullProfileView);
            if (fullProfileView && typeof(fullProfileView.data)==='object'){
                // Try to use the same parser that I use for embedded
                let profileParserResult = parseProfileSchemaJSON(this,fullProfileView);
                if (profileParserResult){
                    apiSuccessCount++;
                    fullProfileEndpointSuccess = true;
                    if (this.debug){
                        console.log('parseViaInternalApi = true');
                    }
                }
                if (this.debug){
                    console.log(_outputJson);
                }
            }

            // Get full skills, behind voyager endpoint
            if (this.getFullSkills){
                let liType = 'com.linkedin.voyager.identity.profile.Skill';
                let fullSkillsInfo = await this.voyagerFetch(_voyagerEndpoints.fullSkills);
                if (fullSkillsInfo && typeof(fullSkillsInfo.data)==='object'){
                    apiSuccessCount++;
                    let metaData = fullSkillsInfo.data.metadata;
                    if (Array.isArray(fullSkillsInfo.included)){
                        for (let x=0; x<fullSkillsInfo.included.length; x++){
                            let skillObj = fullSkillsInfo.included[x];
                            if (typeof(skillObj.name)==='string'){
                                pushSkill(skillObj.name);
                            }
                        }
                    }
                }
            }

            // Only continue with other endpoints if full profile API failed
            if (!fullProfileEndpointSuccess){
                // Get basic contact info
                let contactInfo = await this.voyagerFetch(_voyagerEndpoints.contactInfo);
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
                    apiSuccessCount++;
                }

                let basicAboutMe = await this.voyagerFetch(_voyagerEndpoints.basicAboutMe);
                if (basicAboutMe && typeof(basicAboutMe.data)==='object'){
                    if (Array.isArray(basicAboutMe.included) && basicAboutMe.included.length > 0){
                        let data = basicAboutMe.included[0];
                        _outputJson.basics.name = data.firstName + ' ' + data.LastName;
                        // Note - LI labels this as "occupation", but it is basically the callout that shows up in search results and is in the header of the profile
                        _outputJson.basics.label = data.occupation;
                        _outputJson.basics.picture = data.picture.rootUrl + data.picture.artifacts[data.picture.artifacts.length-1].fileIdentifyingUrlPathSegment;
                    }
                    apiSuccessCount++;
                }

                let advancedAboutMe = await this.voyagerFetch(_voyagerEndpoints.advancedAboutMe);
                if (advancedAboutMe && typeof(advancedAboutMe.data)==='object'){
                    let data = advancedAboutMe.data;
                    _outputJson.basics.name = data.firstName + ' ' + data.lastName;
                    _outputJson.basics.label = data.headline;
                    _outputJson.basics.summary = data.summary;
                    apiSuccessCount++;
                }
            }

            if (this.debug){
                console.log(_outputJson);
            }
            if (apiSuccessCount > 0){
                this.parseSuccess = true;
            }
            else {
                if (this.debug){
                    console.error('Using internal API (Voyager) failed completely!');
                }
            }
        }
        catch (e){
            console.warn(e);
            console.log('Error parsing using internal API (Voyager)');
        }
    }
    LinkedinToResumeJson.prototype.triggerAjaxLoadByScrolling = async function(cb){
        cb = typeof(cb)==='function' ? cb : function(){};
        if (!_scrolledToLoad){
            // Capture current location
            let startingLocY = window.scrollY;
            // Scroll to bottom
            function scrollToBottom(){
                let maxHeight = document.body.scrollHeight;
                window.scrollTo(0,maxHeight);
            }
            scrollToBottom();
            await new Promise((resolve,reject)=>{
                setTimeout(function(){
                    scrollToBottom();
                    window.scrollTo(0,startingLocY);
                    _scrolledToLoad = true;
                    resolve();
                    cb();
                },400);
            });
        }
        else {
            cb();
        }
        return true;
    }
    LinkedinToResumeJson.prototype.forceReParse = async function(){
        _scrolledToLoad = false;
        this.parseSuccess = false;
        await this.tryParse();
    }
    LinkedinToResumeJson.prototype.tryParse = async function(){
        let _this = this;
        return new Promise(async (resolve,reject) => {
            if (this.parseSuccess && this.scannedPageUrl !== this.getUrlWithoutQuery()){
                // Parse already done, but page changed (ajax)
                await this.forceReParse();
                resolve(true);
            }
            else {
                this.triggerAjaxLoadByScrolling(async function(){
                    _this.parseBasics();
                    _this.parseEmbeddedLiSchema();
                    if (!_this.parseSuccess || _this.preferApi){
                        await _this.parseViaInternalApi();
                    }
                    _this.scannedPageUrl = _this.getUrlWithoutQuery();
                    resolve(true);
                });
            }
        });
    }
    LinkedinToResumeJson.prototype.parseAndShowOutput = async function(){
        await this.tryParse();
        let parsedExport = {
            raw: _outputJson,
            stringified: JSON.stringify(_outputJson,null,2)
        };
        console.log(parsedExport);
        if (this.parseSuccess){
            this.showModal(parsedExport.raw);
        }
        else {
            alert('Could not extract JSON from current page. Make sure you are on a profile page that you have access to');
        }
    }
    LinkedinToResumeJson.prototype.closeModal = function(){
        let modalWrapperId = _toolPrefix + '_modalWrapper';
        let modalWrapper = document.getElementById(modalWrapperId);
        if (modalWrapper){
            modalWrapper.style.display = 'none';
        }
    }
    LinkedinToResumeJson.prototype.showModal = function(jsonResume){
        let _this = this;
        // @TODO
        let modalWrapperId = _toolPrefix + '_modalWrapper';
        let modalWrapper = document.getElementById(modalWrapperId);
        if (modalWrapper){
            modalWrapper.style.display = 'block';
        }
        else {
            _this.injectStyles();
            modalWrapper = document.createElement('div');
            modalWrapper.id = modalWrapperId;
            modalWrapper.innerHTML = ``
            + `<div class="${_toolPrefix}_modal">`
            +     `<div class="${_toolPrefix}_topBar">`
            +         `<div class="${_toolPrefix}_titleText">Profile Export:</div>`
            +         `<div class="${_toolPrefix}_closeButton">X</div>`
            +     `</div>`
            +     `<div class="${_toolPrefix}_modalBody">`
            +         `<textarea id="${_toolPrefix}_exportTextField">Export will appear here...</textarea>`
            +     `</div>`
            + `</div>`;
            document.body.appendChild(modalWrapper);
            // Add event listeners
            modalWrapper.addEventListener('click',function(evt){
                // Check if click was on modal content, or wrapper (outside content, to trigger close)
                if (evt.target.id === modalWrapperId){
                    _this.closeModal();
                }
            });
            modalWrapper.querySelector('.' + _toolPrefix + '_closeButton').addEventListener('click',function(evt){
                _this.closeModal();
            });
            var textarea = modalWrapper.querySelector('#' + _toolPrefix + '_exportTextField');
            textarea.addEventListener('click',function(evt){
                textarea.select();
            });
        }
        // Actually set textarea text
        modalWrapper.querySelector('#' + _toolPrefix + '_exportTextField').value = JSON.stringify(jsonResume,null,2);
    }
    LinkedinToResumeJson.prototype.injectStyles = function(){
        if (!_stylesInjected){
            let styleElement = document.createElement('style');
            styleElement.innerText = `` +
            `#${_toolPrefix}_modalWrapper {` +
                `width: 100%;` +
                `height: 100%;` +
                `position: fixed;` +
                `top: 0;` +
                `left: 0;` +
                `background-color: rgba(0, 0, 0, 0.8);` +
                `z-index: 99999999999999999999999999999999` +
            `}` +
            `.${_toolPrefix}_modal {` +
                `width: 80%;` +
                `margin-top: 10%;` +
                `margin-left: 10%;` +
                `background-color: white;` +
                `padding: 20px;` +
                `border-radius: 13px;` +
            `}` +
            `.${_toolPrefix}_topBar {` +
                `width: 100%;` +
                `position: relative;` +
            `}` +
            `.${_toolPrefix}_titleText {` +
                `text-align: center;` +
                `font-size: x-large;` +
                `width: 100%;` +
                `padding-top: 8px;` +
            `}` +
            `.${_toolPrefix}_closeButton {` +
                `position: absolute;` +
                `top: 0px;` +
                `right: 0px;` +
                `padding: 0px 8px;` +
                `margin: 3px;` +
                `border: 4px double black;` +
                `border-radius: 10px;` +
                `font-size: x-large;` +
            `}` +
            `.${_toolPrefix}_modalBody {` +
                `width: 90%;` +
                `margin-left: 5%;` +
                `margin-top: 20px;` +
                `padding-top: 8px;` +
            `}` +
            `#${_toolPrefix}_exportTextField {` +
                `width: 100%;` +
                `min-height: 300px;` +
            `}`;
            document.body.appendChild(styleElement);
        }
    }
    LinkedinToResumeJson.prototype.getUrlWithoutQuery = function(){
        return document.location.origin + document.location.pathname;
    }
    LinkedinToResumeJson.prototype.getJSON = function(){
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
    LinkedinToResumeJson.prototype.getProfileId = function(){
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
    LinkedinToResumeJson.prototype.companyLiPageFromCompanyUrn = function(companyUrn){
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
    LinkedinToResumeJson.prototype.voyagerFetch = async function(endpoint){
        let _this = this;
        // Macro support
        endpoint = endpoint.replace('{profileId}',this.profileId);
        if (!endpoint.startsWith('https')){
            endpoint = _voyagerBase + endpoint;
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
                if (_this.debug){
                    console.log(fetchOptions);
                }
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
    return LinkedinToResumeJson;
})();