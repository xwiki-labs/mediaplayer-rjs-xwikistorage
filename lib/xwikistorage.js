(function (dependencies, module) {
    "use strict";
    if (typeof define === 'function' && define.amd) {
        return define(dependencies, module);
    }
    if (typeof exports === 'object') {
        return module(require('rsvp'), require('jio'), require('jquery'));
    }

    module(RSVP, jIO, jQuery);
}(['jio', 'rsvp', 'jquery'], function (RSVP, jIO, $) {
    "use strict";

    var DEFAULT_SPACE = 'JIO';

    function XWikiStorage(params) {
        params = params || {};

        this.xwikiUrl = params.xwikiUrl;
    }

    /**
     * Document metadata is stored as a JSON serialization in the body.
     */
    function getDocumentMetadata(xwikiUrl, id) {
        var space = id.substring(0, id.indexOf('.'));
        var page = id.substring(id.indexOf('.') + 1);

        function resolver(done, fail) {
            $.ajax({
                url: xwikiUrl + '/xwiki/rest/wikis/xwiki/spaces/' + space + '/pages/' + page,
                success: function (data, status, jqXHR) {
                    $(data).find('content').each(function (value) {
                        var metadata = {};
                        try {
                            metadata = JSON.parse($(this).text());
                        }
                        catch (e) {
                            console.log('Warning: document ' + id + ' doesn\'t contain valid JSON');
                        }

                        done(metadata);
                    });
                },
                error: function (jqXHR, status, error) {
                    fail(error);
                }
            })
        };

        return new RSVP.Promise(resolver);
    }

    /**
     * Returns a list of rows containing document IDs without any metadata fetched.
     *
     * @param xwikiUrl the XWiki URL for the REST API
     * @param space the space where to get the documents from
     * @returns {Promise} a promise containing the actual fetching logic.
     */
    function getAllDocs(xwikiUrl, space) {
        space = space || DEFAULT_SPACE;

        function resolver(done, fail) {
            $.ajax({
                url: xwikiUrl + '/xwiki/rest/wikis/xwiki/spaces/' + space + '/pages',
                success: function (data, status, jqXHR) {
                    var rows = [];
                    $(data).find('fullName').each(function (value) {
                        rows.push({
                            _id: $(this).text(),
                            value: {}
                        });
                    });

                    /* Build the result */
                    var result = {
                        data: {
                            rows: rows,
                            total_rows: rows.length
                        }
                    };

                    done(result);
                },
                error: function (jqXHR, status, error) {
                    fail(error);
                }
            });
        }

        return new RSVP.Promise(resolver);
    }

    /**
     * Returns a list of rows containing document IDs, and fetches also the metadata associated.
     *
     * @param xwikiUrl the XWiki URL for the REST API
     * @param space the space where to get the documents from
     * @returns {Promise} a promise containing the actual fetching logic.
     */
    function getAllDocsWithContent(xwikiUrl, space) {
        return getAllDocs(xwikiUrl, space).then(function (result) {
            var promises = [];

            /* Create an array with the result of the call to allDocs + all the promises for
             retrieving the contents of these docs.
             */
            promises.push(result);
            for (var i = 0; i < result.data.rows.length; i++) {
                promises.push(getDocumentMetadata(xwikiUrl, result.data.rows[i]._id));
            }

            return RSVP.all(promises);
        }).then(function (result) {
            var allDocs = result[0]; //The first element is the result of the call to allDocs in the previous 'then'
            var documents = result.splice(1); //The remaining elements are the actual documents.

            for (var i = 0; i < documents.length; i++) {
                allDocs.data.rows[i].doc = documents[i];
            }

            return allDocs;
        });
    }

    /* JIO method definitions */
    XWikiStorage.prototype.allDocs = function (command, params, options) {
        if (options.include_docs) {
            getAllDocsWithContent(this.xwikiUrl).then(command.success, command.error);
        } else {
            getAllDocs(this.xwikiUrl).then(command.success, command.error);
        }
    };

    XWikiStorage.prototype.get = function (command, params, options) {
        if (params['_id']) {
            getDocumentMetadata(this.xwikiUrl, params['_id']).then(function (metadata) {
                var result = {
                    data: metadata
                };

                command.success(result);
            }).fail(function (e) {
                command.error(e);
            });
        } else {
            command.error('Document ID not specified');
        }
    };

    XWikiStorage.prototype.getAttachment = function (command, params, options) {
        throw 'GET ATTACHMENT not implemented';
    };

    XWikiStorage.prototype.post = function (command, params, options) {
        throw 'POST not implemented';
    };

    XWikiStorage.prototype.put = function (command, params, options) {
        throw 'PUT not implemented';
    };

    XWikiStorage.prototype.putAttachment = function (command, params, options) {
        throw 'PUT ATTACHMENT not implemented';
    };

    XWikiStorage.prototype.remove = function (command, params, options) {
        throw 'REMOVE not implemented';
    };

    XWikiStorage.prototype.removeAttachment = function (command, params, options) {
        throw 'REMOVE ATTACHMENT not implemented';
    };

    XWikiStorage.prototype.check = function (command, params, options) {
        throw 'CHECK not implemented';
    };

    XWikiStorage.prototype.repair = function (command, params, options) {
        throw 'REPAIR not implemented';
    };

    jIO.addStorage('xwiki', XWikiStorage);
}));
