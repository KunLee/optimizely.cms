if (typeof $$epiforms !== 'undefined') {

    var $body = $("body");
    var $loadingDiv = $('<div class="modal"></div>');
    $body.append($loadingDiv);
    epi.EPiServer.Forms.AsyncSubmit = true;

    $$epiforms(document).ready(function myfunction() {
        // listen to event when form is about submitting
        $$epiforms(".EPiServerForms").on("formsStartSubmitting", function (data) {
            //var $formContainer = $('#' + data.workingFormInfo.Id);
            //$formContainer.addClass("loading");
            $body.addClass('loading');
        });

        // listen to event when form is successfully submitted
        $$epiforms(".EPiServerForms").on("formsSubmitted", function (data) {
            $body.removeClass('loading');
        });

        // formsSubmittedError
        $$epiforms(".EPiServerForms").on("formsSubmittedError", function (data) {
            $body.removeClass('loading');
        });
    });
}