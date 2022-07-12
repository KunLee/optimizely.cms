/*
This EPiServerForms_prerequisite.js TEMPLATE will be compiled with serverside values and injected into ViewMode page
We reuse the existed global var epi from EPiServer CMS, if any. It will init/grab the epi object, and init epi.EPiServer.Forms object
*/

// (by default) Forms's jQuery will be injected right before this file. From now on, we refer Forms own jQuery as $$epiforms.
// after this code, the object $ and jQuery will revert back to its original meaning in original library (Alloy jQuery or other lib).

// Our clients' sites may include their own Jquery version (e.g. a higher version for some special functionalities), which leads to unexpected conflicts with ours.
// To avoid this, we use jQuery.noConflict()  to set up $$epiforms as an allias for our jquery and then, revert Jquery allias to clients' by using
// epi.EPiServer.Forms.OriginalJQuery whose value is set up as Jquery at the beginning in FormBlockController.
// This also allows us to extend our own Jquery's functionalities without causing further conflicts.

var $$epiforms = epi.EPiServer.Forms.InjectFormOwnJQuery ? jQuery.noConflict() : jQuery;
if (epi.EPiServer.Forms.OriginalJQuery) {
    jQuery = epi.EPiServer.Forms.OriginalJQuery;
    delete epi.EPiServer.Forms.OriginalJQuery;
}
(function () {
    var externalScript = ___ExternalScriptSources___,
        externalCss = ___ExternalCssSources___;

    if (epi.EPiServer.Forms.ExternalScriptSources) {
        externalScript = epi.EPiServer.Forms.ExternalScriptSources.concat(externalScript);
        // Remove duplicate items
        externalScript = externalScript.filter(function (value, index, self) {
            return self.indexOf(value) === index;
        });
    }
    if (epi.EPiServer.Forms.ExternalCssSources) {
        externalCss = epi.EPiServer.Forms.ExternalCssSources.concat(externalCss);
        // Remove duplicate items
        externalCss = externalCss.filter(function (value, index, self) {
            return self.indexOf(value) === index;
        });
    }

    $$epiforms.extend(true, epi.EPiServer, {
        CurrentPageLink: "___CurrentPageLink___",
        CurrentPageLanguage: "___CurrentPageLanguage___",
        CurrentFormLanguage: "___CurrentFormLanguage___",
        Forms: {
            Utils: {}, Data: {}, Extension: {}, Validation: {}, Navigation: {}, Dependency: {},
            $: $$epiforms,  // save our own link to our own jQuery
            ThrottleTimeout: 500,  // miliseconds
            ExternalScriptSources: externalScript,
            ExternalCssSources: externalCss,
            UploadExtensionBlackList: "___UploadExtensionBlackList___",
            Messages: ___Messages___,
            LocalizedResources: ___LocalizedResources___
        }
    });
})();
