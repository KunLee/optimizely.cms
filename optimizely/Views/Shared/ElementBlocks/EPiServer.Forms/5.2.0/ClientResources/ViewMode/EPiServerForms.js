/*eslint no-undef: "error"*/
/*eslint no-use-before-define: "off"*/
/*eslint no-console: "off"*/
/*eslint space-in-parens: "off"*/
/*global $$epiforms $ removeFormDataInStorage epi:true*/


/* This EPiServerForms.js file will be injected into ViewMode page by ClientScriptRegister, as WebResource URL
These functionality will be performed by this script:
 - client validation of FormElement
 - step depends on FormElement
 - posting to the EPiForms controller
 - clientside interaction, step navigation
*/


(function ($) {
    if (typeof (epi) == "undefined" || typeof (epi.EPiServer) == "undefined" || typeof (epi.EPiServer.Forms) == "undefined") {
        console.error("Forms is not initialized correctly.");
        return;
    }
    if (typeof ($) == "undefined") {
        console.error("Forms cannot work without jQuery.");
        return;
    }

    /////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////
    var DependantController = function ( /*Object*/ dependantInfo, /*Object*/ settings) {
        // summary:
        //     Validation for conditions of list dependees
        // tags:
        //      public

        this.workingFormInfo = settings.workingFormInfo;
        this.dependantInfo = dependantInfo;
        this.$domElement = _utilsSvc.getFormElementBlock(dependantInfo.fieldName, this.workingFormInfo.$workingForm); // DOM element object having dependency
        this.onDependencyStateChanged = settings.onDependencyStateChanged;

        this.dependency = new epi.EPiServer.Forms.Dependency.Dependant(dependantInfo, settings.workingFormInfo);
        this._registerEventListener(this.dependency);

        // initial set up
        this.isSatisfied = this.dependency.isSatisfied;

        if (typeof this.onDependencyStateChanged === "function") {
            this.onDependencyStateChanged(this.$domElement, this.dependantInfo, this.isSatisfied);
        }

        this.check();
    };

    DependantController.prototype = {

        // listen for state change on dependency
        _registerEventListener: function (dependency) {
            var self = this;
            $(dependency).on("change", function (e, state) {
                self.onDependencyChangeHandler.call(self, state);
            });
        },

        // handler when Dependency's state changes
        onDependencyChangeHandler: function ( /*Object*/ state) {
            if (this.isSatisfied !== state.isSatisfied) {
                this.isSatisfied = state.isSatisfied;
                this._executeAction();
                if (typeof this.onDependencyStateChanged === "function") {
                    this.onDependencyStateChanged(this.$domElement, this.dependantInfo, this.isSatisfied);
                }

                $(this.$domElement).trigger("formsDependencyStateChanged");
            }
        },

        // run checking state of dependency
        check: function () {
            this.dependency.runCheck();
        },

        // execute action when dependency state changes (from satisfied to not-satisfied and vice versace)
        _executeAction: function () {
            if (this.dependantInfo.action) {
                var availableActions = epi.EPiServer.Forms.Dependency.Actions,
                    actionName = this.dependantInfo.action.clientsideAction;

                if (availableActions[actionName] && typeof (availableActions[actionName]) === "function") {
                    availableActions[actionName](this);
                }
            }
        }
    };

    /////////////////////////////////////////////////////////////////////
    // decorate the dependantInfo (model, from Editor, configured in EditView) with methods
    /////////////////////////////////////////////////////////////////////
    var Dependant = function ( /*Object*/ dependantInfo, /*Object*/ workingFormInfo) {
        // summary:
        //     Validation for conditions of a depenedee
        // tags:
        //      pulbic

        this.workingFormInfo = workingFormInfo;
        this.conditions = dependantInfo.conditions;
        this.conditionCombination = dependantInfo.conditionCombination;
        this.isSatisfied = null;
        this._registerEventListener();
    };
    Dependant.prototype = {
        // listener for changes of dependee
        _registerEventListener: function () {
            if (!this.conditions || this.conditions.length <= 0) {
                return;
            }

            var self = this,
                registeredFields = []; // fields which already registered event listener

            // register event when value of each element form changed
            for (var i = 0; i < this.conditions.length; i++) {
                var condition = this.conditions[i];

                // only register once for each field
                if (registeredFields.indexOf(condition.fieldName) === -1) {
                    var $element = _utilsSvc.getFormElementBlock(condition.fieldName, this.workingFormInfo.$workingForm),
                        $inputElement = $("[data-f-datainput]", $element),
                        eventNames = _dependencySvc._getTriggerEventsForDependeeElement($element);

                    if (eventNames && eventNames.length > 0) {
                        $.each(eventNames, function (index, eventName) {
                            // event like keyup, keypress, key down..
                            if (eventName !== "change") {
                                /*
                                    With textbox or textarea element, Instead of depending of change event (lose focus) we listen to keyup event along with debouce to track the change of its value. By doing this, users don't have to lose focus on textbox element when using form, which is more convenient and makes much sense.
                               */
                                $inputElement[eventName](_utilsSvc.debounce(function (e) {
                                    e.stopPropagation();
                                    self._handleValueChange();
                                }, epi.EPiServer.Forms.ThrottleTimeout, self));
                            } else {
                                $inputElement[eventName](function () {
                                    self._handleValueChange.apply(self);
                                });
                            }
                        });
                    }

                    $($element).on("formsDependencyStateChanged", function (e, data) {
                        self._handleValueChange.apply(self);
                    });

                    registeredFields.push(condition.fieldName);
                }
            }
        },

        // fire point to check dependent conditions
        runCheck: function () {
            this._handleValueChange();
        },

        // handle when value of dependee changed
        _handleValueChange: function () {
            var previousState = this.isSatisfied;
            this.isSatisfied = this._checkSatisfaction();
            // if state has been changed, trigger change event
            this.isSatisfied !== previousState && $(this).trigger("change", {
                isSatisfied: this.isSatisfied
            }); // trigger on dependency changes
        },

        // perform checking to see if element's value matches depend conditions
        _checkSatisfaction: function () {
            // no condition to check, return true
            if (!this.conditions || this.conditions.length <= 0) {
                return true;
            }

            for (var i = 0; i < this.conditions.length; i++) {
                var condition = this.conditions[i],
                    fieldState = this._getFieldState(condition.fieldName),
                    dependConditionFunc = epi.EPiServer.Forms.DependConditions[condition.operator];

                if (typeof dependConditionFunc === "function") {
                    var isSatisfied = dependConditionFunc(fieldState.value, condition.fieldValue);

                    if (isSatisfied && this.conditionCombination === epi.EPiServer.Forms.Dependency.ConditionCombinations.Any) {
                        return true;
                    }

                    if (!isSatisfied && this.conditionCombination !== epi.EPiServer.Forms.Dependency.ConditionCombinations.Any) {
                        return false;
                    }
                }
            }

            // when reach here, there are two cases
            // 1 : Not all conditions are statisfied and ConditionCombination === ConditionCombinations.All
            // 2 : None condition is statisfied and ConditionCombination === ConditionCombinations.Any
            return !(this.conditionCombination === epi.EPiServer.Forms.Dependency.ConditionCombinations.Any);
        },

        // get field state for checking satisfaction
        _getFieldState: function ( /*String*/ fieldName) {
            var $element = _utilsSvc.getFormElementBlock(fieldName, this.workingFormInfo.$workingForm); // dependee element
            if (!$element) {
                return null;
            }

            // get value that user entered
            var inputedValue = epi.EPiServer.Forms.Dependency._getValueOfDependeeElement($element, this.workingFormInfo);

            return {
                value: inputedValue
            };
        }
    };


    var _utilsSvc = epi.EPiServer.Forms.Utils,
        _dataSvc = epi.EPiServer.Forms.Data,
        _extensionSvc = epi.EPiServer.Forms.Extension,
        _validationSvc = epi.EPiServer.Forms.Validation,
        _navigationSvc = epi.EPiServer.Forms.Navigation,
        _dependencySvc = epi.EPiServer.Forms.Dependency;

    /// All metadata for Forms in ClientSide will stay inside EPiServer.Forms object
    epi.EPiServer.Forms.__DebounceTimer = null;
    epi.EPiServer.Forms.__Initialized = !(epi.EPiServer.Forms.__Initialized === undefined); // a flag to know does the EPiServerForms.js.init() ever run? We can have multiple reference, but should run Forms.init() once.


    /// adding some statical utils functions
    /// ===========================
    $.extend(true, epi.EPiServer.Forms, {
        Utils: {

            // - delay the call of fn by using setTimeout, only execute the **last** call to fn after delay.
            // - scope param: Scope which the context of setTimeout and clearTimeout function is applied to. The default scope is 'epi.EPiServer.Forms' if scope is not passed
            //                With field dependency, scope param must be passed in order to work properly
            debounce: function ( /*function*/ fn, /*number, milisecond*/ delay, /*object*/ scope) {
                return function () {
                    var context = this,
                        args = arguments,
                        delayCall = function (context, fn, args, scope) {
                            clearTimeout(scope.__DebounceTimer);
                            scope.__DebounceTimer = setTimeout(function () {
                                fn.apply(context, args);
                            }, delay);
                        };
                    delayCall(context, fn, args, scope || epi.EPiServer.Forms);
                };
            },

            //Check if field is in the inactive list
            isInactiveField: function (workingFormInfo, fieldId) {
                return _dependencySvc._isInactiveElement(fieldId, workingFormInfo);
            },

            // load script (by injecting <script> into <head>) from sScriptSrcList. When done, call oCallback
            loadExternalScriptOnDemand: function ( /*array of String*/ scriptSourceList, /*function*/ oCallback, async) {

                var oHead = document.getElementsByTagName("head")[0],
                    itemIndex = 0,
                    totalItems = scriptSourceList.length,
                    item = null,
                    oScript = null;

                _utilsSvc.LoadedScripts = _utilsSvc.LoadedScripts || [];

                for (; itemIndex < totalItems; itemIndex++) {
                    item = scriptSourceList[itemIndex];

                    if (_utilsSvc.LoadedScripts.indexOf(item) >= 0) {
                        continue;
                    }

                    // this script has not been loaded before
                    oScript = document.createElement("script");
                    oScript.type = "text/javascript";
                    oScript.async = async || false;
                    oScript.defer = async || false;
                    oScript.src = item;

                    oHead.appendChild(oScript);

                    // mark script as loaded
                    _utilsSvc.LoadedScripts.push(item);
                }

                oScript ? _utilsSvc._setupCallback(oScript, oCallback) : oCallback();
            },

            // Load css file from <param>cssSourceList</param>, when done, call oCallback
            loadExternalCssOnDemand: function ( /*array of String*/ cssSourceList, /*function*/ oCallback) {
                var oHead = document.getElementsByTagName("head")[0],
                    itemIndex = 0,
                    totalItems = cssSourceList.length,
                    item = null;

                for (; itemIndex < totalItems; itemIndex++) {
                    item = cssSourceList[itemIndex];

                    var linkTag = document.createElement("link");
                    linkTag.setAttribute("rel", "stylesheet");
                    linkTag.setAttribute("type", "text/css");
                    linkTag.setAttribute("href", item);

                    oHead.appendChild(linkTag);

                    if (itemIndex === totalItems - 1) {
                        _utilsSvc._setupCallback(linkTag, oCallback);
                    }
                }
            },

            // setup callback after element is loaded
            _setupCallback: function (element, oCallback) {
                // TECHNOTE: do callback after loading, for most browsers
                if (typeof (oCallback) === "function") {
                    element.onload = oCallback;
                    // for IE 6 & 7
                    element.onreadystatechange = function () {
                        if (this.readyState === "complete") {
                            oCallback();
                        }
                    };
                }
            },

            // return a string from a format string and corresponding arguments.
            // null, empty argument will be replaced as ""
            // Example: var selector = _utilsSvc.stringFormat("{0}{1}{2}", [1, 2, 3]) will return "123";
            stringFormat: function ( /*string*/ formatString, /*array*/ args) {
                var s = formatString,
                    i = args.length;
                while (i--) {
                    s = s.replace(new RegExp("\\{" + i + "\\}", "gm"), args[i] || "");
                }
                return s;
            },

            // return concatination string if input is an array
            // Example: getConcatString([1,2,3], "&") returns "1&2&3"
            getConcatString: function (srcObject, seperator) {
                return (srcObject instanceof Array) ? srcObject.join(seperator) : srcObject;
            },

            // return HTML encoded string from given originalString
            htmlEncodeEntities: function (originalString) {
                return $("<div></div>").text(originalString).html();
            },

            /// Decode HTML string
            /// This technique is better than .replace() solution, because it can render UTF-8 escaped when we use <%: TextHere %> on server-side
            /// remark: source is from http://stackoverflow.com/a/1395954/161471
            htmlDecodeEntities: function (encodedString) {
                var textArea = document.createElement("textarea");
                textArea.innerHTML = encodedString;
                return textArea.value;
            },

            // Return true if the value string matches with the RegEx pattern.
            isMatchedReg: function (value, regex) {
                try {
                    var rx = new RegExp(regex), // default settings: global = false, multiline = false (causes ^ and $ to match begin and end of string), ignoreCase = false
                        matches = rx.exec(value);
                    return (matches != null && matches.length > 0);
                } catch (e) {
                    console.debug(e.message);
                    return false;
                }
            },

            // raise custom jQuery event on workingFormInfo.$workingForm. ExtraInfo will be used to mixed into event object
            raiseFormsEvent: function (workingFormInfo, extraInfo) {
                var event = $.extend(true, {
                    type: "forms",
                    workingFormInfo: workingFormInfo
                }, extraInfo);

                if (workingFormInfo) {
                    workingFormInfo.$workingForm.triggerHandler(event);
                } else {
                    var $containerToRaise = $('.EPiServerForms:eq(0), [data-f-type="form"]:first'); // raise on first FormContainer, so it will not duplicated
                    if (!$containerToRaise || $containerToRaise.length < 1) {
                        $containerToRaise = $("body");
                    }
                    $containerToRaise.triggerHandler(event);
                }
            },

            /// Injects visitor data to hidden field of the working form
            injectVisitorData: function (workingFormInfo) {

                var $visitorDataSourcesElements = $(".FormHidden[data-epiforms-visitordatasources], [data-f-visitordatasources]", workingFormInfo.$workingForm);
                if (!$visitorDataSourcesElements || $visitorDataSourcesElements.length === 0) {
                    return;
                }

                var $targetElement = null;
                $visitorDataSourcesElements.each(function () {
                    $targetElement = $(this);
                    if ($targetElement && $targetElement.length > 0) {
                        var func = null;
                        var visitordatasources = $targetElement.data("epiforms-visitordatasources") || $targetElement.data("f-visitordatasources");
                        $(visitordatasources.split(",")).each(function (index, visitorDataSource) {
                            func = epi.EPiServer.Forms.VisitorData[visitorDataSource];
                            if (typeof func === "function") {
                                func($targetElement);
                            }
                        });
                    }
                });

            },

            // indicate element type from data-f-type attribute
            isElementType: function ( /*element container*/ $element, /*String: textbox, selection,...*/ name) {
                return $element.data("f-type") === name;
            },

            // get name of element, from name or data-f-name attribute
            getElementName: function ($element) {
                return $element.attr("name") || $element.data("epiforms-element-name") || $element.data("f-element-name");
            },

            // get value of element ($element must be a DOM of .Form__Element), base on its type, we will have different process (because get value from textbox is different from getting value from :radio)
            getElementValue: function ($element) {

                if ($element.hasClass("FormFileUpload") || _utilsSvc.isElementType($element, "fileupload")) {
                    return _utilsSvc.getPreviousPostedFiles($element);
                }

                if ($element.hasClass("FormChoice") || _utilsSvc.isElementType($element, "choice")) {
                    // get contained checkbox|radio value
                    // always store as Array (because it can be multiple selected, and has multiple values)
                    var childValue = $element.find(".FormChoice__Input:checked, [data-f-datainput]:checked")
                        .map(function (index, item) {
                            return $(item).val();
                        })
                        .get(); // convert to pure array
                    return childValue;
                }

                if ($element.hasClass("FormSelection") || _utilsSvc.isElementType($element, "selection")) {
                    // always should be array of values
                    //var alphaNumeric = ['a', 'b', 'c'].concat(1, [2, 3]); ===> Result: ['a', 'b', 'c', 1, 2, 3]
                    return [].concat($element.find("select").val()); // always return as array of values
                }

                //case "textbox" base
                if ($element.hasClass("FormCaptcha") || $element.hasClass("FormTextbox") || $element.hasClass("FormTextbox--Textarea") ||
                    _utilsSvc.isElementType($element, "captcha") || _utilsSvc.isElementType($element, "textbox")) {
                    return $(".FormTextbox__Input, [data-f-datainput]", $element).val().trim();
                }

                // range element
                if ($element.hasClass("FormRange") || _utilsSvc.isElementType($element, "range")) {
                    return $(".FormRange__Input, [data-f-datainput]", $element).val().trim();
                }

                // custom element
                if ($element.hasClass("Form__CustomElement") || _utilsSvc.isElementType($element, "custom")) {
                    return epi.EPiServer.Forms.Extension.getCustomElementValue($element);
                }

                // simple form input like hidden input will goes here
                return _utilsSvc.getNonSpecificElementValue($element);
            },

            // get a form element block of a working form according to its name.
            getFormStepBlock: function (blockName, $workingForm) {
                console.warn("This is obsolete. Use getFormElementBlock() instead.");
                return _utilsSvc.getFormElementBlock(blockName, $workingForm);
            },

            // get a form element block of a working form according to its name.
            getFormElementBlock: function (blockName, $workingForm) {
                if (!blockName) {
                    return [];
                }
                var blockElement = $(".Form__Element [data-epiforms-element-name='" + blockName + "']", $workingForm);
                if (!blockElement || blockElement.length === 0) {
                    blockElement = $("[data-f-element-name='" + blockName + "']", $workingForm);
                }
                return blockElement;
            },

            getWorkingFormFromInnerElement: function ( /*Object*/ source) {
                /// TECHNOTE: we assume the $workingForm and workingFormInfo by look "up" to the ancestor of this DOM Element "source"
                var formElement = $(source).parents(".EPiServerForms:first, [data-f-type='form']:first");
                return formElement;
            },

            getFormIdentifier: function ($workingForm) {
                // summary:
                //      Get form's identifier, this now will be the Guid of the form, to lookup in metadata for Steps, Descriptors, ...
                // tags:
                //      public

                return $workingForm.prop("id");
            },

            getPreviousPostedFiles: function ($fileUploadElement) {
                // summary:
                //      Gets previous posted file from storage.
                // tags:
                //      pulbic


                var $inputElement = $fileUploadElement.find(".FormFileUpload__Input, [data-f-datainput]"),
                    elementName = _utilsSvc.getElementName($inputElement),
                    $workingForm = _utilsSvc.getWorkingFormFromInnerElement($inputElement),
                    identifier = epi.EPiServer.Forms.Utils.getFormIdentifier($workingForm),
                    formData = epi.EPiServer.Forms.Data.loadFormDataFromStorage(identifier),
                    elementValue = $inputElement[0].files; // the file upload's current chosen files
                // Step can be Next/Prev, file is uploaded at Next, but user can Prev then Next again without chosen another file causes Required validator fail,
                // need to assign the chosen and uploaded file (the stored one) to it
                $.each(formData, function (name, val) {
                    // look for associate fileupload __TempData and assign its stored file names
                    if (name.indexOf("__TempData") > -1 && name.replace("__TempData", "") == elementName && elementValue.length === 0) {
                        elementValue = val;

                        return false;
                    }
                });

                return elementValue;
            },

            getNonSpecificElementValue: function ($element) {
                // summary:
                //      Support getting element value in case the element does not have specific classes like FormChoice, FormSelection,...
                // tags:
                //      public

                if (!$element.attr("data-f-element-name")) {
                    return $element.val().trim();
                }

                var innerElements = $element.find(":input");

                if (innerElements.length === 0) {
                    return $element.val().trim();
                }

                if (innerElements[0].tagName.toLowerCase() != "input") {
                    return $(innerElements[0]).val().trim();
                }

                // If element type is checkbox or radio button, then get values and store as Array
                // (because it can be multiple selected, and has multiple values)
                var elementType = innerElements[0].type.toLowerCase();

                if (elementType == "checkbox" || elementType == "radio") {
                    var values = innerElements.filter(":checked").map(function (index, item) {
                        return $(item).val();
                    }).get();
                    return values;
                }
                return $(innerElements[0]).val().trim();
            },

            // summary:
            //      get the first step that matching currentPageLink
            //      if return -1, it mean some step(s) is configured to a page, but nothing match this page
            //      if return NaN, it means malform data happened. Someone set the wrong data to the __FormCurrentStepIndex hiddenInput
            // tags:
            //      public
            getCurrentStepIndex: function (workingFormInfo) {
                var currentStepIndex = $("input[name=__FormCurrentStepIndex]", workingFormInfo.$workingForm).val();

                // if value in the hiddenInput is undetermined, we try to inspect from form metadata
                if (currentStepIndex === undefined ||
                    currentStepIndex.trim() === "" ||
                    isNaN(+currentStepIndex) // we do nothing with malform CurrentStepIndex. Something is wrong with the Form initialization.
                    ||
                    +currentStepIndex > workingFormInfo.StepsInfo.Steps.length - 1 // stepIndex is bigger than stepCount
                ) {

                    // all step are not configured to contentLink, display the first step on this page
                    if (workingFormInfo.StepsInfo.AllStepsAreNotLinked) {
                        currentStepIndex = 0;
                    } else {
                        // steps are linked then figure out from the StepsInfo based on pageLink and its denpendent condition
                        $.each(workingFormInfo.StepsInfo.Steps, function (i, step) {
                            if (step.attachedContentLink == epi.EPiServer.CurrentPageLink &&
                                _extensionSvc.isStepSatisfyDependentCondition(step, workingFormInfo)) {
                                currentStepIndex = i;
                                return false; // break on first one
                            }
                        });
                    }
                } else {
                    currentStepIndex = +currentStepIndex; // convert to number
                }

                return currentStepIndex;
            },

            // Set the zero-base stepIndex
            //      if return -1, it mean some step(s) is configured to a page, but nothing match this page
            //      if return NaN, it mean no step is configured to any page
            setCurrentStepIndex: function (workingFormInfo, stepIndex) {
                $("input[name=__FormCurrentStepIndex]", workingFormInfo.$workingForm).val(stepIndex);
                return stepIndex;
            },

            validateRegularExpressionValidator: function (fieldName, fieldValue, validatorMetaData) {
                // summary:
                //      VALIDATE DATAVALUE
                // fielName: String
                //      Name of the field to be validated.
                // fieldValue: [Object]
                //      User input value for the field.
                // validatorMetaData: [Object]
                //      Validation meta data for the current element
                // returns: Object
                // tags:
                //      private

                // Validate element's data based on "validate as" type
                if (!validatorMetaData || !validatorMetaData.model || !validatorMetaData.model.jsPattern || fieldValue === "") {
                    // This element is valid
                    return {
                        isValid: true
                    };
                }

                if (!_utilsSvc.isMatchedReg(fieldValue, validatorMetaData.model.jsPattern)) {
                    // also put the validatior.Description as help-tip for Visitor
                    var message = _utilsSvc.stringFormat(validatorMetaData.model.message, [validatorMetaData.model.jsPattern, validatorMetaData.description]);

                    return {
                        isValid: false,
                        message: message
                    };
                }

                return {
                    isValid: true
                };
            },

            // After the user presses the enter key, the next button will be triggered in place of submit button or submit event.
            showNextStepOnEnterKeyDown: function (e) {
                var $workingForm = _utilsSvc.getWorkingFormFromInnerElement(e.target),
                    keyCode = e.keyCode,
                    $nextStepButton = $(".Form__NavigationBar .Form__NavigationBar__Action.btnNext, [data-f-type='navigationbar'] [data-f-navigation-next]", $workingForm), // Access the nextStep Button.

                    // retrieve step sections visible on screen that contains a submit button.
                    $buttonSubmitSections = $(".Form__Element.FormSubmitButton, [data-f-type='submitbutton']", $workingForm).parent(".FormStep, [data-f-type='step']").filter(function (index) {
                        return !$(this).hasClass("hide"); // only retrieve the section visible on the screen
                    });

                // trigger next button's click event as the user presses enter to trigger submit handler and submission in this step is not allowed.
                if (keyCode === 13 && $buttonSubmitSections.length === 0 && $nextStepButton != null && $nextStepButton.length) {
                    e.preventDefault();
                    e.stopPropagation();
                    $nextStepButton.trigger("click");
                    return true;
                }

                return true;
            },

            // Scroll to the top of Form after navigating from current step to another.
            scrollToTheTopOfForm: function ($workingForm) {
                if ($workingForm != null && ($workingForm.css("position").toLowerCase() !== "fixed") && ($(document).scrollTop() > 0)) {
                    window.scrollTo(0, $workingForm.offset().top);
                }
            }
        },

        // Allow customized code to change EpiForm JS API behaviours
        Extension: {

            // summary:
            //      Gets summarized text based on form fields
            // tag: public virtual
            getSummarizedText: function (workingFormInfo, data, displayAsHtmlContent) {
                // workingFormInfo.ElementsInfo: contains friendlyName for each field code

                var newLineString = displayAsHtmlContent ? "<br/>" : "\n",
                    confirmMessage = displayAsHtmlContent ? workingFormInfo.ConfirmMessage : _utilsSvc.htmlDecodeEntities(workingFormInfo.ConfirmMessage),
                    elementsInfo = workingFormInfo.ElementsInfo,
                    addedKeys = [],
                    shouldBeHiddenKeys = [],
                    ignoreFields = ["__FormGuid", "__FormLanguage", "__FormCurrentStepIndex", "__FormSubmissionId"],
                    summarizedText = workingFormInfo.ConfirmMessage ? confirmMessage + newLineString + newLineString : "",
                    friendlyName = null,
                    dataValue = null;

                // Note: the given data is a merging from stored value and the currentStep value, and then an stored empty FileList will become an empty object (not a FileList)

                for (var key in data) {
                    // exclude the __TempData key which its associcate key has been added
                    if (addedKeys.indexOf(key.replace("__TempData", "")) > -1) {
                        continue;
                    }

                    // ignore the field which is in the inactive list
                    if (_utilsSvc.isInactiveField(workingFormInfo, key)) {
                        continue;
                    }

                    var elementInfo = key.indexOf("__TempData") > -1 ?
                        elementsInfo[key.replace("__TempData", "")] :
                        elementsInfo[key];

                    friendlyName = elementInfo && elementInfo.friendlyName ? elementInfo.friendlyName : "";
                    dataValue = elementInfo && elementInfo.customBinding == true ?
                        epi.EPiServer.Forms.CustomBindingElements[elementInfo.type](elementInfo, data[key]) :
                        data[key];

                    if (dataValue == null || (dataValue instanceof Array && dataValue.length === 0) || $.isEmptyObject(dataValue)) {
                        dataValue = "";
                    }

                    if (dataValue instanceof Array) {

                        // take all the name, transform, concat with comma
                        dataValue = $.map(dataValue, function (o, i) {
                            if (!o) {
                                return null; // ignore this value in current loop, go to next item
                            }
                            if (typeof o === "string") {
                                return o; // multiple checkbox (dataValue  will be array of string)
                            } else if (typeof o === "object") { // File upload value
                                return o.name; // file element, (dataValue  will be array of File object),
                            }
                        }).join(", ");
                    } else if ((dataValue instanceof FileList && dataValue.length === 0)) {
                        // empty value of File upload, just check with "[object" for sastified on different browsers
                        dataValue = "";
                    } else {
                        dataValue = dataValue.toString().substr(0, 46).trim(); // substr(0, 50) to not bloat/crash/break the dialog width
                        if (dataValue.length >= 45) {
                            dataValue += " ...";
                        }
                    }

                    if ($("[name=" + key + "]", workingFormInfo.$workingForm).hasClass("FormHideInSummarized")) {
                        shouldBeHiddenKeys.push(key);
                    }

                    // ignore Element with FormHideInSummarized class, hidden field, buildin field, meta field of Form, empty value, or no friendly name
                    if (friendlyName == "" ||
                        friendlyName == null ||
                        dataValue == "" ||
                        dataValue == null ||
                        ignoreFields.indexOf(key) >= 0 ||
                        shouldBeHiddenKeys.indexOf(key) >= 0) {
                        continue;
                    } else {
                        addedKeys.push(key);
                    }

                    if (displayAsHtmlContent) {
                        summarizedText += _utilsSvc.stringFormat("{0}: {1}" + newLineString, [_utilsSvc.htmlEncodeEntities(friendlyName), _utilsSvc.htmlEncodeEntities(dataValue)]);
                    } else {
                        summarizedText += _utilsSvc.stringFormat("{0}: {1}" + newLineString, [_utilsSvc.htmlDecodeEntities(friendlyName), dataValue]);
                    }
                } // end foreach(data)

                return summarizedText;
            },

            // tag: public virtual.
            // summary: 3rd developer can override this function to do something before submitting data.
            onBeforeSubmit: function () {
                var $deferred = $.Deferred();
                $deferred.resolve();
                return $deferred.promise();
            },

            // tag: public virtual
            // summary: 3rd developer can replace this function to show better flyout dialog instead of default HTML confirm()
            // return: "true" is Visitor allowed with the submitting data
            showSummarizedText: function (data, workingFormInfo, ignoreFields, shouldBeHiddenKeys) {
                // workingFormInfo.ElementsInfo: contains friendlyName for each field code
                // ignoreFields: are (System) fields should be ignored
                // shouldBeHiddenKeys: are fields which should not be shown (hidden field, tracking code, ...)
                // to determine field should be display or not, check $("[name=" + key + "]", workingFormInfo.$workingForm).hasClass("FormHideInSummarized"))

                var $deferred = $.Deferred(),
                    summarizedText = this.getSummarizedText(workingFormInfo, data, false);

                // empty text, no need to show the confirm box
                if (!summarizedText || summarizedText.trim() === "") {
                    $deferred.resolve(true);

                    return $deferred.promise();
                }

                // There is a issue in Chrome that causes Form confirm dialog disappear immediately when using
                // Form along with Google Tag Manager. So we need to add a small timeout here to workaround this bug.
                setTimeout(function () {
                    var confirmResult = confirm(summarizedText);
                    $deferred.resolve(confirmResult);
                }, 100);

                return $deferred.promise();
            },

            // get custom element value (from DOM Element having data-f-datainput), developer overrides this method to return value from custom element
            // $element: element root
            // tag: public virtual
            getCustomElementValue: function ($element) {
                // default simply return
                return $element.val() || $element.find("[data-f-datainput]").val();
            },

            // bind custom element value, developer overrides this method to bind value for custom element.
            // $element: element root
            // tag: public virtual
            bindCustomElementValue: function ($element, val) {
                var $elementInput = $element.find(".Form__CustomInput, [data-f-datainput]");
                $elementInput.val(val);
            },

            // reset custom element value, developer overrides this method to bind value for custom element.
            // $element: element root
            // tag: public virtual
            resetCustomElementValue: function ($element) {
                var $elementInput = $element.find(".Form__CustomInput, [data-f-datainput]");
                $elementInput.val("");
            },

            // Get data from DataElements (like textbox/textarea/selection/listbox values,... and Custom Element also) in a container.
            // We ignore all non-data elements, including step, form, resetbutton, submitbutton ... or element having element-nondata attribute
            // $container: the form container
            // tag: public virtual
            getAllDataElements: function ($container) {
                return $(".Form__Element, .Form__CustomElement, [data-f-type]", $container)
                    .not(".FormStep,.FormSubmitButton,.Form__Element--NonData,[data-f-type='step'],[data-f-type='form'],[data-f-type='resetbutton'],[data-f-type='submitbutton'],[data-f-element-nondata]");
            },

            // return true if "step" is satisfy the dependCondition
            // tag: public virtual
            isStepSatisfyDependentCondition: function (step, workingFormInfo) {
                if (!step) {
                    return false;
                }

                var dependField = step.dependField,
                    storedData = _dataSvc.loadFormDataFromStorage(workingFormInfo.Id),
                    funcOfDependCondition = epi.EPiServer.Forms.DependConditions[step.dependCondition];

                if (!dependField || !funcOfDependCondition || !storedData) { // no input to check, consider it's OK
                    return true;
                }

                if (_dependencySvc._isInactiveElement(dependField, workingFormInfo)) {
                    return funcOfDependCondition(null, step.dependValue);
                }

                return funcOfDependCondition(storedData[dependField], step.dependValue);
            },

            // get anti-forgery token generate by Forms,
            // this token value will be added to header when send an AJAX calling to push form data to server.
            // return JSON object that put to request header.
            getAntiForgeryToken: function (workingFormInfo) {
                // default implementation is to use Asp.net MVC anti-forgery mechanize
                var vertificationTokenFieldName = "__RequestVerificationToken";
                var token = $('input[name="' + vertificationTokenFieldName + '"]', workingFormInfo.$workingForm).val();
                return { RequestVerificationToken: token };
            },

            // build the request header for submiting form data.
            // return JSON object.
            buildSubmitRequestHeader: function (workingFormInfo) {
                var header = {},
                    tokenObj = this.getAntiForgeryToken(workingFormInfo);
                $.extend(header, tokenObj);

                return header;
            }
        },

        Data: {
            loadCurrentFormDataFromStorage: function ($workingForm) {
                /// <summary>load current form's data from client storage,
                /// current form is specified by <paramref name="id"></summary>
                /// Obsoleted: use loadFormDataFromStorage instead.

                var identifier = epi.EPiServer.Forms.Utils.getFormIdentifier($workingForm);
                return this.loadFormDataFromStorage(identifier);
            },

            loadFormDataFromStorage: function (formIdentifier) {
                /// <summary>load a specified form data from storage.</summary>

                // get epiforms-form's data by formname
                var storage = this.getStorage(),
                    data = storage[formIdentifier];
                if (!data) {
                    return {};
                }

                data = JSON.parse(data);
                if (!data) {
                    return {};
                }

                return data;
            },

            // Save current form data to storage
            // @return: return the saved data.
            // Obsoleted: Use method saveFormDataToStorage instead.
            saveCurrentFormDataToStorage: function ($workingForm, data) {
                var identifier = epi.EPiServer.Forms.Utils.getFormIdentifier($workingForm);
                return this.saveFormDataToStorage(identifier, data);
            },

            // Save form data which specified by formIdentifier to storage
            // @return: return the saved data
            saveFormDataToStorage: function (formIdentifier, data) {
                var storage = this.getStorage();
                // NOTE: file is NOT stringifiable then could not be stored => need use a custom library that support???
                // store data in Storage: key is dynamic-form's name, value is data object of current form
                // E.g.: { 'myformname' : { TB: "123", CB: "true" } }
                try { // safari private mode does not allow local storage
                    storage.setItem(formIdentifier, JSON.stringify(data));
                } catch (e) {
                    console.log("Local Storage not supported: " + e.message);
                }
                return data;
            },

            clearFormDataInStorage: function ($workingForm) {
                /// clear saved data of $workingForm in storage
                // Obsoleted: Use method removeFormDataInStorage instead.

                removeFormDataInStorage(epi.EPiServer.Forms.Utils.getFormIdentifier($workingForm));
            },

            removeFormDataInStorage: function (formIdentifier) {
                /// clear saved data of specified Form in storage

                this.getStorage().removeItem(formIdentifier);
            },

            getStorage: function () {
                // summary:
                //      abstract storage to store EPiForms's data
                // returns: [Object]
                // tags:
                //      public

                return sessionStorage;
            }
        },

        Validation: {

            // summary:
            //      Gets validator metadata by tag name from given validators array
            // elementValidators: [Array]
            //      Collection of validator metadata
            // validatorType: [String]
            //      Validator tag
            // returns: [Object]
            //      Validator metadata object that matched with the given tag
            // tags:
            //      intermal
            getValidatorByValidatorType: function ( /*Array*/ elementValidators, /*string*/ validatorType) {

                if (!(elementValidators instanceof Array) || elementValidators.length === 0 || !validatorType) {
                    return;
                }

                var itemIndex = 0,
                    item = null,
                    totalItems = elementValidators.length;
                for (; itemIndex < totalItems; itemIndex++) {
                    item = elementValidators[itemIndex];
                    if (!item) {
                        continue;
                    }

                    if (item.type === validatorType) {
                        return item;
                    }
                }

            },

            // summary:
            //      Gets all validator meta data objects by the given element identifier
            // formValidationInfo: [Array]
            //      Entire validation info of this FORM
            // elementIdentifier: [String]
            //      HTML tag id or name
            // returns: [Array]
            //      Collection of validator meta data object
            // tags:
            //      internal
            getElementValidators: function ( /*Array*/ formValidationInfo, /*String*/ elementIdentifier) {

                if (!(formValidationInfo instanceof Array) || formValidationInfo.length === 0 || !elementIdentifier) {
                    return;
                }

                var itemIndex = 0,
                    totalItems = formValidationInfo.length,
                    item = null;
                for (; itemIndex < totalItems; itemIndex++) {
                    item = formValidationInfo[itemIndex];
                    if (!item) {
                        continue;
                    }

                    if (item.targetElementId === elementIdentifier || item.targetElementName === elementIdentifier) {
                        return item.validators;
                    }
                }
            },


            // summary:
            //      Validate a field with input value.
            // return:
            //      Array of result object.ex[{ isValid: true }]
            // tag:
            //      internal
            validateFormValue: function (fieldName, fieldValue, validators) {
                var results = [];

                $(validators).each(function (index, item) {

                    // take the Actor, it can be function to execute, or contain property (of type function) "validate"
                    var validatorActor = epi.EPiServer.Forms.Validators[item.type];
                    var validatorFunc = null;

                    if (typeof validatorActor === "function") {
                        validatorFunc = validatorActor;
                    } else if (typeof validatorActor["validate"] === "function") {
                        validatorFunc = validatorActor["validate"];
                    }

                    // execute the validatorFunc
                    if (validatorFunc) {
                        var itemResult = validatorFunc(fieldName, fieldValue, item);
                        $.extend(itemResult, {
                            fieldName: fieldName,
                            fieldValue: fieldValue
                        });
                        results.push(itemResult);
                    }
                });

                return results;
            }
        },

        Dependency: {

            // ConditionCombination : Object
            // (Known) how to combine conditions of dependency
            // =================================
            ConditionCombinations: {
                All: "All", // require all conditions to be met.
                Any: "Any"
            },

            /////////////////////////////////////////////////////////////////////
            // What action we perform when a Dependency is satisfied.
            // We have 2 built-in actions: "show", and "hide". Developer can implement his own action by extending this object.
            /////////////////////////////////////////////////////////////////////
            Actions: {
                Config: {
                    ShowDuration: 10,
                    HideDuration: 10
                },

                // action show
                // satisfied: display element and remove it from DependencyInactiveElements list of the form
                // not satisfied: hide element and push it into DependencyInactiveElements list of the form
                show: function ( /*epi.EPiServer.Forms.Dependency.DependantController*/ controller) {
                    if (controller.isSatisfied) {
                        this._showElement(controller);
                        var index = controller.workingFormInfo.DependencyInactiveElements && controller.workingFormInfo.DependencyInactiveElements.indexOf(controller.dependantInfo.fieldName);
                        if (index >= 0) {
                            controller.workingFormInfo.DependencyInactiveElements.splice(index, 1);
                        }
                    } else {
                        this._hideElement(controller);
                        controller.workingFormInfo.DependencyInactiveElements.push(controller.dependantInfo.fieldName);
                    }
                },

                // action hide
                // satisfied: hide element and push it into DependencyInactiveElements list of the form
                // not satisfied: display element and remove it from DependencyInactiveElements list of the form
                hide: function ( /*epi.EPiServer.Forms.Dependency.DependantController*/ controller) {
                    if (controller.isSatisfied) {
                        this._hideElement(controller);
                        controller.workingFormInfo.DependencyInactiveElements.push(controller.dependantInfo.fieldName);
                    } else {
                        this._showElement(controller);
                        var index = controller.workingFormInfo.DependencyInactiveElements && controller.workingFormInfo.DependencyInactiveElements.indexOf(controller.dependantInfo.fieldName);
                        if (index >= 0) {
                            controller.workingFormInfo.DependencyInactiveElements.splice(index, 1);
                        }
                    }
                },

                _hideElement: function (/*epi.EPiServer.Forms.Dependency.DependantController*/ controller) {
                    // we need both JQuery.hide(Actions.Config.ShowDuration) and css class 'hide'
                    // JQuery.show() method accepts a number determining how long the animation will run.
                    controller.$domElement.hide(this.Config.HideDuration);
                    controller.$domElement.addClass("hide");
                },

                _showElement: function (/*epi.EPiServer.Forms.Dependency.DependantController*/ controller) {
                    controller.$domElement.show(this.Config.ShowDuration);
                    controller.$domElement.removeClass("hide");
                }
            },

            DependantController: DependantController,
            Dependant: Dependant,


            // init dependencies for each form instance
            // When server returns the Dependency model (what editor has configured in EditView) to clientside, this function build the DependantController[]
            _initDependencyInfos: function (workingFormInfo) {
                var dependenciesInfo = workingFormInfo.DependenciesInfo; // serverside return this model

                if (!dependenciesInfo || dependenciesInfo.length <= 0) {
                    return;
                }

                workingFormInfo.DependantControllers = [];

                for (var i = 0; i < dependenciesInfo.length; i++) {
                    var dpInfo = dependenciesInfo[i];
                    var settings = {
                        // function will be triggered when state of dependency changed
                        onDependencyStateChanged: function ($domElement, dependencyInfo, isSatisfied) {
                            // raise event
                            _utilsSvc.raiseFormsEvent(
                                workingFormInfo, {
                                    type: "formsDependencyStateChanged",
                                    targetElement: $domElement,
                                    dependencyInfo: dependencyInfo,
                                    isConditionSatisfied: isSatisfied
                                });
                        },
                        workingFormInfo: workingFormInfo
                    };

                    // each dependent element associated with a controller to control the visiblity
                    var controller = new epi.EPiServer.Forms.Dependency.DependantController(dpInfo, settings);
                    workingFormInfo.DependantControllers.push(controller);
                }
            }, // _initDependencyInfos

            // get value of dependee element for checking dependency condition. This take the "dependency-state" of the element in consideration.
            // E.g.: FieldB is shown when FieldA.value == "1".
            // FieldC is shown when FieldB.value = "2".
            // This function get value of FieldA, and return normally.
            // In cased fieldB is not shown, then this function return undefined. (because fieldB is dependency-INACTIVE)
            // ===========================================
            _getValueOfDependeeElement: function ($element, workingFormInfo) {
                if (!workingFormInfo || !$element) {
                    return undefined;
                }

                var elementName = _utilsSvc.getElementName($element);
                // if element is in the inactive list, consider its value as undefined
                if (workingFormInfo.DependencyInactiveElements.indexOf(elementName) >= 0) {
                    return undefined;
                }

                var currentStepIndex = _utilsSvc.getCurrentStepIndex(workingFormInfo);
                var currentStepDOM = $(workingFormInfo.$steps[currentStepIndex]);
                var isElementInCurrentStep = $($element, currentStepDOM).length > 0;

                if (isElementInCurrentStep) {
                    // if element is in current step, get value directly from editing element
                    return _utilsSvc.getElementValue($element);
                }
                // if element is NOT in current step, get value from storage
                var formData = epi.EPiServer.Forms.Data.loadCurrentFormDataFromStorage(workingFormInfo.$workingForm);
                return formData[elementName];
            },

            // get event name to fire the state change of a dependee element. For textbox, we listen on "keyup". For other input type, we listen on "change"
            // E.g.: FieldB is shown when FieldA.value == "ok". FieldA is a textbox, then on "keyup" of FieldA, FieldB changes its state.
            _getTriggerEventForDependeeElement: function ($element) {
                if (_utilsSvc.isElementType($element, "textbox")) {
                    return "keyup";
                }
                return "change";
            },

            // get list of event name to fire the state change of a dependee element.
            // Normally a dependee element just needs to listen to one event.
            // But for Number element, user can use incrementer (up / down icon in textbox with number type) or manually enter value by pressing a key
            // So we have to listen both `keyup` and `change` event.
            _getTriggerEventsForDependeeElement: function ($element) {
                if (_utilsSvc.isElementType($element, "textbox")) {
                    if ($element.attr("data-f-modifier") === "number") {
                        return ["keyup", "change"];
                    }
                    return ["keyup"];
                }

                return ["change"];
            },

            // check if the given element belongs to inactive steps
            _isElementOfInactiveSteps: function (elementName, workingFormInfo) {
                var inactiveSteps = workingFormInfo.StepsInfo.Steps.filter(function (step) {
                    return step.isActive === false;
                });

                if (inactiveSteps.length === 0) {
                    return false;
                }

                for (var i = 0; i < inactiveSteps.length; i++) {
                    var inactiveStepIndex = inactiveSteps[i].index,
                        isLastStep = inactiveStepIndex === workingFormInfo.StepsInfo.Steps.length - 1;

                    // the last step always shows so we skip checking its elements.
                    if (isLastStep === true) {
                        continue;
                    }

                    var $inactiveStepDOM = $(workingFormInfo.$steps[inactiveStepIndex]);
                    // get input elements of inactive step
                    var $inputElements = $inactiveStepDOM.find("[data-f-datainput]");
                    var inputNames = $.map($inputElements, function (el) {
                        return epi.EPiServer.Forms.Utils.getElementName($(el));
                    });

                    if (inputNames && inputNames.indexOf(elementName) > -1) {
                        return true;
                    }

                }

                return false;
            },

            // return true if an element is inactive
            // an element is considered as inactive if it is inactive field (field dependency) or belongs to inactive steps (step dependency)
            _isInactiveElement: function (elementName, workingFormInfo) {
                return (workingFormInfo.DependencyInactiveElements.indexOf(elementName) > -1) ||
                    this._isElementOfInactiveSteps(elementName, workingFormInfo);
            }
        },

        Navigation: {

            findNextStep: function (currentIndex, workingFormInfo) {
                // summary:
                //      rescusive finding next step to display in form.
                // currentIndex: [Integer]
                //      Current index for searching step.
                // tags:
                //      internal

                var satisfiedStep = null,
                    // get next step to check
                    nextStepIndex = currentIndex + 1,
                    nextStep = workingFormInfo.StepsInfo.Steps[nextStepIndex];

                if (nextStep) {
                    var isSatisfied = epi.EPiServer.Forms.Extension.isStepSatisfyDependentCondition(nextStep, workingFormInfo);
                    nextStep.isActive = isSatisfied;
                    satisfiedStep = isSatisfied ? nextStep : this.findNextStep(nextStepIndex, workingFormInfo);
                }

                return satisfiedStep;
            },

            findPreviousStep: function (currentIndex, workingFormInfo) {
                // summary:
                //      Find previous step to display in form.
                // currentIndex: [Integer]
                //      Current index for searching step.
                // tags:
                //      internal

                var satisfyStep = null;
                // get prev step to check
                var prevStepIndex = currentIndex - 1;
                var step = workingFormInfo.StepsInfo.Steps[prevStepIndex];
                if (step) {
                    // is prevStep OK with dependCondition?
                    if (epi.EPiServer.Forms.Extension.isStepSatisfyDependentCondition(step, workingFormInfo)) {
                        satisfyStep = step;
                    } else {
                        satisfyStep = this.findPreviousStep(prevStepIndex, workingFormInfo);
                    }
                }

                return satisfyStep;
            }

        }
    });

    /// add buildin implementation of visitor data sources
    /// ==================================================
    var buildinVisitorData = {
        VisitorData: {
            "EPiServer.Forms.Implementation.VisitorData.GeoVisitorDataSource": function ($element) {

                var $workingForm = _utilsSvc.getWorkingFormFromInnerElement($element),
                    dataSubmitController = epi.EPiServer.Forms[_utilsSvc.getFormIdentifier($workingForm)].DataSubmitController;

                $.get(dataSubmitController + "/GetGeoData")
                    .done(function (location) {
                        if ($element.val()) {
                            return;
                        }

                        var property = $element.data("epiforms-visitordataproperty") || $element.data("f-visitordataproperty");
                        if (location != null && location[property]) {
                            $element.val(location[property]);
                        }
                    });
            }
        }
    };

    /// Builtin implementation of validators. Validator in clientside can be a function(fielName, fieldValue, validatorMetaData)
    /// or an complex object { initialize(), validate(), onServerValidateFailed() }
    /// ========================================
    var buildinValidators = {
        Validators: {
            "EPiServer.Forms.Implementation.Validation.RequiredValidator": function (fielName, fieldValue, validatorMetaData) {
                // summary:
                //      VALIDATE REQUIRED
                // fielName: String
                //      Name of the field to be validated.
                // fieldValue: [Object]
                //      User input value for the field.
                // validatorMetaData: [Object]
                //      Validation meta data for the current element
                // returns: Object
                // tags:
                //      private


                // Check element's value for required field
                if (validatorMetaData) {
                    if (fieldValue == ""
                        // for FileUpload element
                        ||
                        (fieldValue && !fieldValue.length)) {
                        return {
                            isValid: false,
                            message: validatorMetaData.model.message
                        };
                    }
                }

                return {
                    isValid: true
                };
            },

            "EPiServer.Forms.Implementation.Validation.RegularExpressionValidator": _utilsSvc.validateRegularExpressionValidator,
            "EPiServer.Forms.Implementation.Validation.EmailValidator": _utilsSvc.validateRegularExpressionValidator,
            "EPiServer.Forms.Implementation.Validation.UrlValidator": _utilsSvc.validateRegularExpressionValidator,
            "EPiServer.Forms.Implementation.Validation.DateDDMMYYYYValidator": _utilsSvc.validateRegularExpressionValidator,
            "EPiServer.Forms.Implementation.Validation.DateMMDDYYYYValidator": _utilsSvc.validateRegularExpressionValidator,
            "EPiServer.Forms.Implementation.Validation.DateYYYYMMDDValidator": _utilsSvc.validateRegularExpressionValidator,
            "EPiServer.Forms.Implementation.Validation.IntegerValidator": _utilsSvc.validateRegularExpressionValidator,
            "EPiServer.Forms.Implementation.Validation.PositiveIntegerValidator": _utilsSvc.validateRegularExpressionValidator,
            "EPiServer.Forms.Implementation.Validation.AllowedExtensionsValidator": function (fieldName, fieldValue, validatorMetaData) {

                function __isFileNameValid(fileName, blackExtensions, extensions) {
                    /// <summary>checking file name with list of extension WITHOUT DOT</summary>

                    var fileExtension = __getFileExtension(fileName);
                    // file without extension is considered as invalid
                    if (fileExtension.length < 1) {
                        return false;
                    }

                    fileExtension = fileExtension.toLowerCase();
                    if (blackExtensions.indexOf(fileExtension) >= 0) {
                        return false;
                    }

                    // just check when extension was specified
                    if (extensions.length < 1) {
                        return true;
                    }

                    return extensions.indexOf(fileExtension) > -1;
                }

                function __getFileExtension(fileName) {
                    /// <summary>get file extension WITHOUT DOT</summary>

                    // returning "" instead of the full string when there's no dot or no string before the dot
                    return fileName.substr((~-fileName.lastIndexOf(".") >>> 0) + 2); // replace "+ 2" with "+ 1" to include the DOT
                }

                if (!fieldValue || (fieldValue instanceof Array && fieldValue.length === 0)) {
                    return {
                        isValid: true
                    };
                }

                var files = fieldValue,
                    acceptValue = validatorMetaData.model.accept,
                    unacceptTypes = epi.EPiServer.Forms.UploadExtensionBlackList.split(","),
                    acceptTypes = (acceptValue == undefined || acceptValue.length < 1) ? [] : acceptValue.split(","),
                    i = 0,
                    j = 0,
                    totalAcceptTypes = acceptTypes.length,
                    totalFiles = files.length;

                // remove the DOT before checking, acceptTypes was sent from server always starts with DOT
                if (totalAcceptTypes > 0) {
                    for (; i < totalAcceptTypes; i++) {
                        acceptTypes[i] = acceptTypes[i].substr(1);
                    }
                }

                // for simpleness, just comparing the extension, NOT cover image/*|video/*|audio/* pattern
                for (; j < totalFiles; j++) {
                    if (!__isFileNameValid(files[j].name, unacceptTypes, acceptTypes)) {
                        return {
                            isValid: false,
                            message: epi.EPiServer.Forms.Utils.stringFormat(validatorMetaData.model.message, [acceptValue])
                        };
                    }
                }

                return {
                    isValid: true
                };
            },
            "EPiServer.Forms.Implementation.Validation.MaxFileSizeValidator": function (fieldName, fieldValue, validatorMetaData) {

                var files = fieldValue,
                    i = 0,
                    totalItems = files.length,
                    expectedSize = validatorMetaData.model.sizeInBytes;

                for (; i < totalItems; i++) {
                    if (files[i].size > expectedSize) {
                        return {
                            isValid: false,
                            message: epi.EPiServer.Forms.Utils.stringFormat(validatorMetaData.model.message, [expectedSize / (1024 * 1024)])
                        };
                    }
                }

                return {
                    isValid: true
                };
            },
            "EPiServer.Forms.Implementation.Validation.NumericValidator": function (fieldName, fieldValue, validatorMetaData) {

                var isNumeric = function (n) {
                    return !isNaN(parseFloat(n)) && isFinite(n);
                };
                if (!fieldValue || isNumeric(fieldValue)) {
                    return {
                        isValid: true
                    };
                }

                return {
                    isValid: false,
                    message: validatorMetaData.model.message
                };
            },

            "EPiServer.Forms.Implementation.Validation.CaptchaValidator": {

                // summary:
                //      Initialize Captcha validator
                // $element: [Object]
                //      Current element.
                // tag: public
                initialize: function ($element) {
                    var self = this;
                    $element.parents(".FormCaptcha, [data-f-type='captcha']").find(".FormCaptcha__Refresh, [data-f-captcha-refresh]").on("click", function (e) {
                        self._refreshCaptcha($(this));
                        e.preventDefault(); // to prevent page refreshed
                    });
                },

                // summary:
                //      Validate Captcha data
                // fielName: String
                //      Name of the field to be validated.
                // fieldValue: [Object]
                //      User input value for the field.
                // validatorMetaData: [Object]
                //      Validation meta data for the current element
                // returns: Object
                // tags:
                //      public
                validate: function (fieldName, fieldValue, validatorMetaData) {
                    // we cannot validate the captcha in clientside, but at least we expect something from user
                    var actualCaptchaValue = fieldValue.trim();
                    var isValid = actualCaptchaValue != null && actualCaptchaValue !== "";
                    return {
                        isValid: isValid,
                        message: validatorMetaData.model.message
                    };
                },

                // summary:
                //      Call when validate on server side failed.
                // $element: [Object]
                //      Current element to validate.
                //  validator: [Object]
                //      Captcha validator.
                // tag: public
                onServerValidateFailed: function ($element, validator) {
                    this._refreshCaptcha($element);
                    $element.focus();
                },

                // tag: private
                _refreshCaptcha: function ($element) {
                    /// <summary>Refresh captcha image to get new one</summary>
                    var $captchaFormElement = ($element.hasClass("FormCaptcha") || _utilsSvc.isElementType($element, "captcha")) ? $element : $element.parents(".FormCaptcha, [data-f-type='captcha']"),
                        $captchaImg = $captchaFormElement.find(".FormCaptcha__Image, [data-f-captcha-image]"),
                        $captchaInput = $captchaFormElement.find(".FormTextbox__Input, [data-f-datainput]");

                    $captchaImg.attr("src", $captchaImg.attr("src") + "&d=" + Math.random()); // random param to avoid cache of the image
                    // clear input value
                    $captchaInput.val("");
                }
            }
        }
    };
    /// Map of functions.
    /// DependConditions are rules, used to evaluate the dependence of Step's visibility on FormElement.
    /// Builtin are what EpiForm Core defines in enum EPiServer.Forms.EditView.DependCondition
    var buildinDependConditions = {

        // These are operators in the Dependency condition
        DependConditions: {
            Equals: function (actualValue, expectedValue) {
                // summary:
                //      Compare whether user input data equals depend value or not.
                // userValue: [Object]
                //      Value that user has input
                // dependValue: [Object]
                //      The depend value need to be verified.
                // returns: [Boolean]
                // tags:
                //      private

                actualValue = !actualValue ? "" : epi.EPiServer.Forms.Utils.getConcatString(actualValue, ",").toUpperCase();

                expectedValue = !expectedValue ? "" : expectedValue.toUpperCase();

                return actualValue === expectedValue;
            },

            NotEquals: function (actualValue, expectedValue) {
                // summary:
                //      Compare whether user input data does NOT equal depend value or not.
                // userValue: [Object]
                //      Value that user has input
                // dependValue: [Object]
                //      The depend value need to be verified.
                // returns: [Boolean]
                // tags:
                //      private

                actualValue = !actualValue ? "" : epi.EPiServer.Forms.Utils.getConcatString(actualValue, ",").toUpperCase();

                expectedValue = !expectedValue ? "" : expectedValue.toUpperCase();

                return actualValue !== expectedValue;
            },

            Contains: function (actualValue, expectedValue) {
                // summary:
                //      Compare whether user input data contains depend value or not.
                // userValue: [Object]
                //      Value that user has input
                // dependValue: [Object]
                //      The depend value need to be verified.
                // returns: [Boolean]
                // tags:
                //      private

                actualValue = !actualValue ? "" : epi.EPiServer.Forms.Utils.getConcatString(actualValue, ",").toUpperCase();

                expectedValue = !expectedValue ? "" : expectedValue.toUpperCase();

                return actualValue.indexOf(expectedValue) >= 0;
            },

            NotContains: function (actualValue, expectedValue) {
                // summary:
                //      Compare whether user input data does NOT contain depend value or not.
                // userValue: [Object]
                //      Value that user has input
                // dependValue: [Object]
                //      The depend value need to be verified.
                // returns: [Boolean]
                // tags:
                //      private

                actualValue = !actualValue ? "" : epi.EPiServer.Forms.Utils.getConcatString(actualValue, ",");

                return (!actualValue && expectedValue) ||
                    (actualValue && !expectedValue) ||
                    (actualValue && expectedValue && actualValue.toUpperCase().indexOf(expectedValue.toUpperCase()) < 0);
            },

            MatchRegularExpression: function (actualValue, patternOfExpected) {
                // summary:
                //      Compare user input with a pattern. Return true if pattern matchs actualUserValue
                // userValue: [Object]
                //      Value that user has input
                // pattern: [Object]
                //      The depend value need to be verified.
                // returns: [Boolean]
                // tags:
                //      private

                var regex = new RegExp(patternOfExpected, "igm");
                regex.ignoreCase = regex.global = regex.multiline = true;

                return (!patternOfExpected) || (patternOfExpected && regex.test(actualValue));
            }
        }
    };

    var buildInCustomBindingElements = {
        CustomBindingElements: {
            // this should contain "FullnameOfTheElementBlock": function (elementInfo, val)
            // params:
            // elementInfo: metadata object in epi.EPiServer.Forms['formid'].ElementsInfo
            // Example:
            //  __field_215: {
            //      customBinding: false,
            //      friendlyName: "TextFFFFFF",
            //      type: "EPiServer.Forms.Implementation.Elements.TextboxElementBlock"
            //}
            // val: value populate from storage
        }
    };

    $.extend(true, epi.EPiServer.Forms, buildinVisitorData);
    $.extend(true, epi.EPiServer.Forms, buildinValidators);
    $.extend(true, epi.EPiServer.Forms, buildinDependConditions);
    $.extend(true, epi.EPiServer.Forms, buildInCustomBindingElements);

    /// init function for clientside interaction of EPiServer.Forms
    /// ================================================
    epi.EPiServer.Forms.init = function () {
        // if this script is initialized once, it will return immediately.
        if (epi.EPiServer.Forms.__Initialized) {
            return;
        }
        epi.EPiServer.Forms.__Initialized = true; // turn the flag            console.debug("epi.EPiServer.Forms.init", "epi.EPiServer.Forms.__Initialized:", epi.EPiServer.Forms.__Initialized);


        $(document).ready(function () {

            // pre-condition to use sessionStorage
            if (!_dataSvc.getStorage()) {
                $('.EPiServerForms .Form__Status__Message, [data-f-type="form"] [data-f-form-statusmessage]').text(epi.EPiServer.Forms.ErrorMessages.cantnotworkwithoutstorage);
                return;
            }


            /// foreach Forms in this page, take the formDescriptor (workingFormInfo) and call functions with that context.
            /// most of functions here should work with that context, not lookup the $workingForm by itself.
            $('.EPiServerForms, [data-f-type="form"]').each(function (index, item) {
                var $workingForm = $(item),
                    workingFormInfo = getFormDescriptor($workingForm);

                // is this form allowed current user to submit?
                if (workingFormInfo.SubmittableStatus && workingFormInfo.SubmittableStatus.submittable === false) {
                    showFormMessage(workingFormInfo, workingFormInfo.SubmittableStatus.message);
                }

                navigationInit(workingFormInfo);

                // Initialize the state of each step based on its dependency (in case Forms with multiple-steps on multi-pages)
                // ignore the first step because it does not have dependency configuration
                // ignore the last step because it's always shown regardless of dependency satisfaction
                for (var stepIndex = 1; stepIndex < workingFormInfo.StepsInfo.Steps.length - 1; stepIndex++) {
                    var step = workingFormInfo.StepsInfo.Steps[stepIndex];
                    step.isActive = epi.EPiServer.Forms.Extension.isStepSatisfyDependentCondition(step, workingFormInfo);
                }

                epi.EPiServer.Forms.Dependency._initDependencyInfos(workingFormInfo);

                /// foreach Init all declared Validators
                $(workingFormInfo.ValidationInfo).each(function (index, item) {
                    $(item.validators).each(function (i, validator) {
                        var staticValidator = epi.EPiServer.Forms.Validators[validator.type];
                        // call initialize() func of Validator object to init it with actual element
                        if (staticValidator && typeof staticValidator["initialize"] === "function") {
                            staticValidator["initialize"]($("#" + item.targetElementId));
                        }
                    });
                });

                _utilsSvc.injectVisitorData(workingFormInfo);

                // handle click event of submit buttons of each form
                $(".Form__Element.FormSubmitButton, [data-f-type='submitbutton']", $workingForm).off("click", _formSubmissionHandler)
                    .on("click", _formSubmissionHandler);

                $(".Form__Element.FormResetButton, [data-f-type='resetbutton']", $workingForm).off("click", _formResetHandler)
                    .on("click", _formResetHandler);

                _utilsSvc.raiseFormsEvent(workingFormInfo, {
                    type: "formsSetupCompleted"
                });
            });

            // when key is pressed in Textbox--Number,
            // in keydown, we get the keyCode, in keyup, we get the input.value (including the charactor we've just typed)
            $(".EPiServerForms .FormTextbox--Number .FormTextbox__Input, [data-f-type='form'][data-f-type='textbox'][data-f-modifier='number'] [data-f-datainput]")
                .on("keydown", function _liveRevalidateNumberInput_KeyDown(e) {
                    var key = e.which || e.keyCode;

                    // ignore alphabet and spacebar
                    if (!e.shiftKey && !e.altKey && !e.ctrlKey &&
                        key >= 65 && key <= 90 ||
                        key === 32) {
                        return false;
                    }

                    if (!e.shiftKey && !e.altKey && !e.ctrlKey &&
                        // numbers and Numeric keypad
                        key >= 48 && key <= 57 ||
                        key >= 96 && key <= 105 ||

                        // Allow: Ctrl+A
                        (e.keyCode === 65 && e.ctrlKey === true) ||
                        // Allow: Ctrl+C
                        (key === 67 && e.ctrlKey === true) ||
                        // Allow: Ctrl+X
                        (key === 88 && e.ctrlKey === true) ||
                        // Allow: home, end, left, right
                        (key >= 35 && key <= 39) ||
                        // Backspace and Tab and Enter
                        key === 8 || key === 9 || key === 13 ||
                        // Del and Ins
                        key === 46 || key === 45) {
                        return true;
                    }

                    var v = this.value; // v can be null, in case textbox is number and does not valid
                    if ( //  minus, dash
                        key === 109 || key === 189) {
                        // if already has -, ignore the new one
                        if (v[0] === "-") {
                            return false;
                        }
                    }

                    if (!e.shiftKey && !e.altKey && !e.ctrlKey &&
                        // comma, period and dot on keypad
                        key === 190 || key === 188 || key === 110) {
                        // already having comma, period, dot
                        if (/[\.,]/.test(v)) {
                            return false;
                        }
                    }
                })
                .on("keyup", function _liveRevalidateNumberInput_KeyUp(e) {
                    // routine run to this case is typing - in the middle of the string, or Ctrl V some invalid chars
                    var v = this.value;

                    if (!isNaN(v)) { // convert to number success
                        //                      "1000"	"10.9"	"1,000.9"	"011"	"10c"	"$10"
                        //+str, str*1, str-0	1000	10.9	NaN	        11	    NaN	    NaN
                        // do nothing, let it be
                    } else if (v) {
                        // refine the value
                        v = (v[0] === "-" ? "-" : "") + v.replace(/[^0-9\.]/g, ""); // we will also remove the -, so we need to retain negative state
                        v = v.replace(/\.(?=(.*)\.)+/g, ""); // remove all dot that have other dot following. Only the last dot is kept.
                        this.value = v; // only replace if we have to change wrong value with right one
                    }

                });

            // When a key is pressed, we will check whether it's the enter character.
            // If yes, then, we need to decide which event handler will be chosen between submitting the form or moving to next the next step.
            $('.EPiServerForms input.FormTextbox__Input,.FormChoice__Input.FormChoice__Input--Checkbox,.FormRange__Input,.FormTextbox__Input.FormUrl__Input,.FormChoice__Input.FormChoice__Input--Radio,.FormTextbox__Input.FormCaptcha__Input.FormHideInSummarized,[data-f-type="form"] [data-f-datainput]:not(textarea)')
                .on("keydown", function _onKeyDown(e) {
                    return _utilsSvc.showNextStepOnEnterKeyDown(e);
                });

            function _formSubmissionHandler( /*Event*/ e) {
                e.preventDefault();
                e.stopPropagation();
                var $workingForm = _utilsSvc.getWorkingFormFromInnerElement(e.target),
                    workingFormInfo = getFormDescriptor($workingForm);

                // do nothing if the form should not be submitted
                if (workingFormInfo.SubmittableStatus.submittable === false) {
                    showFormMessage(workingFormInfo, workingFormInfo.SubmittableStatus.message);
                    return false;
                }

                $.when(_extensionSvc.onBeforeSubmit($workingForm)).then(function () {

                    // validate on current Step not the whole Form
                    var $currentStep = _getCurrentStepDOM(workingFormInfo);
                    if (!validateElementsIn($currentStep, workingFormInfo)) {
                        _refreshCaptchaElement($currentStep);
                        _scrollToFirstValidationFailedElement($currentStep);
                        return false;
                    }

                    // get all element's data for validating whole form before do submit
                    var data = getCurrentFormData($workingForm); // get saved form data, merged with current stepview,
                    $.when(showSummarizedData(workingFormInfo, data)).then(function (userAcceptToSubmit) {
                        if (!userAcceptToSubmit) {
                            return false;
                        }

                        // With multi-step-multi-page Form user can jump directly to the last step and bypass middle steps validation,
                        // then need to re-Validate the whole form data before submit it
                        var validateResults = [],
                            $validatedEle = null;

                        for (var fieldName in data) {
                            if (fieldName.indexOf("__TempData") > -1) {
                                continue;
                            }

                            // ignore the field that is in the inactive list
                            if (_dependencySvc._isInactiveElement(fieldName, workingFormInfo)) {
                                continue;
                            }

                            $validatedEle = _utilsSvc.getFormElementBlock(fieldName, $workingForm);
                            if (!$validatedEle.parents(".FormStep:first, [data-f-type='step']:first").hasClass("hide")) {
                                var validators = _validationSvc.getElementValidators(workingFormInfo.ValidationInfo, fieldName);
                                validateResults = validateResults.concat(_validationSvc.validateFormValue(fieldName, data[fieldName], validators));
                            }
                        }

                        var invalidResultItems = $.grep(validateResults, function (item) {
                            return item.isValid == false;
                        });

                        if (invalidResultItems.length > 0) {
                            var messages = $.map(invalidResultItems, function (item) {
                                return item.message;
                            });
                            showFormMessage(workingFormInfo, messages.join(" "));

                            // cancel submit form
                            return false;
                        }

                        _doSubmitForm(e);
                    });
                });
            }

            function _formResetHandler( /*Event*/ e) {
                e.preventDefault();
                e.stopPropagation();

                var $workingForm = _utilsSvc.getWorkingFormFromInnerElement(e.target),
                    workingFormInfo = getFormDescriptor($workingForm);

                _utilsSvc.raiseFormsEvent(workingFormInfo, {
                    type: "formsReset",
                    sourceEvent: e
                });
                // reset form values
                _resetFormValues($workingForm, workingFormInfo);

                // Navigate to the first step when RESET button is clicked.
                navigateToStep(workingFormInfo.StepsInfo.Steps[0], workingFormInfo);
            }

            // Reset value of form elements to default
            // tags:
            //      private
            function _resetFormValues($workingForm, workingFormInfo) {

                $workingForm.get(0).reset(); // explicitly call reset() on form DOM element
                if (workingFormInfo.SubmittableStatus && workingFormInfo.SubmittableStatus.submittable === false) {
                    showFormMessage(workingFormInfo, workingFormInfo.SubmittableStatus.message);
                } else {
                    showFormMessage(workingFormInfo, "");
                }
                _dataSvc.removeFormDataInStorage(workingFormInfo.Id); // clear saved form storage

                //reset aria-invalid attribute
                $("[aria-invalid=true]", $workingForm).attr("aria-invalid", "false");

                // clear all data of every Data elements (like textbox/textarea/selection/listbox values,...
                _extensionSvc.getAllDataElements($workingForm).each(function loopEachFormElementToClear(i, formElement) {
                    var $el = $(formElement);
                    // clear ValidationMessage, validation class
                    _getValidationMessage($el).text("");
                    $el.removeClass("ValidationFail ValidationSuccess");

                    if ($el.hasClass("FormChoice") || _utilsSvc.isElementType($el, "choice")) {
                        // For radio, checkbox (of Choice elements) inside a hidden container (previous/next steps)
                        $el.find("input[type=checkbox], input[type=radio]").each(function (i, input) {
                            var $checkOrRadio = $(input);
                            $checkOrRadio.prop("checked", ($checkOrRadio.data("epiforms-default-value") || $checkOrRadio.data("f-default-value")) ? true : false);
                        });
                    } else if ($el.hasClass("FormSelection") || _utilsSvc.isElementType($el, "selection")) {

                        $el.find("option[disabled]:eq(0)").prop("selected", true); // select the first null thing, then try to select the default-value later

                        // For select elements (of Selection) inside a hidden container (previous/next steps)
                        $el.find("option").each(function (i, option) {
                            var $option = $(option);
                            if ($option.prop("disabled") === false) {
                                $option.prop("selected", ($option.data("epiforms-default-value") || $option.data("f-default-value")) ? true : false);
                            }
                        });
                    } else if ($el.hasClass("FormFileUpload") || _utilsSvc.isElementType($el, "fileupload")) {
                        // Remove posted file message
                        _getPostedFileMessage($el).text("");
                        _hack_clearFileInput($el.find(".FormFileUpload__Input, [data-f-datainput]"));
                    } else if ($el.hasClass("Form__CustomElement") || _utilsSvc.isElementType($el, "custom")) {
                        _extensionSvc.resetCustomElementValue($el);
                    }
                });

                // when data of form is cleared/reset, proceed dependency validation
                if (workingFormInfo.DependantControllers && workingFormInfo.DependantControllers.length) {
                    for (var i = 0; i < workingFormInfo.DependantControllers.length; i++) {
                        workingFormInfo.DependantControllers[i].check();
                    }
                }
            }

            // Prepare FormData object, submit form process, this can be called when click submitbutton, or when changing form step
            // e: [Event]
            //      Current event object
            // tags:
            //      private
            function _doSubmitForm( /*Event*/ e) {
                var $workingForm = _utilsSvc.getWorkingFormFromInnerElement(e.target),
                    workingFormGuid = epi.EPiServer.Forms.Utils.getFormIdentifier($workingForm),
                    workingFormInfo = getFormDescriptor($workingForm),
                    $currentStep = _getCurrentStepDOM(workingFormInfo),
                    $actionButton = $(e.srcElement || e.currentTarget).closest("[data-f-type='submitbutton']"),
                    isProgressiveSubmit = !!$actionButton.data("epiforms-is-progressive-submit") || !!$actionButton.data("f-is-progressive-submit");

                //  check dependencies for submit button
                if ($actionButton.data("f-type") === "submitbutton") {
                    // in case submit button has dependencies and it is hidden, prevent user from hitting Enter key
                    // Otherwise if user clicks prev or next button, don't need to handle dependencies
                    var submitButtonElement = $currentStep.find("[data-f-type=submitbutton]")[0];
                    if (submitButtonElement) {
                        var submitButtonFieldId = $(submitButtonElement).attr("data-f-element-name");
                        if (_utilsSvc.isInactiveField(workingFormInfo, submitButtonFieldId)) {
                            return;
                        }
                    }
                }

                // store result to session storage
                var data = _dataSvc.saveFormDataToStorage(workingFormInfo.Id, getCurrentStepData($workingForm)),
                    formData = new FormData(), // Using FormData object to post data and upload files
                    currentStepIndex = _utilsSvc.getCurrentStepIndex(workingFormInfo),
                    nextStep = _navigationSvc.findNextStep(currentStepIndex, workingFormInfo),
                    stepCount = workingFormInfo.StepsInfo.Steps.length,
                    isLastStep = currentStepIndex === stepCount - 1,
                    isFinalizedSubmission = nextStep ? false : isLastStep;

                // if cannot find a satisfied step, just redirect to last step for consitent with non-js mode.
                if (!nextStep && !isLastStep) {
                    nextStep = workingFormInfo.StepsInfo.Steps[stepCount - 1];
                }

                isFinalizedSubmission = isFinalizedSubmission || !!$actionButton.data("epiforms-is-finalized") || !!$actionButton.data("f-is-finalized");

                // reassign data["submit"] to reflect which submit button is clicked (in the case there are multi submit buttons - normal and progressive)
                data[$actionButton.prop("name")] = $actionButton.val();
                // these informations are stored as hiden inputs of this Form as well
                formData.append("__FormGuid", workingFormGuid);
                formData.append("__FormHostedPage", epi.EPiServer.CurrentPageLink);
                formData.append("__FormLanguage", epi.EPiServer.CurrentFormLanguage);
                formData.append("__FormCurrentStepIndex", currentStepIndex);
                formData.append("__FormWithJavaScriptSupport", "true"); // so only JS-enable-browser can set this form field

                var ovalue;
                for (var key in data) {
                    if (!data.hasOwnProperty(key)) {
                        continue;
                    }

                    // ignore the field which is in the inactive list
                    if (_utilsSvc.isInactiveField(workingFormInfo, key)) {
                        // field which is inactive, consider send empty data to server
                        formData.append(key, "");
                        continue;
                    }

                    ovalue = data[key];
                    // checking file upload elements, item must be File if any,
                    // for using Object.getPrototypeOf(variable) variable must be object type
                    if (Array.isArray(ovalue) && ovalue.length > 0 &&
                        ovalue[0] !== null && typeof ovalue[0] === "object" &&
                        ovalue[0].file && Object.getPrototypeOf(ovalue[0].file) === File.prototype) {
                        var files = ovalue,
                            fileNames = "",
                            ofile;

                        // append each upload file with a unique key (bases on element's key) so that the server side can see it through the Request.Files,
                        // concat all the files' name and assign with the element's Id
                        for (var idx = 0; idx < files.length; idx++) {
                            ofile = files[idx].file;
                            formData.append(key + "_file_" + idx, ofile);
                            fileNames += ofile.name + "|"; // charactor | cannot be used in filename and then is safe for splitting later
                        }
                        formData.append(key, fileNames);
                    } else {
                        formData.append(key, ovalue);
                    }
                }

                _utilsSvc.raiseFormsEvent(workingFormInfo, {
                    type: "formsStartSubmitting",
                    formData: formData
                });

                // Start submitting data
                $actionButton.prop("disabled", true); // Disable submit button to avoid accident multi-click
                showFormMessage(workingFormInfo, ""); // clear Forms message showed by prev step (multi-step-one-page)

                var request = $.ajax({
                    url: workingFormInfo.DataSubmitController + "/Submit",
                    headers: _extensionSvc.buildSubmitRequestHeader(workingFormInfo),
                    data: formData,
                    cache: false,
                    type: $workingForm.prop("method"), // post, get
                    processData: false, // tells jQuery doesn't process the formData object in any way
                    contentType: false, // tells jQuery doesn't add a boundary, something it would normally do
                    async: epi.EPiServer.Forms.AsyncSubmit || $workingForm.data("epiforms-async-submit") || $workingForm.data("f-async-submit") || false
                });

                request.done(function onFormSubmittingSuccess(returnedResult) {
                    e.preventDefault();

                    // clear validation error message
                    $(".Form__Element__ValidationError, [data-f-validationerror]").text("");

                    if (returnedResult.isSuccess === true) {

                        // remove upload elements' files (on the current DOM Step) to avoid repeated upload between Next/Prev of multi-step-ONE-page
                        // where selected file(s) are still keeped with the element(s)
                        var $currentStep = _getCurrentStepDOM(workingFormInfo);
                        $(".FormFileUpload .FormFileUpload__Input, [data-f-type='fileupload'] [data-f-datainput]", $currentStep).each(function (index, item) {
                            $(this).val("");
                            _hack_clearFileInput($(this));
                        });

                        /////// Step submission
                        if (isFinalizedSubmission == false && isProgressiveSubmit == false) {
                            _utilsSvc.raiseFormsEvent(workingFormInfo, {
                                type: "formsNavigationNextStep",
                                targetStep: nextStep
                            });

                            var oldData = _dataSvc.loadFormDataFromStorage(workingFormInfo.Id), // Get the current data collection
                                newMergeData = $.extend(oldData, {
                                    __FormSubmissionId: returnedResult.data.submissionId
                                });
                            _dataSvc.saveFormDataToStorage(workingFormInfo.Id, newMergeData);

                            _utilsSvc.raiseFormsEvent(workingFormInfo, {
                                type: "formsSubmitted",
                                formData: formData,
                                isFinalizedSubmission: false,
                                isSuccess: returnedResult.isSuccess,
                                returnedResult: returnedResult
                            });

                            navigateToStep(nextStep, workingFormInfo);
                            return false; // quit the doSubmitForm()
                        }

                        //if finalize form reset form values
                        if (isFinalizedSubmission == true) {
                            _resetFormValues($workingForm, workingFormInfo);
                        }

                        _utilsSvc.raiseFormsEvent(workingFormInfo, {
                            type: "formsSubmitted",
                            formData: formData,
                            isFinalizedSubmission: isFinalizedSubmission,
                            isSuccess: returnedResult.isSuccess,
                            returnedResult: returnedResult
                        });

                        var stepCount = workingFormInfo.StepsInfo.Steps.length;
                        if (returnedResult.redirectUrl) {
                            window.location.href = returnedResult.redirectUrl;
                            return false; // quit the doSubmitForm()
                        } else if (isProgressiveSubmit == false && !nextStep && currentStepIndex < stepCount - 1) {
                            // We cannot find a satisfied step, just redirect to last step for consitent with non-js mode.
                            // (the last step will not display form elements in this case)
                            navigateToStep(workingFormInfo.StepsInfo.Steps[stepCount - 1], workingFormInfo);
                        } else {
                            // show success message and hide form body
                            $(".Form__MainBody, [data-f-mainbody]", workingFormInfo.$workingForm).hide();
                            showFormMessage(workingFormInfo, returnedResult.message, true);
                        }
                    } else { // server return fail then show the reason
                        _navigationBarUpdate(workingFormInfo);

                        _utilsSvc.raiseFormsEvent(workingFormInfo, {
                            type: "formsSubmitted",
                            formData: formData,
                            isSuccess: returnedResult.isSuccess,
                            returnedResult: returnedResult
                        });

                        if (returnedResult.message) {
                            showFormMessage(workingFormInfo, returnedResult.message);
                        }

                        // validation fail then got the elements and corresponding validators which causes fail
                        if (returnedResult.data && returnedResult.data.validationInfo && returnedResult.data.validationInfo.length > 0) {
                            showServerValidationMessage(workingFormInfo, returnedResult.data.validationInfo);
                        }
                    }
                });

                request.fail(function onFormSubmittingError(xhr, typeOfFailure, status) {
                    e.preventDefault();
                    _utilsSvc.raiseFormsEvent(workingFormInfo, {
                        type: "formsSubmittedError",
                        formData: formData,
                        isSuccess: false,
                        xhr: xhr,
                        typeOfFailure: typeOfFailure,
                        status: status
                    });
                    showFormMessage(workingFormInfo, typeOfFailure + " " + xhr.status + ": " + status);
                });

                request.always(function onFormSubmittingComplete() {
                    //A function to be called when the request finishes (after success and error callbacks are executed).
                    $actionButton.prop("disabled", false);
                    _navigationBarUpdate(workingFormInfo); // refresh the state of next/prev button, because nextbutton can be submit button, and it loses its :disabled state in submitting process
                });
            }

            // show validation fail message on each element
            function showServerValidationMessage(workingFormInfo, validationInfo) {
                var $element = null;
                for (var i = 0; i < validationInfo.length; i++) {
                    if (validationInfo[i] && validationInfo[i].invalidElement) {
                        // get the elements from its id
                        $element = $("#" + validationInfo[i].invalidElement + "", workingFormInfo.$workingForm);
                        var $messageContainer = _getValidationMessage($element),
                            validatorsInfo = _validationSvc.getElementValidators(workingFormInfo.ValidationInfo, validationInfo[i].invalidElement),
                            validatorInfo = _validationSvc.getValidatorByValidatorType(validatorsInfo, validationInfo[i].validator);

                        // call event onServerValidateFailed for element update its UI if needed
                        if (validatorInfo) {
                            var validatorObj = epi.EPiServer.Forms.Validators[validatorInfo.type],
                                func_onServerValidateFailed = validatorObj["onServerValidateFailed"];
                            if (func_onServerValidateFailed && typeof (func_onServerValidateFailed) === "function") {
                                func_onServerValidateFailed.apply(validatorObj, [$element, validatorInfo]);
                            }
                        }

                        $messageContainer.text(validationInfo[i].validationMessage || epi.EPiServer.Forms.Messages.viewMode.commonValidationFail).show();
                    }
                }
                if ($element) {
                    _refreshCaptchaElement($element.parents(".FormStep:first, [data-f-type='step']:first"));
                }
            }

            // show Summarized of submitted Data before submitting. Return true of end user accept to submit data
            function showSummarizedData(workingFormInfo, data) {

                var $deferred = $.Deferred();

                // is this form configured to show summarized data before submitting?
                if (!workingFormInfo.ShowSummarizedData) {
                    $deferred.resolve(true);

                    return $deferred.promise();
                }

                var shouldBeHiddenKeys = [],
                    ignoreFields = ["__FormGuid", "__FormLanguage", "__FormCurrentStepIndex", "__FormSubmissionId"];

                return _extensionSvc.showSummarizedText(data, workingFormInfo, ignoreFields, shouldBeHiddenKeys);
            }

            // show the message to Form's message area, give empty <param message> to clear the message panel
            function showFormMessage(workingFormInfo, message, isSuccess) {

                if (!workingFormInfo) {
                    return;
                }

                var $messagePanel = $(".Form__Status__Message, [data-f-form-statusmessage]", workingFormInfo.$workingForm);
                // reset messagePanel css classes
                $messagePanel.removeClass("Form__Warning__Message").removeClass("Form__Success__Message");

                if (isSuccess == true && message) {
                    $messagePanel.removeClass("hide").addClass("Form__Success__Message").html(message);
                } else if (message) {
                    $messagePanel.removeClass("hide").addClass("Form__Warning__Message").html(message);
                } else {
                    $messagePanel.addClass("hide").html("");
                }
            }

            // rebind DOM dynamic-element (of current $workingForm) base on form's storage data
            function _rebindElementWithFormStorageData(formData, $workingForm) {

                $.each(formData, function (name, val) {
                    // bind checkbox, radio, dropdown, ... state
                    // $item here is element container
                    var elementName = name.indexOf("__TempData") !== -1 ? name.replace("__TempData", "") : name,
                        $item = $('[data-epiforms-element-name="' + elementName + '"], [data-f-element-name="' + elementName + '"]', $workingForm);

                    if ($item.length === 0) {
                        return;
                    }

                    if ($item.hasClass("FormExcludeDataRebind") || !!$item.data("f-excludedatarebind")) {
                        return;
                    }

                    var datainputs = $item.find(".FormChoice__Input--Checkbox, [data-f-datainput]:checkbox");
                    if (datainputs.length > 0) {
                        // several input-checkbox will have same name
                        $.each(datainputs, function () {
                            var currentInputValue = $(this).val();
                            // val is array of selectedValues, or a string of selected Value
                            $(this).attr("checked", val.indexOf(currentInputValue) > -1);
                        });
                        return;
                    }

                    datainputs = $item.find(".FormChoice__Input--Radio, [data-f-datainput]:radio");
                    if (datainputs.length > 0) {
                        var savedItemValue = Array.isArray(val) ? val[0] : val;

                        // several input-radio will have same name, we have to filter by value as well
                        $.each(datainputs, function () {
                            var currentInputValue = $(this).val();
                            $(this).attr("checked", savedItemValue == currentInputValue);
                        });
                        return;
                    }

                    if ($item.hasClass("FormSelection") || _utilsSvc.isElementType($item, "selection")) {
                        // only check options that are enabled
                        $("option:enabled", $item).each(function (i, el) {
                            $(el).attr("selected", val.indexOf($(el).val()) > -1);
                        });
                        return;
                    }

                    // don't rebind entered value for captcha
                    if ($item.hasClass("FormCaptcha") || _utilsSvc.isElementType($item, "captcha")) {
                        return;
                    }

                    datainputs = $item.find(".FormFileUpload__Input, [data-f-datainput]:file");
                    if (datainputs.length > 0) {
                        var postedFileNames = "";
                        if (val instanceof Array && val.length > 0) {
                            var elementNames = val.map(function (elem) {
                                return elem.name;
                            }).join(", ");
                            postedFileNames = postedFileNames.concat(elementNames);
                        }

                        if (postedFileNames !== "") {
                            var postedFiledMessage = _utilsSvc.stringFormat(epi.EPiServer.Forms.Messages.fileUpload.postedFile, [postedFileNames]),
                                $postedFileMessage = _getPostedFileMessage($item);
                            $postedFileMessage.text(postedFiledMessage).show();
                        }

                        return;
                    }

                    // if the element need custom binding data
                    if ($item.hasClass("Form__CustomElement") || _utilsSvc.isElementType($item, "custom")) {
                        _extensionSvc.bindCustomElementValue($item, val);
                        return;
                    }

                    // default case, textbox, textarea, selection, ... jQuery.val() can do itself
                    $item.find("[data-f-datainput]:first").val(val);

                }); // end each(data)

            }

            // Gets posted file message element
            function _getPostedFileMessage($fileUploadElement) {
                var $messageContainer = $fileUploadElement.find(".FormFileUpload__PostedFile, [data-f-postedFile]");
                return $messageContainer;
            }

            // Gets current step form data, New data (of current step) will be merged with old data, and new field's value will overrides old one.
            function getCurrentStepData($workingForm, excludeCallback) {
                var workingFormInfo = getFormDescriptor($workingForm),
                    // get currentStepDOM and collect input in this step only
                    $currentStep = _getCurrentStepDOM(workingFormInfo),
                    newData = collectInputData($currentStep, excludeCallback),
                    oldData = _dataSvc.loadFormDataFromStorage(workingFormInfo.Id); // Get the current data collection

                return $.extend(oldData, newData);
            }

            // Gets current form data, New data will be merged with old data, and new field's value will overrides old one.
            function getCurrentFormData($workingForm) {
                var workingFormInfo = getFormDescriptor($workingForm),
                    newData = collectInputData($workingForm),
                    oldData = _dataSvc.loadFormDataFromStorage(workingFormInfo.Id);

                return $.extend(oldData, newData);
            }


            // From DOM element, get the FormDescriptor object
            function getFormDescriptor($workingForm) {
                var workingFormGuid = _utilsSvc.getFormIdentifier($workingForm),
                    workingFormInfo = epi.EPiServer.Forms[workingFormGuid];

                workingFormInfo.$workingForm = $workingForm;

                return workingFormInfo;
            }

            // scan all DataElement inside the $container, take data from users (from input control)
            function collectInputData($container, excludeCallback) {
                var result = {}; // this is data dictionary, key will be elementName, value is value of element

                _extensionSvc.getAllDataElements($container).each(function (index, el) {
                    var $el = $(el);
                    if (typeof excludeCallback === "function" && excludeCallback($el)) {
                        return;
                    }

                    // For the hidden steps that users have not visited, their data will be ignored.
                    if (($el.parents(".FormStep:first, [data-f-type='step']:first").hasClass("hide"))) {
                        return;
                    }

                    var elementName = _utilsSvc.getElementName($el);
                    if (!elementName) {
                        return;
                    }

                    // bind data to file upload
                    if ($el.hasClass("FormFileUpload") || _utilsSvc.isElementType($el, "fileupload")) {
                        var $fileInputEl = $(".FormFileUpload__Input, [data-f-datainput]", $el)[0],
                            tempdataName = elementName + "__TempData";
                        result[elementName] = [];
                        result[tempdataName] = [];

                        if (!$fileInputEl || $fileInputEl.files.length === 0) {
                            var files = _utilsSvc.getPreviousPostedFiles($el);
                            result[elementName] = files;
                            result[tempdataName] = files;
                        } else {
                            for (var fileIdx = 0; fileIdx < $fileInputEl.files.length; fileIdx++) {
                                var oFile = $fileInputEl.files[fileIdx];

                                result[elementName].push({
                                    name: oFile.name,
                                    file: oFile
                                });
                                result[tempdataName].push({
                                    name: oFile.name
                                });
                            }
                        }
                        return;
                    }

                    // if none is selected then assign empty value so that the element's name presents in the post,
                    // available name will tell server side that this posts an empty value and an asscociate field must be created
                    result[elementName] = _utilsSvc.getElementValue($el);
                });

                return result;
            }


            /// Scan all Form__Element in a specific container element (currently only support Step element),
            /// return true if all the elements satisfy its validators.
            function validateElementsIn($container, /*Object*/ workingFormInfo) {
                if (!$container) {
                    return true; // nothing to validate then got validated of true
                }

                var isValid = true;
                // Validate textbox/textarea/selection values

                _extensionSvc.getAllDataElements($container).each(function (index, element) {
                    isValid = validateElement(element, workingFormInfo) && isValid;
                });

                _utilsSvc.raiseFormsEvent(workingFormInfo, {
                    type: "formsStepValidating",
                    isValid: isValid
                });


                workingFormInfo.$workingForm.toggleClass("ValidationSuccess", isValid);
                workingFormInfo.$workingForm.toggleClass("ValidationFail", !isValid);

                return isValid;
            }

            /// validate element, return false if fail, show/hide the $messageContainer for this element
            // element: should be the DOM root of each Form__Element
            function validateElement(element, workingFormInfo) {
                // TODO: move the showing message code to another function, this function should just do validating
                var $element = $(element),
                    $messageContainer = _getValidationMessage($element),
                    elementName = _utilsSvc.getElementName($element),
                    elementIdentifier = $element.attr("id") || elementName,
                    validators = _validationSvc.getElementValidators(workingFormInfo.ValidationInfo, elementIdentifier),
                    isValid = true;

                // reset element's validation status
                $element.removeClass("ValidationFail ValidationSuccess");
                $messageContainer.hide();
                var elementValue = _utilsSvc.getElementValue($element);

                if (workingFormInfo.DependencyInactiveElements.indexOf(elementName) < 0 && (validators instanceof Array) && validators.length > 0) {
                    var results = _validationSvc.validateFormValue(elementName, elementValue, validators),
                        invalidResultItems = $.grep(results, function (item) {
                            return item.isValid === false;
                        }),
                        targetElement = $.grep(workingFormInfo.ValidationInfo, function (item) {
                            return item.targetElementId === elementIdentifier || item.targetElementName === elementIdentifier;
                        })[0],
                        validatedElement = $("#" + targetElement.targetElementId);

                    if (invalidResultItems && invalidResultItems.length > 0) {
                        var messages = $.map(invalidResultItems, function (item) {
                            return item.message;
                        });
                        validatedElement.attr("aria-invalid", "true");
                        $element.addClass("ValidationFail");
                        $messageContainer.text(messages.join(" ")).show();

                        isValid = false;
                    } else {
                        $element.addClass("ValidationSuccess");
                        validatedElement.attr("aria-invalid", "false");
                        isValid = true;
                    }
                }

                _utilsSvc.raiseFormsEvent(workingFormInfo, {
                    type: "elementValidated",
                    isValid: isValid,

                    elementName: elementName,
                    elementValue: elementValue,
                    elementIdentifier: elementIdentifier,
                    element: element,
                    $messageContainer: $messageContainer
                });
                return isValid;
            }

            function _getValidationMessage( /*Object*/ $element) {
                // summary:
                //      Gets message container object by the given element (find by [data-f-validationerror] has same name with $element)
                // $element: [Object]
                //      Current element as jQuery object
                // returns: [Object]
                //      Message container as jQuery object
                // tags:
                //      private

                // try to find data-f-validationerror based on name attribute first
                var elementName = _utilsSvc.getElementName($element);
                var selector1 = _utilsSvc.stringFormat("{0}[data-epiforms-linked-name='{1}'], {0}[data-epiforms-linked-name='{2}']",
                    [".Form__Element__ValidationError", elementName, $element.attr("id")]);
                var selector2 = _utilsSvc.stringFormat("{0}[data-f-linked-name='{1}'], {0}[data-f-linked-name='{2}']",
                    ["[data-f-validationerror]", elementName, $element.attr("id")]);
                return $(selector1).add(selector2);
            }

            // init navigation panel inside Form, for changing between steps
            function navigationInit(workingFormInfo) {
                // there is no step data, // no need to do anything
                if (!workingFormInfo || !workingFormInfo.StepsInfo || !workingFormInfo.StepsInfo.Steps) {
                    return;
                }

                // initialize value of workingFormInfo.$steps
                workingFormInfo.$steps = $(".FormStep, [data-f-type='step']", workingFormInfo.$workingForm);

                // just one step, no need to init navigation anymore
                if (workingFormInfo.StepsInfo.Steps.length < 2) {
                    return;
                }

                var currentStep = workingFormInfo.StepsInfo.Steps[_utilsSvc.getCurrentStepIndex(workingFormInfo)];
                navigateToStep(currentStep, workingFormInfo); // move navigateToStep(current) here, so if we need redirection, the rest of function no need to be run.

                $(".Form__NavigationBar__Action.btnNext, [data-f-navigation-next]", workingFormInfo.$workingForm).on("click", function (e) {
                    e.preventDefault(); // because this is submit button
                    $.when(_extensionSvc.onBeforeSubmit(workingFormInfo.$workingForm)).then(function () {
                        // validate on current Step not on whole the Form
                        var $currentStep = _getCurrentStepDOM(workingFormInfo);
                        if (!validateElementsIn($currentStep, workingFormInfo)) {
                            _refreshCaptchaElement($currentStep);
                            _scrollToFirstValidationFailedElement($currentStep);
                            return false;
                        }

                        _doSubmitForm(e);
                    });
                });

                $(".Form__NavigationBar__Action.btnPrev, [data-f-navigation-previous]", workingFormInfo.$workingForm).on("click", function (e) {
                    e.preventDefault(); // because this is submit button

                    // when go back, we don't need to validate, just save the state
                    var newMergeData = getCurrentStepData(workingFormInfo.$workingForm, /*excludeCallback*/ function __excludeFileUpload($element) {
                        return $element.hasClass("FormFileUpload") || _utilsSvc.isElementType($element, "fileupload");
                    });
                    _dataSvc.saveFormDataToStorage(workingFormInfo.Id, newMergeData); // save form state before changing step

                    var prevStep = _navigationSvc.findPreviousStep(_utilsSvc.getCurrentStepIndex(workingFormInfo), workingFormInfo);
                    navigateToStep(prevStep, workingFormInfo);

                    // refresh captcha elements
                    var $step = $("section[data-epiforms-stepindex=" + prevStep.index + "], section[data-f-stepindex=" + prevStep.index + "]", workingFormInfo.$workingForm);
                    _refreshCaptchaElement($step);

                    _utilsSvc.raiseFormsEvent(workingFormInfo, {
                        type: "formsNavigationPrevStep",
                        targetStep: prevStep
                    });
                });

            } // navigationInit



            // navigate the Form to target step. This can be call on-same-page, or redirection between pages
            // @param stepToChangeTo: is StepInfo object
            function navigateToStep(stepToChange, workingFormInfo) {
                if (stepToChange) {
                    _utilsSvc.raiseFormsEvent(workingFormInfo, {
                        type: "formsNavigateToStep",
                        targetStep: stepToChange
                    });

                    // binding the elements with stored input value between Next/Prev navigation. This section must be here, because onload of a page, we call this function in navigationInit()
                    var formData = _dataSvc.loadFormDataFromStorage(workingFormInfo.Id);
                    _rebindElementWithFormStorageData(formData, workingFormInfo.$workingForm);

                    // don't redirect if steps have same attached Url (multi-step but on same page)
                    if (workingFormInfo.StepsInfo.AllStepsAreNotLinked ||
                        stepToChange.attachedContentLink == epi.EPiServer.CurrentPageLink.split("_")[0]) {
                        // this is same page navigation

                        workingFormInfo.$steps.addClass("hide"); // hide all step panel first

                        workingFormInfo.$steps.each(function (index, eStep) {
                            if (index === stepToChange.index) {
                                // only show step intended to display in this page
                                $(eStep).removeClass("hide");

                                _utilsSvc.setCurrentStepIndex(workingFormInfo, stepToChange.index);
                                return false; // break the loop
                            }
                        });
                        _utilsSvc.scrollToTheTopOfForm(workingFormInfo.$workingForm);
                    } else {
                        // this is different page navigation makes request to the FormContainerBlockController which requires the current FormGuid and expected stepIndex

                        if (stepToChange.attachedUrl && stepToChange.attachedUrl.length) {

                            window.location.replace(stepToChange.attachedUrl); // replace() does not put the originating page in the session history
                            return; // end function immediately
                        } else {
                            if (!workingFormInfo.StepsInfo.AllStepsAreNotLinked) {
                                showFormMessage(workingFormInfo, epi.EPiServer.Forms.Messages.viewMode.malformStepConfiguration);
                            }
                        }
                    }
                } else {
                    workingFormInfo.$steps.hide(); // hide all step panel first
                }

                _navigationBarUpdate(workingFormInfo);
            }

            // Find captcha element in $container and refresh it. By default, it will refresh the builtin captcha element.
            // BETA, this should be public
            // tag: public
            function _refreshCaptchaElement($container) {
                epi.EPiServer.Forms.Validators["EPiServer.Forms.Implementation.Validation.CaptchaValidator"]._refreshCaptcha($(".Form__Element.FormCaptcha, [data-f-type='captcha']", $container));
            }

            // when validate failed we need to scroll to first failed element to notify user re-enter data.
            function _scrollToFirstValidationFailedElement($container) {
                if (!$container) {
                    return;
                }

                var firstFailedElement = $(".Form__Element.ValidationFail", $container)[0];
                if (!firstFailedElement) {
                    return;
                }

                firstFailedElement.scrollIntoView();
                var dataInputs = $("[data-f-datainput]", firstFailedElement);
                if (dataInputs && dataInputs.length > 0) {
                    dataInputs[0].focus();
                }
            }

            // Navigation Bar processing, disable/enable button, show navigation indicator
            function _navigationBarUpdate(workingFormInfo) {
                var currentStepIndex = _utilsSvc.getCurrentStepIndex(workingFormInfo),
                    $navbar = $(".Form__NavigationBar, [data-f-type='navigationbar']", workingFormInfo.$workingForm);

                // hidden Next/Prev buttons if no step matchs
                if (currentStepIndex < 0) {
                    $navbar.hide();
                    return;
                }

                // show Next and Previous button first
                var $btnPrev = $(".Form__NavigationBar__Action.btnPrev, [data-f-navigation-previous]", $navbar).prop("disabled", false),
                    $btnNext = $(".Form__NavigationBar__Action.btnNext, [data-f-navigation-next]", $navbar).prop("disabled", false);
                // update/disable nav buttons usable status
                if (currentStepIndex === 0 || workingFormInfo.SubmittableStatus.submittable === false) {
                    $btnPrev.prop("disabled", true);
                }

                if (currentStepIndex === workingFormInfo.StepsInfo.Steps.length - 1 || workingFormInfo.SubmittableStatus.submittable === false) {
                    $btnNext.prop("disabled", true);
                }

                var currentDisplayStepIndex = currentStepIndex + 1, // one-base index
                    currentDisplayStepCount = workingFormInfo.StepsInfo.Steps.length;
                console.dir(currentDisplayStepIndex);
                // update the navigation bar
                $(".Form__NavigationBar, [data-f-type='navigationbar']", workingFormInfo.$workingForm).toggle(workingFormInfo.ShowNavigationBar);
                $(".Form__NavigationBar__ProgressBar__CurrentStep, [data-f-navigation-currentStep]", $navbar).text(currentDisplayStepIndex);
                $(".Form__NavigationBar__ProgressBar__StepsCount, [data-f-navigation-stepcount]", $navbar).text(currentDisplayStepCount);
                $(".Form__NavigationBar__ProgressBar--Progress, [data-f-navigation-progress]", $navbar).css({
                    width: 100 * currentDisplayStepIndex / currentDisplayStepCount + "%"
                });
                $(".stepper-item, [data-progress]", $navbar).addClass("completed");
            }

           

            // return the DOM object of current Step bases on CurrentStepIndex
            function _getCurrentStepDOM(workingFormInfo) {
                var currentIndex = _utilsSvc.getCurrentStepIndex(workingFormInfo);

                // Note that the currrent Step is normally active and visible, is there any case it is hidden???
                return $(workingFormInfo.$steps[currentIndex]);
            }

            /// HACK: THIS IS FOR IE only:
            /// "form reset" default behaviour does not clear the property "el.files" (even the "el.value" is cleared).
            /// So we need to explicitly clear it.
            function _hack_clearFileInput($el) {
                if (/MSIE/.test(navigator.userAgent)) {
                    $el.replaceWith($el = $el.clone(true)); // seem to work better, but not really good, because we might lost events bound to this element
                }
            }
        });

    }; // end init()

    /// load jquery as fundemental util library. Load external script on demand
    /// =============================================

    /// call init()
    if (epi.EPiServer.Forms.ExternalScriptSources.length <= 0 && epi.EPiServer.Forms.ExternalCssSources.length <= 0) {
        epi.EPiServer.Forms.init(); // init() once
    } else {
        // load external scripts
        _utilsSvc.loadExternalScriptOnDemand(epi.EPiServer.Forms.ExternalScriptSources, function () {
            _utilsSvc.raiseFormsEvent(null, {
                type: "formsLoadExternalScripts",
                scripts: epi.EPiServer.Forms.ExternalScriptSources
            });
            // init() after we load all external scripts
            epi.EPiServer.Forms.init(); // init() once
        });

        // load external css
        _utilsSvc.loadExternalCssOnDemand(epi.EPiServer.Forms.ExternalCssSources, function () {
            _utilsSvc.raiseFormsEvent(null, {
                type: "formsLoadExternalCss",
                Css: epi.EPiServer.Forms.ExternalCssSources
            });
        });
    }
})($$epiforms || $); // use the Forms's jQuery before using site's jQuery
