/*
 * Nethgui Js Framework
 *
 * Copyright &copy; 2011 Nethesis S.r.l.
 *
 * @author Davide Principi <davide.principi@nethesis.it>
 * @author Giovanni Bezicheri <giovanni.bezicheri@nethesis.it>
 * @author Giacomo Sanchietti <giacomo.sanchietti@nethesis.it>
 */

(function($) {

    var counter = 0;

    /**
     * Replaces ${0} .. ${N} substrings with the corresponding
     * function argument. Returns the strings where the placeholders are
     * substituted.
     *
     *
     * Example:
     *   var s = "Hello ${0} ${1}!";
     *
     *   s = s.replacePlaceholders("John", "Doe");
     *
     *   document.write(s);
     *
     * Writes "Hello John Doe!".
     */
    if (!String.prototype.replacePlaceholders) {
        String.prototype.replacePlaceholders = function(o) {
            var s = this;

            if (o === undefined) {
                return s.toString();
            } else if (typeof (o) !== 'object') {
                o = [o].concat(Array.prototype.slice.call(arguments, 1));
            }

            for (var i in o) {
                s = s.replace(new RegExp('\\$\\{' + i + '\\}', 'g'), o[i]);
            }
            return s.toString();
        }
    }


    if ($.debug === undefined) {
        $.extend({
            debug: function() {
                typeof (console) == 'object' && console.log.apply(console, arguments);
            }
        });
    }


    var Server = function() {
    };

    /**
     * Check if url is in the same domain of the current page
     */
    Server.prototype.isLocalUrl = function(url) {
        // site-root relative urls are always accepted:
        if (url.charAt(0) === '/' || url === '') {
            return true;
        }

        var currentUrlParts = window.location.href.split('/');
        var urlParts = url.split('/');

        if (!$.isArray(currentUrlParts) || !$.isArray(urlParts)) {
            return false;
        }

        for (var i = 0; i < 3; i++)
        {
            if (currentUrlParts[i] != urlParts[i]) {
                alert('Url is not local: `' + url + '`.');
                return false;
            }
        }

        return true;
    };

    Server.prototype.processResponse = function(response, statusCode) {
        $.each(response, function(index, item) {
            if (item === null) {
                return;
            }

            var selector = item[0];
            var value = item[1];

            if (selector === '__STATE__') {
                return;
            } else if (selector === '__COMMANDS__') {
                $.each(value, function(index, command) {
                    if (command.R === 'Main') {
                        $(document).trigger('nethgui' + command.M.toLowerCase(), command.A);
                    } else if(command.M.toLowerCase() === 'show') {
                        if( ! history.state || history.state.target !== command.R) {
                            history.pushState({target: command.R}, '', '#!' + command.R);
                        }
                        $('#' + command.R).trigger('nethgui' + command.M.toLowerCase(), command.A);
                    } else {
                        $('#' + command.R).trigger('nethgui' + command.M.toLowerCase(), command.A);
                    }
                });
            } else {
                $('.' + selector).each(function(index, element) {
                    $(element).triggerHandler('nethguiupdateview', [value, selector, statusCode]);
                });
            }
        });
    };

    /**
     * Perform an AJAX request on given URL
     */
    Server.prototype.ajaxMessage = function(params) {
        var isMutation, url, data, freezeElement, dispatchError, dispatchResponse, formatSuffix, isCacheEnabled;
        var self = this;

        isMutation = params.isMutation;
        url = params.url;
        data = params.data;
        freezeElement = params.freezeElement;
        formatSuffix = params.formatSuffix ? params.formatSuffix : 'json';
        isCacheEnabled = params.isCacheEnabled ? true : false;


        /**
         * Send the response containing the view data to controls
         */
        dispatchResponse = $.isFunction(params.dispatchResponse) ? params.dispatchResponse : function(response, textStatus, jqXHR) {
            if ($.isArray(response)) {
                self.processResponse(response, jqXHR.status);
            } else {
                $('<pre></pre>').text(jqXHR.responseText).dialog({
                    modal: true,
                    buttons: [
                        {
                            text: "Ok",
                            click: function() {
                                $(this).dialog("close").dialog("destroy").remove();
                            }
                        }
                    ],
                    title: 'Unexpected response entity! HTTP Status ' + jqXHR.status + ' - ' + jqXHR.statusText
                })
            }
        };

        waitAndRetry = function(delay, settings) {
            if (settings.type != 'GET') {
                return false;
            }

            window.setTimeout(function() {
                $.ajax(settings);
            }, delay);

            return true;
        };

        confirmReload = function(title, message, settings) {
            var buttons = [
                {
                    text: "Reload page",
                    click: function() {
                        window.location.reload(true);
                        $(this).dialog("close").dialog("destroy").remove();
                    }
                }
            ];
            if (settings.type === 'GET') {
                buttons.push({
                    text: "Try again",
                    click: function() {
                        waitAndRetry(100, settings);
                        $(this).dialog("close").dialog("destroy").remove();
                    }
                });
            }
            $('<pre></pre>').text(message).dialog({
                modal: true,
                buttons: buttons,
                title: title
            });
        }

        dispatchError = $.isFunction(params.dispatchError) ? params.dispatchError : function(jqXHR, textStatus, errorThrown) {
            this.failures += 1;
            if (jqXHR.status == 400 && (errorThrown == "Request validation error" || errorThrown == "Invalid credentials supplied")) {
                dispatchResponse($.parseJSON(jqXHR.responseText), errorThrown, jqXHR);
            } else if (jqXHR.status == 403 && errorThrown === 'Forbidden') {
                $('<pre></pre>').text(jqXHR.responseText).dialog({
                    modal: true,
                    buttons: [
                        {
                            text: "Ok",
                            click: function() {
                                window.location.reload(true);
                                $(this).dialog("close").dialog("destroy").remove();
                            }
                        }
                    ],
                    title: '403 - Forbidden'
                });
            } else if (jqXHR.status == 0) {
                if(textStatus === 'abort') {
                    // pass
                } else if (this.failures > 10) {
                    this.failures = 0;
                    confirmReload("Connection ERROR", "The remote server is not reachable.", this);
                } else {
                    waitAndRetry(5000, this);
                }
            } else if (jqXHR.status == 404) {
                if (this.failures > 1) {
                    this.failures = 0;
                    confirmReload("ERROR 404", jqXHR.responseText, this);
                } else {
                    waitAndRetry(5000, this);
                }
            } else {
                confirmReload("Server error", jqXHR.responseText, this);
                $.debug(errorThrown);
                throw errorThrown;
            }
        };


        /**
         * Replace the path suffix on the given url with newSuffix
         * @return string the new url string
         */
        var replaceFormatSuffix = function(url, newSuffix) {

            var urlParts = url.split('?', 2);
            var pathParts = urlParts[0].split('/');
            var lastPart = pathParts.pop();

            if (/.+\.(x?html|json)$/.test(lastPart)) {
                lastPart = lastPart.substr(0, lastPart.lastIndexOf('.')) + '.' + newSuffix;
            } else {
                lastPart += '.' + newSuffix;
            }

            if (urlParts[1] !== undefined) {
                lastPart += '?' + urlParts[1];
            }

            pathParts.push(lastPart);

            return pathParts.join('/');
        };

        if (!this.isLocalUrl(url)) {
            return;
        }

        if (freezeElement instanceof jQuery) {
            freezeElement.trigger('nethguifreezeui');
        }

        var settings = {
            url: replaceFormatSuffix(url, formatSuffix),
            type: isMutation ? 'POST' : 'GET',
            cache: isCacheEnabled,
            data: data,
            success: dispatchResponse,
            error: dispatchError,
            crossDomain: false,
            failures: 0
        };
        return $.ajax(settings);
    };


    var Translator = function() {
        this.catalog = {};
    };

    Translator.prototype.translate = function(message) {
        if (typeof this.catalog[message] === "string") {
            message = this.catalog[message];
        }
        return '' + String.prototype.replacePlaceholders.apply(message, Array.prototype.slice.call(arguments, 1));
    };

    Translator.prototype.extendCatalog = function(extension) {
        this.catalog = $.extend(this.catalog, extension);
        return this;
    };

    $.Nethgui = {
        Server: new Server(),
        Translator: new Translator(),
        T: function() {
            return $.Nethgui.Translator.translate.apply($.Nethgui.Translator, Array.prototype.slice.call(arguments, 0));
        }
    };

    $.widget('nethgui.Component', {
        _server: $.Nethgui.Server,
        _deep: true,
        _showDisabledState: true,
        _propagateDisabledState: true,
        _create: function() {
            var self = this;

            // language translation function:
            this.T = this.translate;

            this.widgetEventPrefix = this.namespace;
            this._id = ++counter;
            this._children = [];

            if (this._deep === true) {
                this._initializeDeep(this.element.children().toArray());
            }
            this.element.bind('nethguiupdateview.' + this.namespace, function(e, value, selector) {
                self._updateView(value, selector);
            });
            this.element.bind('nethguienable.' + this.namespace, function(e) {
                self.enable();
                e.stopPropagation();
            });
            this.element.bind('nethguidisable.' + this.namespace, function(e) {
                self.disable();
                e.stopPropagation();
            });
        },
        getChildren: function() {
            return $(this._children);
        },
        _getChildNodes: function() {
            return this._children;
        },
        _findType: function(jqNode) {
            var typeFound = false;
            // Check whether any class of the node is defined in nethgui namespace:
            $.each(jqNode.prop('class').split(/\s+/), function(index, typeName) {
                if (typeName in $.nethgui && jqNode.data('nethgui') === undefined) {
                    typeFound = typeName;
                    return false;
                }
            });
            return typeFound;
        },
        /**
         * Find and initialize any descendant component
         */
        _initializeDeep: function(nodeQueue) {

            var node = nodeQueue.shift();
            var typeName = false;

            // iterate on descendant nodes: if a component is found,
            // initialize it and discard its branch.
            while (node !== undefined) {
                var jqNode = $(node);

                typeName = this._findType(jqNode)
                if (typeName !== false) {
                    // constructor call:
                    if (typeName in $.fn) {
                        $.fn[typeName].apply(jqNode);
                    } else {
                        $.debug('Undefined type ' + typeName);
                    }
                    this._children.push(node);
                } else {
                    Array.prototype.push.apply(nodeQueue, jqNode.children().toArray());
                }
                node = nodeQueue.shift();
            }
        },
        _setOption: function(key, value) {
            if (key === 'disabled' && this.element.hasClass('keepdisabled')) {
                return;
            }
            if (key !== 'disabled' || this._showDisabledState === true) {
                $.Widget.prototype._setOption.apply(this, [key, value]);
            }
            if (key === 'disabled' && this._deep === true && this._propagateDisabledState === true) {
                this.getChildren().trigger('nethgui' + (value ? 'disable' : 'enable'));
            }
        },
        destroy: function() {
            $.Widget.prototype.destroy.call(this);
            this.widget().unbind(this.namespace);
            this.element.unbind(this.namespace);
            this._children = undefined;
        },
        _updateView: function(value, selector) {
            // free to override
        },
        _sendQuery: function(url, data, freezeUi) {
            this._server.ajaxMessage({
                isMutation: false,
                url: url,
                data: typeof data === 'string' ? data : undefined,
                freezeElement: freezeUi ? this.widget() : undefined
            });
        },
        _sendMutation: function(url, data, freezeUi) {
            this._server.ajaxMessage({
                isMutation: true,
                url: url,
                data: typeof data === 'string' ? data : ($.isArray(data) ? data : undefined),
                freezeElement: freezeUi ? this.widget() : undefined
            });
        },
        _readHelp: function(url) {

        },
        translate: function() {
            return Translator.prototype.translate.apply($.Nethgui.Translator, Array.prototype.slice.call(arguments, 0))
        },
        startThrobbing: function() {
            this.element.hide();
            this.element.after("<div class='throbber'>Loading...</div>");
        },
        endThrobbing: function() {
            this.element.show();
            this.element.next('.throbber').remove();
        }
    });
    
    window.onpopstate = function(e) {
        if(e.state && e.state.target) {
            $('#' + e.state.target).trigger('nethguishow');
        } else {
            $('.Action:eq(0)').trigger('nethguishow');
        }
    };
    
    $(document).bind('nethguisendquery.nethgui', function(e, url, delay, freezeUi) {
        var server = new Server();
        if (server.isLocalUrl(url)) {
            window.location = url;
        }
    }).on('nethguicancel.nethgui', function(e) {
        history.back();
    });

}(jQuery));
/*
 * InputControl
 *
 * Copyright &copy; 2011 Nethesis S.r.l.
 */
(function( $ ) {
    var SUPER = $.nethgui.Component;
    $.widget('nethgui.InputControl', SUPER, {
        _deep: false,
        _create: function() {
            SUPER.prototype._create.apply(this);
            this.element.bind('focus.' + this.namespace, $.proxy(this._onFocus, this));
            this.element.on('nethguitooltip.' + this.namespace, $.proxy(this._createTooltip, this));
            this.element.on('nethguimandatory.' + this.namespace, $.proxy(this._updateMandatoryState, this))
        },
        _updateMandatoryState: function(e, isEnabled) {
            this.element.toggleClass('mandatory', isEnabled);
        },
        _updateView: function(value) {
            this.element.val(value ? value : '');
        },
        _setOption: function( key, value ) {
            SUPER.prototype._setOption.apply( this, arguments );
            if(key === 'disabled' && ! this.element.hasClass('keepdisabled')) {
                this.element.prop('disabled', value);
            }
        },
        _onFocus: function (e) {
            e.takeMeVisible = false;
            
            if(!this.element.is(':visible')) {
                e.preventDefault();
                e.takeMeVisible = true;
            }            
        },
        _createTooltip: function(e, options) {
            if( ! this.element.Tooltip) {
                $.debug('Tooltip type was not found. Maybe jquery.nethgui.tooltip.js is missing?');
            }

            // Move tooltip on the right edge for right-labeled input controls:
            if( ! options.target && this.element.get(0).tagName.toLowerCase() === 'input'
                && this.element.parent().hasClass('label-right')) {
                options.target = this.element.siblings('label[for=' + this.element.attr('id') + ']').first();
            }

            this.element.Tooltip(options);
        }
    });
    $.widget('nethgui.Hidden', $.nethgui.InputControl, {});
    $.widget('nethgui.CheckBox', $.nethgui.InputControl, {
        _updateView: function(value) {
            if(this.element.val() === value) {
                this.element.prop('checked', true);
            } else {
                this.element.prop('checked', false);
            }                        
            this.element.trigger('change');
        } 
    });
    $.widget('nethgui.RadioButton', $.nethgui.CheckBox, {
        _create: function() {
            SUPER.prototype._create.apply(this);
            this._radioGroup = this._findGroup(this.element.get(0));
            this.element.bind('change.' + this.widgetName, $.proxy(this._change, this));
        },        
        _findGroup: function (radio) {
            return $(radio.form).find('input[name="' + radio.name + '"]').not(radio);
        },
        _change: function () {        
            if(this.element.is(':checked')) {
                this._radioGroup.trigger(this.namespace + 'unselect');            
            }
        }
    });
    $.widget('nethgui.HiddenConst', $.nethgui.InputControl, {
        _updateView: function(value) {}        
    });    
    
}( jQuery ) );
/*
 * Tooltip
 *
 * Copyright &copy; 2011 Nethesis S.r.l.
 */
(function( $ ) {
    var SUPER = $.nethgui.Component;
    $.widget('nethgui.Tooltip', SUPER, {
        _deep: false,
        options: {
            sticky: false,
            show: false,
            color: 'blue',
            style: 0,
            text: '',
            destroyOn: 'ajaxStart',
            target: false
        },
        _create: function() {
            SUPER.prototype._create.apply(this);
            var self = this;

            // error-state forces color to "red"
            if(this.options.style & 2) {
                this.element.addClass('ui-state-error');
                this.options.color = 'red';
            }

            this.element.qtip({
                position: {
                    my: 'left center',
                    at: 'right center',
                    container: this.element.parents('.ui-tabs-panel, .Action, #CurrentModule, .Inset').first(),
                    target: this.option('target')
                },
                style: {
                    classes: 'ui-tooltip-${color} ui-tooltip-shadow'.replacePlaceholders({
                        color: this.options.color
                    })
                },
                content: {
                    text: this.options.text
                }
            });

            if(this.options.show === true) {
                this.show();
            }

            if(typeof this.options.destroyOn === 'string') {
                this.element.bind(this.options.destroyOn.split(' ').join('.' + this.namespace + ' ').trim(), function (e) {
                    self.destroy();
                } );
            }
        },
        show: function() {
            this.element.qtip('show');
        },
        hide: function() {
            this.element.qtip('hide');
        },
        repaint: function() {
            this.element.qtip('redraw').qtip('reposition', undefined, false);
        },
        destroy: function () {
            SUPER.prototype.destroy.apply(this);
            this.element.qtip('destroy');
            if(this.options.style & 2) {
                this.element.removeClass('ui-state-error');
            }
        }
    });
}( jQuery ) );
/*
 * Button
 *
 * Copyright &copy; 2012 Nethesis S.r.l.
 */
(function( $ ) {
    var SUPER = $.nethgui.InputControl;
    $.widget('nethgui.Button', SUPER, {
        _create: function () {
            SUPER.prototype._create.apply(this);

            var self = this;

            if(!this.element.hasClass('givefocus')) {
                // apply jQueryUi "button" widget
                this.element.button({
                    disabled: this.element.hasClass('disabled') || this.element.hasClass('keepdisabled')
                });
            }
            this.element.click($.proxy(this._onClick, this));
            this.element.bind('nethguisetlabel.' + this.namespace, function(e, value) {
                self.element.button("option", "label", value);
                e.stopPropagation();
            });
        },
        _updateView: function(value, selector) {
            if($.isArray(value)) {
                this.element.button("option", "label", value[1]);
                value = value[0];
            }            
            if(this._server.isLocalUrl(value) && this.element[0].tagName.toLowerCase() === 'a') {
                this.element.attr('href', value);
            }
        },
        _setOption: function( key, value ) {
            if(key === 'disabled') {
                this.element.button('option', 'disabled', value);
            } else {
                SUPER.prototype._setOption.apply( this, arguments );
            }
        },
        _onClick: function(e) {
            var tagName = this.element[0].tagName.toLowerCase();

            if(tagName === 'a') {
                var href = this.element.attr('href');
                if(this.element.hasClass('cancel')) {
                    this._trigger('cancel');
                } else if(this.element.hasClass('givefocus') && href[0] === '#') {
                    $(href).trigger('focus');
                } else if(this.element.hasClass('Help')) {
                    this.element.trigger('nethguihelp', href);
                } else {
                    this._sendQuery(href, undefined, true);
                }
                e.stopPropagation();
                e.preventDefault();
            } else if(tagName === 'button' && this.element.attr('type') === 'submit') {
                e.stopPropagation();
                e.preventDefault();
                this.element.trigger('submit', [[{name: this.element.attr('name'), value: this.element.val()}]]);
            }
        }

    });
    $(document).on('submit', function (e) {        
        $(e.target.form).trigger('submit');
    });
}( jQuery ));
/*
 * Buttonset
 *
 * Copyright &copy; 2011 Nethesis S.r.l.
 */
(function( $ ) {
    var SUPER = $.nethgui.Component;
    $.widget('nethgui.Buttonset', SUPER, {
        _create: function () {
            SUPER.prototype._create.apply(this);
            this._clearWhitespaceNodes();
            this._initializeExpandButton();
            this._expandButton = undefined;
            this._panel = undefined;

            // Register a global list of opened popups to close on ESCAPE keyup. Refs #1039
            if( $(document).data('ngButtonsetPopupList') === undefined ) {
                $(document).data('ngButtonsetPopupList', []);
                $(document).bind('keyup', function (event) {
                    if(event.keyCode !== $.ui.keyCode.ESCAPE) {
                        return;
                    }
                    $.each($(document).data('ngButtonsetPopupList'), function (index, popup) {
                        $(popup).hide();
                    });
                });
            }

        },
        enable: function () {
            if(this._expandButton !== undefined) {
                this._expandButton.button('enable');
            }
        },
        disable: function () {
            if(this._expandButton !== undefined) {
                this._expandButton.button('disable');
            }
        },
        _clearWhitespaceNodes: function() {
            this.element.contents().filter(function() {
                return this.nodeType === 3
            }).remove();
        },
        /**
         * Add a button that pops up the a menu.
         *
         * The v<number> class sets the maximum number of shown buttons. Items
         * exceeding that limit fall into the menu.
         */
        _initializeExpandButton: function() {
            var matches = / v(\d+)/.exec(this.element.attr('class'));
            var limit = NaN;
            var expandButton;
            if(matches === null) {
                return false;
            }
            limit = parseInt(matches[1]);
            if(limit === NaN || limit === 0) {
                return false;
            }            
            if(this.getChildren().length <= limit) {
                return false;
            }
            var detached = this.element.children(':gt(' + (limit - 1) + ')').detach();
            var cloned = this.element.children(':lt(' + limit + ')').clone(true);
            expandButton = $('<button type="button">Expand</button>').button({
                icons: {
                    primary:'ui-icon-triangle-1-s'
                },
                text:false
            });
            expandButton.appendTo(this.element).wrap($('<span></span>', {
                'class': 'expander'
            }));
            var panel = $('<span></span>', {
                'class':'popup'
            });
            panel.insertAfter(expandButton);
            this.element.buttonset();
            cloned.appendTo(panel);
            detached.appendTo(panel); //.css('display', 'block');
            panel.hide();
            panel.find('.Button').removeClass('ui-corner-all').click(function(){
                panel.hide()
            });
            expandButton.click(function(e) {
                $('.popup').hide();
                $(document).one('click', function() {
                    panel.hide();
                });
                panel.show();
                // add panel to the global list of opened popups:
                $(document).data('ngButtonsetPopupList').push(panel.get(0));
                e.stopPropagation();
            });
            this._expandButton = expandButton;
            this._panel = panel;
            return true;
        }
    });
}( jQuery ));


/*
 * Controller
 *
 * Copyright &copy; 2011 Nethesis S.r.l.
 */
(function( $ ) {
    var SUPER = $.nethgui.Component;
    $.widget('nethgui.Controller', SUPER, {
        _create: function () {
            SUPER.prototype._create.apply(this);
            this.element.children('ul.ActionList').remove();
            this.element.bind('nethguishow.' + this.namespace, $.proxy(this._onShow, this));
            this.element.children('.Action:eq(0)').trigger('nethguishow');
        },
        _onShow: function (e) {
            if(this.element.get(0) === e.target) {
                // redirect to first Action:
                e.stopPropagation();
                this.element.getChildren().first().trigger('nethguishow');
            } else {
                this.getChildren().filter(function (idx, action) {
                    return action !== e.target && $(action).find(e.target).length === 0;
                    }).trigger('nethguihide');
                }
            }
    });
}( jQuery ));
/*
 * Action
 *
 * Copyright &copy; 2011 Nethesis S.r.l.
 */
(function( $ ) {
    var SUPER = $.nethgui.Component;
    $.widget('nethgui.Action', SUPER, {
        _create: function () {
            SUPER.prototype._create.apply(this);
            var behaviour = this.element.hasClass('Dialog') ? 'Dialog' : 'Default';
            this._form = this.element.children('form').on('submit.' + this.namespace, $.proxy(this._onSubmit, this));
            this.element.bind('nethguishow.' + this.namespace, $.proxy(this['_onShow' + behaviour], this));
            this.element.bind('nethguihide.' + this.namespace, $.proxy(this['_onHide' + behaviour], this));            
            this.element.bind('nethguireloaddata.' + this.namespace, $.proxy(this._onReloadData, this));
            this.element.bind('nethguisendquery.' + this.namespace, $.proxy(this._onSendQuery, this));
            this.element.bind('nethguisetmandatoryfields.' + this.namespace, $.proxy(this._onSetMandatoryFields, this))
        },
        _onSetMandatoryFields: function(e, fields) {
            if( ! $.isPlainObject(fields)) {
                return;
            }
            e.stopPropagation();
            $.each(fields, function(index, value) {
                $('#' + index).triggerHandler('nethguimandatory', [value ? true : false]);
            });
        },
        _onReloadData: function (e, delay) {
            var url = this._form.attr('action');
            var self = this;

            delay = parseInt(delay)
            if(delay < 1000) {
                delay = 1000;
            } else if ( delay > 10000) {
                delay = 10000;
            }
            window.setTimeout(function() {
                self._sendQuery(url, undefined, false)
            }, delay);            
            e.stopPropagation();
        },
        _onSendQuery: function(e, url, delay, freezeUi) {
            var self = this;
            
            if(freezeUi === undefined) {
                freezeUi = true;
            }

            if(delay === undefined || parseInt(delay) === 0) {
                this._sendQuery(url, undefined, freezeUi);
            } else if(parseInt(delay) > 0) {
                window.setTimeout(function() {
                    self._sendQuery(url, undefined, freezeUi)
                }, delay);
            }
            e.stopPropagation();
        },
        _onSubmit: function (e, additionalData) {
            e.preventDefault();
            e.stopPropagation();            
            var form = e.target.tagName.toLowerCase() === 'form' ? $(e.target) : $(e.target).closest('form');
            var formData = form.serializeArray();
            if($.isArray(additionalData)) {
                $.merge(formData, additionalData);
            }

            if(form.attr('method').toUpperCase() === 'POST') {
                this._sendMutation(form.attr('action'), formData, true);
            } else {
                var url = form.attr('action');
                if(formData.length > 0) {
                    url += '?' + $.param(formData);
                }
                this._sendQuery(url, undefined, true);
            }
            return false;
        },
        _onHideDefault: function (e) {
            this.element.hide();
        },
        _onShowDefault: function (e) {
            this.element.show();
        },
        _onHideDialog: function (e) {
            if(this._dialog === undefined) {
                this._initDialog();
            }
            if(this._dialog.dialog('isOpen')) {
                this._dialog.dialog("close");                
            }
            e.stopPropagation();
        },
        _onShowDialog: function (e) {
            if(this._dialog === undefined) {
                this._initDialog();
            }
            if(!this._dialog.dialog('isOpen')) {
                this._dialog.dialog("open");             
            }
            e.stopPropagation();
        },
        _onResizeDialog: function (e) {
            if(this._dialog === undefined) {
                return;
            }

            this._dialog.dialog('option', 'width', this._dialog.dialog('option', 'height', 'auto'));

            e.stopPropagation();
        },
        _initDialog: function() {
            var self = this;
            
            var titleNode = this.element.find('h1, h2, h3').first().bind('nethguichanged.' + this.namespace, function(e, value) {
                self._dialog.dialog('option', 'title', value);
            }).hide();

            var content = this.element.children().detach();

            this._dialog = $('<div class="Dialog"></div>');
            this.element.append(this._dialog).hide();
            this._dialog.append(content).dialog({
                modal: true,
                autoOpen: false,
                position: ['center', 50],
                title: titleNode.text()
            }).bind('nethguicancel.' + this.namespace, $.proxy(this._onHideDialog, this))
            .bind('nethguiresizeend.' + this.namespace, $.proxy(this._onResizeDialog, this));
        }
    });
}( jQuery ));
/*
 * Form
 *
 * Copyright &copy; 2011 Nethesis S.r.l.
 */
(function( $ ) {
    var SUPER = $.nethgui.Component;
    $.widget('nethgui.Form', SUPER, {
        _updateView: function (value) {
            this.element.attr('action', value);
        }
    });
}( jQuery ));
/*
 * TextLabel
 *
 * Copyright &copy; 2011 Nethesis S.r.l.
 */
(function( $ ) {
    var SUPER = $.nethgui.Component;
    $.widget('nethgui.TextLabel', SUPER, {
        _deep: false,
        options: {
            'hsc': false,
            'template': '${0}',
            'static': true
        },
        _create: function() {
            SUPER.prototype._create.apply(this);

            var options = this.element.attr('data-options') ? $.parseJSON(this.element.attr('data-options')) : {};

            if(typeof options === 'object') {
                this.option(options);
            }
            
            if(this.option('static')) {
                this.renderLabel([]);
            }

        },
        _updateView: function(value) {
            if($.isArray(value)) {
                this.renderLabel(value);
            } else {
                this.renderLabel([value]);
            }
        },
        renderLabel: function(args) {
            if( ! $.isArray(args)) {
                args = [args];
            }
            this.setLabel(String.prototype.replacePlaceholders.apply(this.option('template') ? this.option('template') : '', args));
        },
        setLabel: function(text) {
            if(this.option('hsc')) {
                this.element.text(text);
            } else {
                this.element.empty();
                this.element.append(text);
            }
            
            this._trigger('changed', undefined, text);
        }
    });
    
}( jQuery ));
/*
 * TextInput
 */
(function( $ ) {
    var SUPER = $.nethgui.InputControl;
    $.widget('nethgui.TextInput', SUPER, {
        _deep: false,
        _create: function() {
            SUPER.prototype._create.apply(this);
            // Attach datepicker to Date input fields:
            if(this.element.hasClass('Date')) {
                if(this.element.hasClass('le')) {
                    this.element.datepicker({
                        dateFormat:'dd/mm/yy'
                    });
                } else if(this.element.hasClass('me')) {
                    this.element.datepicker({
                        dateFormat:'mm-dd-yy'
                    });
                } else {
                    this.element.datepicker({
                        dateFormat:'yy-mm-dd'
                    });
                }
            }
            this._onContentChange();
            this.element.on('nethguimandatory.' + this.namespace + ' keyup.' + this.namespace, $.proxy(this._onContentChange, this));
        },
        _onContentChange: function() {
            if(this.element.hasClass('mandatory') && ! this.element.val()) {
                this.element.addClass('active');
            } else {
                this.element.removeClass('active');
            }
        }
    });
}( jQuery ) );
/*
 * ObjectsCollection
 *
 * Copyright &copy; 2013 Nethesis S.r.l.
 */
(function($) {
    var SUPER = $.nethgui.Component;

    $.widget('nethgui.ObjectsCollection', SUPER, {
        _deep: true,
        _create: function() {
            this.state = $.extend({rendered: false, template: '', ifEmpty: ''}, this.element.attr('data-state') ? $.parseJSON(this.element.attr('data-state')) : {});
            SUPER.prototype._create.apply(this);
        },
        _updateView: function(value, selector) {
            SUPER.prototype._updateView.call(this, value, selector);
            var self = this;
            self.element.empty();

	    if( ! $.isArray(value)) {
		value = [];
	    }

            $.each(value, function(index, record) {
                var placeholderValues = {};
                for(var p in self.state.placeholders) {
                   placeholderValues[p] = record[self.state.placeholders[p]];
                }
                var node = $(self.state.template.replacePlaceholders($.extend(placeholderValues, {'key': record[self.state.key]})));
                node.appendTo(self.element);
                SUPER.prototype._initializeDeep.call(self, node.toArray());
                $.each(record, function(rkey, rval) {                    
                    if (node.hasClass(rkey)) {
                        node.triggerHandler('nethguiupdateview', [rval, rkey, null]);
                    }
                    node.find('.' + rkey).each(function(index, tgt) {                        
                        $(tgt).triggerHandler('nethguiupdateview', [rval, rkey, null]);
                    });
                    
                });
            });

            if(self.element.children().length === 0) {
                self.element.html(self.state.ifEmpty);
            }

        }
    });

}(jQuery));

jQuery(function ($) {
    $(window).on('unload beforeunload', function(e) {
       if($('input.T0df75b78').val() == '1') {
            return 'Aucun changement n'a été appliqué.';
       }
    });

    $('#FirewallRules_Index_Rules').sortable({
        axis: 'y',
        handle: '.actbox',
        placeholder: 'placeholder',
        opacity: 0.6,        
        forcePlaceholderSize: true,
        update: function(e, ui) {            
            var prev = Number(ui.item.prev().find('input.Position').val());
            var next = Number(ui.item.next().find('input.Position').val());

            if( ! prev) {
                prev = 0;
            }
            if( ! next) {
                next = prev + 2 * 64;
            }

            var newpos = prev + Math.floor((next - prev) / 2);          
            ui.item.find('input.Position').val(newpos);            

            var formElement = $('#FirewallRules_Index').find('form');
            $.Nethgui.Server.ajaxMessage({
                isMutation: true,
                url: formElement.prop('action') + '/sortonly',
                data: formElement.serialize(),
                freezeElement: $(this)
            });
        }
    });
    var style = '<style type="text/css">.Position {display: none}</style>';
    $('head').append(style);
    
    $('input.T0df75b78').on('nethguiupdateview', function (e, val) {
        $('#FirewallRules_Index_Commit').trigger(val === '1' ? 'nethguienable' : 'nethguidisable');
    }).on('nethguicreate', function () {
        var val = $(this).attr('value');
        window.setTimeout(function() {
            $('#FirewallRules_Index_Commit').trigger(val === '1' ? 'nethguienable' : 'nethguidisable');
        }, 100);
    });

    
});

/*!
 * jQuery UI Touch Punch 0.2.3
 *
 * Copyright 2011–2014, Dave Furfero
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Depends:
 *  jquery.ui.widget.js
 *  jquery.ui.mouse.js
 */
!function(a){function f(a,b){if(!(a.originalEvent.touches.length>1)){a.preventDefault();var c=a.originalEvent.changedTouches[0],d=document.createEvent("MouseEvents");d.initMouseEvent(b,!0,!0,window,1,c.screenX,c.screenY,c.clientX,c.clientY,!1,!1,!1,!1,0,null),a.target.dispatchEvent(d)}}if(a.support.touch="ontouchend"in document,a.support.touch){var e,b=a.ui.mouse.prototype,c=b._mouseInit,d=b._mouseDestroy;b._touchStart=function(a){var b=this;!e&&b._mouseCapture(a.originalEvent.changedTouches[0])&&(e=!0,b._touchMoved=!1,f(a,"mouseover"),f(a,"mousemove"),f(a,"mousedown"))},b._touchMove=function(a){e&&(this._touchMoved=!0,f(a,"mousemove"))},b._touchEnd=function(a){e&&(f(a,"mouseup"),f(a,"mouseout"),this._touchMoved||f(a,"click"),e=!1)},b._mouseInit=function(){var b=this;b.element.bind({touchstart:a.proxy(b,"_touchStart"),touchmove:a.proxy(b,"_touchMove"),touchend:a.proxy(b,"_touchEnd")}),c.call(b)},b._mouseDestroy=function(){var b=this;b.element.unbind({touchstart:a.proxy(b,"_touchStart"),touchmove:a.proxy(b,"_touchMove"),touchend:a.proxy(b,"_touchEnd")}),d.call(b)}}}(jQuery);
/*
 * Selector
 *
 * Copyright &copy; 2011 Nethesis S.r.l.
 */
(function( $ ) {
    var SUPER = $.nethgui.Component;
    $.widget('nethgui.Selector', SUPER, {
        _deep: false,
        _create: function() {
            SUPER.prototype._create.apply(this);
            
            var cssClasses = this.element.attr('class').split(/\s+/);

            this._datasourceTarget = cssClasses.pop();
            this._valueTarget = cssClasses.pop();
            this._mode = (this.element.prop('tagName').toUpperCase() == 'SELECT') ? 'dropdown' : 'list';
            this._selection = [];
            this._multiple = this.element.hasClass('multiple');
            this._meta = this.element.children('input[type="hidden"]').first();
            this.element.on('nethguitooltip.' + this.namespace, $.proxy(this._createTooltip, this));
        },
        _setOption: function( key, value ) {
            SUPER.prototype._setOption.apply( this, arguments );
            if(key === 'disabled' && ! this.element.hasClass('keepdisabled')) {
                this.element.prop('disabled', value);
                this.element.find('input').prop('disabled', value);
            }
        },
        _renderDatasourceDropdown: function (value) {
            var self = this;
            if( ! $.isArray(value)) {
                return;
            }
            this.element.empty();
            
            this._renderOptgroup(this.element, value);           
        },
        _renderOptgroup: function(element, items) {
            var self = this;            
            $.each(items, function (index, item) {
                var optgroup;
                if($.isArray(item[0])) {
                    optgroup = $('<optgroup />', {label: item[1]});
                    element.append(optgroup);
                    self._renderOptgroup(optgroup, item[0]);
                } else {
                    element.append($('<option />', {
                        value: item[0],
                        selected: $.inArray(item[0], self._selection) >= 0 ? 'selected' : undefined
                    }).text(item[1]));
                }
            });            
        },
        _renderDatasourceWidgetList: function (value) {
            var self = this;
            var inputType = self._multiple ? 'checkbox' : 'radio';
            var ul = this.element.children('ul').first();
            var prefixId = this._valueTarget;
            var prefixName = this._meta.attr('name');

            if( ! ($.isArray(value) || $.isPlainObject(value))) {
                return;
            }

            if ( ul.size() > 0 ) {
                // clear all existing choices
                ul.empty();
            } else {
                // create a new UL tag and append it
                ul = $('<ul/>');
                this.element.append(ul);
            }


            // Fill the list of checkboxes
            for(var i in value) {
                var input = $('<input />');
                var li = $('<li />');
                var label = $('<label />');
                var inputId = prefixId + '_' + i;

                input.attr('type', inputType);
                input.attr('value', value[i][0]);
                input.attr('id', inputId);
                input.attr('name',  prefixName + (self._multiple ? '[' + i + ']' : ''));
                input.attr('class', 'choice');
                input.prop('disabled', self.element.prop('disabled'));

                if($.inArray(value[i][0], self._selection) >= 0) {
                    input.attr('checked', 'checked');
                }

                label.attr('for', inputId);
                label.text(value[i][1]);

                li.addClass('labeled-control label-right');
                li.append(input);
                li.append(label);

                ul.append(li);
            }
        },
        _updateView: function(value, control) {            
            if(control == this._valueTarget) {
                this.select(value);
            } else if(control == this._datasourceTarget) {
                if(this._mode == 'list') {
                    this._renderDatasourceWidgetList(value);
                } else if(this._mode == 'dropdown') {
                    this._renderDatasourceDropdown(value);
                }
            }
        },
        /*
         * Transfer UI selection into the object internal state.
         */
        select: function (value) {

            if($.isArray(value)) {
                this._selection = value;
            } else if($.isPlainObject(value)) {
                this._selection = [];
                for(var i in value) {
                    this._selection.push(value[i]);
                }
            } else {
                this._selection = [value];
            }

            this.refresh();
        },
        /*
         * Transfer the selection from the object internal state to UI
         */
        refresh: function () {
            var selectedProp, widgetSelector;
            var self = this;

            if(this._mode == 'list') {
                selectedProp = 'checked';
                widgetSelector = 'li input.choice';
            } else if(this._mode == 'dropdown') {
                selectedProp = 'selected';
                widgetSelector = 'option';
            }

            this.element.find(widgetSelector).each(function() {
                var option = $(this);

                if($.inArray(option.attr('value'), self._selection ) >= 0) {
                    option.prop(selectedProp, true);
                } else {
                    option.prop(selectedProp, false);
                }

            });
        },
        _createTooltip: function(e, options) {
            this.element.Tooltip(options);
        }
    });
}( jQuery ));
/*
 * FieldsetSwitch
 *
 * API:
 *
 * - select()
 */
(function( $ ) {
    var SUPER = $.nethgui.Component;
    $.widget('nethgui.FieldsetSwitch', SUPER, {
        _deep: true,
        _showDisabledState: false,
        _create: function() {
            SUPER.prototype._create.apply(this);
            
            this._switch = this.element.find('input:radio, input:checkbox').first();
            this._panel = this.element.children('fieldset.FieldsetSwitchPanel').first();

            this._switch.bind('change.' + this.widgetName, $.proxy(this._updatePanelState, this));
            this._switch.bind(this.namespace + 'unselect.' + this.widgetName, $.proxy(this._unselect, this));

            this._updatePanelState();
        },
        _updatePanelState: function() {
            if(this._switch.is(':checked')) {
                this._select();
            } else {
                this._unselect();
            }
        },
        _select: function () {
            this._panel.FieldsetSwitchPanel('setPropagateDisabledState', true);
            this._panel.trigger('nethguienable');
            if(this.element.hasClass('expandable')) {
                this._panel.show();
            }
        },
        _unselect: function () {            
            if(this.element.hasClass('expandable')) {
                this._panel.hide();
            }
            this._panel.trigger('nethguidisable');
            this._panel.FieldsetSwitchPanel('setPropagateDisabledState', false);
        },
        enable: function() {
            this._panel.FieldsetSwitchPanel('setPropagateDisabledState', this._switch.prop('checked'));
            SUPER.prototype.enable.call(this);
        }
    });
    $.widget('nethgui.FieldsetSwitchPanel', SUPER, {
        _deep: true,
        _showDisabledState: false,
        _create: function() {
            SUPER.prototype._create.apply(this);
        },
        setPropagateDisabledState: function(value) {
            this._propagateDisabledState = value;
        }
    });
}( jQuery ) );

jQuery(function ($) {
    $('.Tcec1005d').hide();
    $('.T63853072').css({'background-color': 'white', 'cursor': 'pointer'}).on('click', function(e) { $(this).next().click(); });
});

jQuery(function ($) {
    $('.T2e4ff137').hide();
    $('.T81b33529').css({'background-color': 'white', 'cursor': 'pointer'}).on('click', function(e) { $(this).next().click(); });
});

jQuery(function ($) {
    $('.T0f8cb313').hide();
    $('.T969c551a').css({'background-color': 'white', 'cursor': 'pointer'}).on('click', function(e) { $(this).next().click(); });
});

jQuery(function ($) {
    $('.T5e3360e4').hide();
    $('.T8e9a45a7').css({'background-color': 'white', 'cursor': 'pointer'}).on('click', function(e) { $(this).next().click(); });
});

jQuery(function ($) {
    $('.T1242ddf7').hide();
    $('.T8ce6e7d8').css({'background-color': 'white', 'cursor': 'pointer'}).on('click', function(e) { $(this).next().click(); });
});

jQuery(function ($) {
    $('.Tf17a0f9d').hide();
    $('.T8bc65744').css({'background-color': 'white', 'cursor': 'pointer'}).on('click', function(e) { $(this).next().click(); });
});

jQuery(function ($) {
    $('.T207f9927').hide();
    $('.T907c9a0e').css({'background-color': 'white', 'cursor': 'pointer'}).on('click', function(e) { $(this).next().click(); });
});

jQuery(function ($) {
    $('.T1b1396d7').hide();
    $('.T04247080').css({'background-color': 'white', 'cursor': 'pointer'}).on('click', function(e) { $(this).next().click(); });
});

jQuery(function ($) {
    $('.T5d421253').hide();
    $('.Ta741d8aa').css({'background-color': 'white', 'cursor': 'pointer'}).on('click', function(e) { $(this).next().click(); });
});

jQuery(function ($) {
    $('#FirewallRules_PickObject').on('change', function (e) { $(e.target).closest('form').submit(); });
    $('#FirewallRules_PickObject .Buttonlist').hide();
    $('#FirewallRules_PickObject .T1aa62e6d').hide();
    var style = $(['<style type=\'text/css\'>',
'#FirewallRules_PickObject .Selector .choice {display: none}',
'#FirewallRules_PickObject div.TextLabel, #FirewallRules_PickObject .searchform {margin-bottom: 1em}',
'#FirewallRules_PickObject .searchform  .styledinput {padding: 3px; border: 1px solid #d3d3de}',
'#FirewallRules_PickObject .searchform input[type=text] {display: block; width: 100%; border: 0; padding: 0; margin 0; outline: none; background: transparent}',
'#FirewallRules_PickObject .Selector label, #FirewallRules_PickObject a.Button.link.Create {vertical-align: middle; display: block; height: 30px; margin: 0 0 0.5em 0; cursor: pointer; border: 1px solid #d3d3d3; padding: 2px; background: linear-gradient(to bottom, #e6e6e6 0%, #fff 100%);}',
'#FirewallRules_PickObject .Selector label:hover, #FirewallRules_PickObject a.Button.link.Create  {background: linear-gradient(to bottom, #f0f0f0 0%, #fff 100%)}',
'#FirewallRules_PickObject .Selector li {margin: 0}',
'#FirewallRules_PickObject .Selector label { height: auto; padding: 12px; font-family: FontAwesome;  font-style: normal;  font-weight: normal;  line-height: 1;  -webkit-font-smoothing: antialiased;  -moz-osx-font-smoothing: grayscale;}',
'#FirewallRules_PickObject .Selector label::before { content: "\\F10C\\20"; letter-spacing: 4px }',
'#FirewallRules_PickObject .Selector input[value^="host"] + label::before { content: "\\F1B2\\20" }',
'#FirewallRules_PickObject .Selector input[value^="remote"] + label::before { content: "\\F1B2\\20" }',
'#FirewallRules_PickObject .Selector input[value^="local"] + label::before { content: "\\F108\\20" }',
'#FirewallRules_PickObject .Selector input[value^="host-group"] + label::before { content: "\\F1B3\\20" }',
'#FirewallRules_PickObject .Selector input[value^="iprange"] + label::before { content: "\\F1B3\\20" }',
'#FirewallRules_PickObject .Selector input[value^="cidr"] + label::before { content: "\\F1B3\\20" }',
'#FirewallRules_PickObject .Selector input[value^="any"] + label::before { content: "\\F0AC\\20" }',
'#FirewallRules_PickObject .Selector input[value^="fwservice"] + label::before { content: "\\F013\\20" }',
'#FirewallRules_PickObject .Selector input[value^="zone"] + label::before { content: "\\F0E8\\20" }',
'#FirewallRules_PickObject .Selector input[value^="role"] + label::before { content: "\\F0C8\\20" }',
'#FirewallRules_PickObject .Selector input[value^="role;red"] + label { color: red }',
'#FirewallRules_PickObject .Selector input[value^="role;green"] + label { color: green }',
'#FirewallRules_PickObject .Selector input[value^="role;orange"] + label { color: orange }',
'#FirewallRules_PickObject .Selector input[value^="role;blue"] + label { color: blue }',
'</style>'].join("\n"));
    $('html > head').append(style);
});
/*
 * ObjectPicker [Refs #617]
 *
 * Copyright &copy; 2011 Nethesis S.r.l.
 */
(function( $ ) {
    var SUPER = $.nethgui.Component;
    $.widget('nethgui.ObjectPicker', SUPER, {
        _deep: false,
        _create: function() {
            SUPER.prototype._create.apply(this);

            var self = this;

            var objectsContainer = this.element.children('.Objects').first();
            var addButton = this.element.find('.searchbox button').first().Button().Button('enable');
            var inputField = this.element.find('.searchbox input.TextInput').first().TextInput().TextInput('enable');

            this._initializeDeep([addButton, inputField]);

            this._metadata = $.parseJSON(this.element.children('input.metadata').attr('value'));
            this._selection = {};
            this._schema = this.element.children('.schema').first().children();
            this._inputField = inputField;
            this._objectsContainer = objectsContainer;

            inputField.autocomplete({
                source: [],
                minLength: 0,
                select: function (event, ui) {
                    self.showObject(ui.item.value);
                }
            }).bind('keydown.' + this.namespace, function(event) {
                if(event.keyCode == $.ui.keyCode.ENTER) {
                    self.showObject(inputField.val());
                    inputField.autocomplete('close');
                    return false;
                }
                return true;
            });

            objectsContainer.bind('nethguiupdateview.' + this.namespace, function(event, value, source) {   
                self._objects = value;
                self.refresh();
            });

            addButton.click(function () {
                self.showObject(inputField.val());
            });

        },
        _updateView: function(value, source) {
            if($.isArray(value)) {
                this._selection[source] = value;
            } else {
                this._selection[source] = [];
            }
            this.refresh();
        },
        refresh: function() {
            var objects = this._objects;
            var selection = this._selection;
            var schema = this._schema;
            var metadata = this._metadata;
            var self = this;

            var objectsNode = this.element.children('.Objects');

            var autocompleteChoices = [];

            // An object is in "selected" state if any of its properties is selected:
            var isSelected = function (id) {
                var found = [];
                for(var r in selection) {
                    if(!$.isArray(selection[r])) {
                        continue;
                    }
                    if($.inArray(objects[id][metadata.value], selection[r]) >= 0) {
                        found.push(r);
                    }
                }

                if(found.length > 0) {
                    return found;
                }

                return false;
            };

            if(objectsNode.children('ul').length == 0) {
                objectsNode.append('<ul />');
            } else {
                objectsNode.children('ul').empty();
            }

            var ul = objectsNode.children('ul');

            var initializeObjectWidgets = function (id, labelText, widgets) {
                var labelElement;
                var selected = isSelected(id);
                var closeButton = $('<button type="button" />').text('Remove').button({
                    text: false,
                    icons:{
                        primary: 'ui-icon-close'
                    }
                }).bind('click.' + this.namespace, function () {
                    self.hideObject(objects[id][metadata.value]);
                });

                if(metadata.url !== false) {
                    labelElement = $('<a />', {
                        'class':'label',
                        'href': objects[id][metadata.url]
                    });
                } else {
                    labelElement = $('<span />', {
                        'class': 'label'
                    });
                }

                labelElement.text(labelText);

                widgets.find(':checkbox').each(function(index, element) {
                    // update id, name, for attributes, appending the proper element ID suffix:
                    var $element = $(element);

                    var elementId = $element.attr('id');
                    var elementName = $element.attr('name');
                    var eventTarget = $element.attr('class').split(' ').pop();

                    if(elementId !== undefined) {
                        $element.attr('id', elementId + '_' + id);
                    }
                    if(elementName !== undefined) {
                        $element.attr('name', elementName + '[' + id + ']');
                    }

                    $element.attr('value', objects[id][metadata.value]);
                    $element.removeAttr('class');

                    if(self._isSelector($element)) {
                        $element.prop('checked', selected !== false);
                        $element.hide();
                        $element.next('label').remove();
                    } else {
                        $element.prop('checked', $.isArray(selected) ? $.inArray(eventTarget, selected) >= 0 : false);
                        //$element.prop('checked', elementName !== undefined && selected === elementName.substring(elementName.lastIndexOf('[') + 1, elementName.lastIndexOf(']')))
                        $element.next('label').attr('for', $element.attr('id'));

			// FIXME: this may cause a memory leak!
			self._initializeDeep([$element.get(0), $element.next('label').get(0)]);
                    }

                    // disable the checkbox, if not in "selected" state
                    if(selected === false) {
                        $element.prop('disabled', 'disabled');
                    } else {
                        $element.prop('disabled', false);
                    }

                });

                return $('<li />', {
                    'style': selected ? '' : 'display: none'
                }).append(labelElement).append($('<div class="checkboxset"></div>').append(widgets).append(closeButton));
            }

            // cycle through all objects, cloning the widget schema and preparing the
            // auto-complete values:
            for(var i in objects) {
                var fragment = initializeObjectWidgets(i, objects[i][metadata.label], schema.clone());
                ul.append(fragment);
                //fragment.find(':checkbox').button();
                //fragment.find('.checkboxset').buttonset();
                autocompleteChoices.push({
                    value: objects[i][metadata.value],
                    label: objects[i][metadata.label]
                });
            }

            this._inputField.autocomplete('option', 'source', autocompleteChoices);
        },
        showObject: function(value) {
            //debug('showObject', value);
            var self = this;
            this._objectsContainer.find('[value="' + value + '"]').each(function () {
                $(this).prop('disabled', false)
                if(self._isSelector($(this))) {
                    $(this).prop('checked', 'checked');
                }
                $(this).parents('li').fadeIn();
                self._inputField.val('');
            });
        },
        hideObject: function(value) {
            //debug('hideObject', value);
            var self = this;
            this._objectsContainer.find('[value="' + value + '"]').each(function () {
                $(this).prop('disabled', 'disabled');
                if(self._isSelector($(this))) {
                    $(this).prop('checked', false);
                }
                $(this).parents('li').hide();
            });
        },
        _isSelector: function (node, checked) {
            var selector = this._metadata.selector;

            if(this._selectorRegExp === undefined && typeof selector == 'string' && selector) {
                this._selectorRegExp = new RegExp('\\[' + selector + '\\]');
            }

            if(this._selectorRegExp !== undefined)  {
                return this._selectorRegExp.test(node.attr('name'));
            }

            return false;
        }
    });
}( jQuery ));
/*
 * Fieldset
 *
 * Copyright &copy; 2011 Nethesis S.r.l.
 */
(function( $ ) {
    var SUPER = $.nethgui.Component;
    $.widget('nethgui.Fieldset', SUPER, {                    
        _showDisabledState: false,
        _create: function() {
            SUPER.prototype._create.apply(this);

            var self = this;

            if( ! this.element.hasClass('expandable')) {
                this._expandable = false;
                return;
            }

            this._expandable = true;           
            this.element.children().not('legend').wrap('<div></div>');
            this._content = this.element.children().not('legend');
            
            this.element.find('legend .TextLabel')
            .addClass('clickable')
            .bind('click', function(e) {
                self._setOption('collapsed', ! self.element.hasClass('collapsed'))
            });

            this._content.hide();
            this.element.addClass('collapsed');
            this.element.find('legend .ui-icon').attr('class', 'ui-icon ui-icon-triangle-1-e');
        },
        _setOption: function (key, value) {
            SUPER.prototype._setOption.apply( this, [key, value] );
            if(key === 'collapsed') {
                if( ! this._expandable) {
                    return this;
                }
                
                var o = value ? {
                    fx: 'slideUp',
                    icon: 'e'
                } : {
                    fx: 'slideDown',
                    icon: 's'
                };

                this.element.trigger('nethguiresizestart', {
                    height: this.element.height(),
                    width: this.element.width()
                });
                                
                this._content[o.fx]($.proxy(this._onResizeEnd, this));
                this.element.find('legend .ui-icon').attr('class', 'ui-icon ui-icon-triangle-1-' + o.icon);
            }
            return this;
        },

        _onResizeEnd: function () {
            this.element.toggleClass('collapsed')
            this.element.trigger('nethguiresizeend', {
                height: this.element.height(),
                width: this.element.width()
            });
        }
    });

}( jQuery ));
/*
 * Progress bar
 *
 * Copyright &copy; 2011 Nethesis S.r.l.
 */
(function( $ ) {
    var SUPER = $.nethgui.Component;
    $.widget('nethgui.Progressbar', SUPER, {
        _deep: true,
        _create: function() {
            SUPER.prototype._create.apply(this);
            this._text = this.element.children('span');
            this.element.progressbar();
        },
        _updateView: function(value) {
            var percent = parseInt(value);
            if(percent > 100) {
                percent = 100;
            } else if(percent < 0) {
                percent = 0;
            }
            this.element.progressbar('value', percent);
        }
    });
}( jQuery ));

jQuery(document).ready(function($) {

    var tid;  // the timeout id
    var xhr;  // the last ajax request

    var updateDialog = function(value) {
        $('body > .ui-widget-overlay').css('cursor', value.action == 'open' ? 'progress' : 'auto');

        if(value.action) {
            $(this).dialog(value.action);
        }

        if(value.title) {
            $(this).dialog('option', 'title', value.title);
        }
    };

    var updateLocation = function(value) {
        if( ! value.url) {
            return;
        }
        var sendQuery = function() {
            xhr = $.Nethgui.Server.ajaxMessage({
                url: value.url,
                freezeElement: value.freeze ? $('#Tracker') : false
            });
            if( value.show ) {
                xhr.done(function () {
                    $('#' + value.show).trigger('nethguishow');
                });
            }
        };
        if(value.sleep > 0) {
            tid = window.setTimeout(sendQuery, value.sleep);
        } else {
            tid = false; sendQuery();
        }
    };

    $('#Tracker').dialog({
        autoOpen: false,
        closeOnEscape: false,
        modal: true,
        dialogClass: 'trackerDialog',
        buttons: {
            "Fermer": function () {
                $(this).dialog('close');
                if(tid) {
                    window.clearTimeout(tid);
                }
                tid = false;
                if(xhr) {
                    try {
                        xhr.abort();
                    } catch (e) {
                        //pass
                    }
                }
                xhr = false;
            }
        }
    }).on('nethguiupdateview', function (e, value, selector) {
        if( ! $.isPlainObject(value)) {
            $(this).dialog('close');
            return;
        }
        if($.isPlainObject(value.dialog)) {
            updateDialog.call(this, value.dialog);
        }
        if($.isPlainObject(value.location)) {
            updateLocation.call(this, value.location);
        }
    }).Component();
});/*
 * Navigation menu
 *
 * Copyright &copy; 2011 Nethesis S.r.l.
 */
(function($) {
    var SUPER = $.nethgui.Action;
    $.widget('nethgui.Navigation', SUPER, {
        _create: function() {
            SUPER.prototype._create.call(this);
            this.element.find('.Button.search')
                    .button({
                        icons: {
                            primary: 'ui-icon-search'
                        },
                        text: false
                    })
                    .removeClass('ui-corner-all');

            this._pending = null;
            this._timer = false;
            this._input = this.element.find('.TextInput')
                    .removeClass('ui-corner-all')
                    .bind("keyup paste", $.proxy(this._submitCheck, this));

            this._form.bind('submit', $.proxy(this._clearTimer, this));
        },
        _clearTimer: function() {
            if (this._timer !== false) {
                window.clearTimeout(this._timer);
                this._timer = false;
            }
        },
        _submitCheck: function(event) {
            var self = this;

            this._clearTimer();

            if (event.keyCode === $.ui.keyCode.ENTER) {
                return true;
            } else if (event.keyCode === $.ui.keyCode.ESCAPE) {
                self._input.val('');
                self._updateView('');
                return true;
            } else if ( ! String.fromCharCode(event.keyCode).match(/[a-z0-9]/i)) {
                return true;
            }

            if (self._input.val().length > 1) {
                this._timer = window.setTimeout(function() {
                    self._form.submit();
                }, 600);
            } else if (self._input.val().length === 0) {
                this._timer = window.setTimeout(function() {
                    self._updateView('');
                }, 300);
            }

        },
        _onSubmit: function(e, restart) {
            e.preventDefault();
            e.stopPropagation();
            var form = e.target.tagName.toLowerCase() === 'form' ? $(e.target) : $(e.target).closest('form');

            if (this._pending === null || this._pending.state() === "rejected" || this._pending.state() === "resolved") {
                // start a new request
                this._pending = this._server.ajaxMessage({
                    isMutation: form.attr('method').toUpperCase() === 'POST',
                    url: form.attr('action'),
                    data: form.serialize(),
                    freezeElement: false
                });
            } else if (this._pending.state() === "pending") {
                // cancel pending request
                this._pending.abort();
                // when cancel completes restart this event handler
                this._pending.fail($.proxy(this._onSubmit, this, e, true));
            }

            return false;
        },
        _updateView: function(value) {
            // if the response is empty show all items:
            if (!$.isArray(value) || value.length === 0) {
                this.element.find('.category, li').show();
                return;
            }

            // hide any item that is not member of the `value` array:
            this.element.find('.category, li').each(function(index, element) {
                var href = $(element).children('a:first').attr('href');
                if ($.inArray(href, value) >= 0) {
                    $(element).show();
                } else {
                    $(element).hide();
                }
            });
        }
    });
}(jQuery));
/*
 * Notification
 *
 * Copyright &copy; 2011 Nethesis S.r.l.
 */
(function( $ ) {
    var SUPER = $.nethgui.Component;
    $.widget('nethgui.Notification', SUPER, {
        _deep: false,
        _create: function() {
            var self = this;
            SUPER.prototype._create.apply(this);
            if( ! this.element.children().get(0)) {
                $('<ul />', {'class': 'fa-ul'}).appendTo(this.element);
            }
            $(document).on('ajaxStart.' + this.namespace, function () {
               $(self.element).find('li.notification').fadeOut(function () { $(this).remove() });
            });
         },
        _updateView: function(value, selector) {
            var self = this;
            if( ! $.isArray(value) || value.length === 0) {
                return;
            }

            var N = $.nethgui.Notification;
            var ul = $(this.element.children().get(0)).empty();
            $.each(value, function(index, n) {
                var t = N.templates[n.t] ? N.templates[n.t][0] : N.templates['__default__'][0];
                var c = N.templates[n.t] ? N.templates[n.t][1] : N.templates['__default__'][1];
                $('<li />', {'class': 'notification ' + c}).appendTo(ul)
                        .append(Mustache.render(t, n.a))
                        .Component()
                ;
                if(N.callbacks[n.t]) {
                     N.callbacks[n.t].call(self, n)
                }
            });
            ul.appendTo(this.element).slideDown();
        },
    });

    $(document).ready(function() {
        $('#Notification').Notification();
    });

    $.nethgui.Notification.templates = {};
    $.nethgui.Notification.callbacks = {
        validationError: function (n) {
            /* FIXME delay tooltip creation until all widgets are rendered */
            window.setTimeout(function () {
                $.each(n.data.fields, function (index, field) {

                    var targets = $('.' + field.name).toArray();
                    var extras = $('#' + field.parameter).toArray();

                    if ($.inArray(extras[0], targets) === -1) {
                        targets.push(extras[0]);
                    }

                    $(targets).trigger('nethguitooltip', [{
                            text: field.reason,
                            style: 2,
                            show: true,
                            sticky: true
                        }])
                });
            }, 20);
        }
    };

}( jQuery ));

(function( $ ) {
    $.nethgui.Notification.colors = null;
    $.nethgui.Notification.templates["trackerError"] = ["<i class=\"fa fa-li fa-exclamation-circle\"><\/i> <span>T\u00e2ches compl\u00e9t\u00e9es avec erreurs<\/span> <dl>{{#.}}<dt>{{title}} #{{id}} (exit status {{code}})<\/dt><dd class=\"wspreline\">{{message}}<\/dd>{{\/.}}<\/dl>","bg-red"];
    $.nethgui.Notification.templates["trackerRunning"] = ["<i class=\"fa fa-li fa-exclamation-triangle\"><\/i> <span>Application de la nouvelle configuration<\/span> <a class=\"Button link\" href=\"\/fr-FR\/Tracker\/{{taskId}}\">Voir les t\u00e2ches<\/a>","bg-yellow"];
    $.nethgui.Notification.templates["__default__"] = ["<i class=\"fa fa-li fa-info-circle\"><\/i>{{.}}","bg-green pre-fa"];
    $.nethgui.Notification.templates["warning"] = ["<i class=\"fa fa-li fa-exclamation-triangle\"><\/i>{{.}}","bg-yellow pre-fa"];
    $.nethgui.Notification.templates["error"] = ["<i class=\"fa fa-li fa-exclamation-circle\"><\/i>{{.}}","bg-red pre-fa"];
    $.nethgui.Notification.templates["validationError"] = ["<i class=\"fa fa-li fa-exclamation-triangle\"><\/i>\n<dl class=\"fields\">\n {{#.}}<dt><a href=\"#{{parameter}}\">{{label}}<\/a><\/dt>\n <dd>{{reason}}<\/dd>{{\/.}}\n<\/dl>\n","validationError bg-red pre-fa"];
}( jQuery ));
/*
 * Loading dialog
 *
 * Copyright &copy; 2011 Nethesis S.r.l.
 */
(function( $ ) {
    /*
     * Refs #355. Freeze UI while loading.
     *
     * Adds an overlaying modal dialog. The external CSS class
     * "overlay-loading-message" ensures the dialog is actually
     * not displayed, while keeping the original jQuery UI
     * overlaing div.
     */

    var dialog = $('<div id="NethguiOverlayLoadingMessage" style="display: none"/>');

    $('body').append(dialog);
    dialog.dialog({
        autoOpen: false,
        modal: true,
        closeOnEscape: false,
        dialogClass: "NethguiLoading"
    });

    $(document).bind("nethguifreezeui.nethgui", function() {
        // Todo: open dialog after a small timeout, to avoid flashes on cached responses.
        if(! dialog.dialog('isOpen')) {
            dialog.dialog('open');
            $('body').css('cursor', 'progress');
        }
    }).bind("ajaxStop.nethgui", function() {
        if(dialog.dialog('isOpen')) {
            $('body').css('cursor', 'auto');
            dialog.dialog('close');
        }
    });
    
}( jQuery ));
/*
 * Help area
 *
 * Copyright &copy; 2011 Nethesis S.r.l.
 */
(function( $ ) {
    var SUPER = $.nethgui.Component;
    $.widget('nethgui.HelpArea', SUPER, {
        _create: function() {
            var self = this;
            SUPER.prototype._create.apply(this);
            this._tooltipControls = [];
            this._proxyHelpHandler = function(e, url) {
                self.open(url);
            };
            this.element.hide();
            this.element.bind('nethguicancel.' + this.namespace, $.proxy(this.close, this));
            $(document).bind('nethguihelp.' + this.namespace, this._proxyHelpHandler);
            $(window).bind('resize.' + this.widgetName, $.proxy(this._fixBoxHeight, this));
            this._helpDoc = $('<div class="HelpDocument"></div>');
            this.element.children('.wrap').append(this._helpDoc);

            this.element.bind('ajaxStart.' + this.widgetName, $.proxy(this.close, this));
        },
        destroy: function() {
            SUPER.prototype.destroy.call( this );
            $(document).unbind(this._proxyHelpHandler);
            $(window).unbind(this.widgetName);
        },
        close: function(e) {
            this.element.hide();
            if(e) {
                e.stopPropagation();
            }
        },
        _onHelpDocumentResponse: function(responseData) {
            var responseDocument = $($.parseXML(responseData));
            var helpNode = responseDocument.find('body > div:first-child').detach();
            this._helpDoc.empty().append(helpNode.children());            
            this.element.show();
            this._fixBoxHeight();
        },
        /**
         * Calculate window height and set help wievport
         */
        _fixBoxHeight: function() {            
            var w = window,
            d = document,
            e = d.documentElement,
            g = d.getElementsByTagName('body')[0],
            //x = w.innerWidth||e.clientWidth||g.clientWidth,
            y = w.innerHeight || e.clientHeight || g.clientHeight;
            this._helpDoc.css('height', y - 58);
        },
        /**
         * Load help contents and display the help area.
         */
        open: function (url) {
            var self = this;
            this.element.trigger('nethguifreezeui');

            $.ajax({
                type: 'GET',
                url: url,
                cache: true,
                success: $.proxy(this._onHelpDocumentResponse, this),
                error: function(jqXHR, textStatus, errorThrown) {
                    if(jqXHR.status == 404) {                        
                        self._helpDoc.empty().append('<h1>Not found</h1><p>Help document is not available!</p>');
                    } else {
                        self._helpDoc.empty().append($('<h1 />').text(errorThrown));
                    }
                    self.element.show();
                    self._fixBoxHeight();
                }
            });            
        }
    });
    
}( jQuery ));
/*
 * bootstrapJs in NethServer.php
 */
jQuery(document).ready(function($) {
    $('script.unobstrusive').remove();
    $('#pageContent').Component();    
    $('.HelpArea').HelpArea();
    $('#hiddenAllWrapperCss').remove();

    // push initial ui state
    var target = window.location.href.split(/\#!?/, 2)[1];
    if(target) {
        $('#' + target).trigger('nethguishow');
        history.replaceState({'target': target}, '', '#!' + target);
    }
});