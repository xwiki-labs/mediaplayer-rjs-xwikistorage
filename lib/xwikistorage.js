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

    function getXWikiReferenceFromId(id) {
        var space = id.substring(0, id.indexOf('.'));
        var page = id.substring(id.indexOf('.') + 1);

        return {space: space, page: page};
    }

    /**
     * Document metadata is stored as a JSON serialization in the body.
     */
    function getDocumentMetadata(xwikiUrl, id) {
        var xwikiReference = getXWikiReferenceFromId(id);

        function resolver(done, fail) {
            $.ajax({
                url: xwikiUrl + '/xwiki/rest/wikis/xwiki/spaces/' + xwikiReference.space + '/pages/' + xwikiReference.page,
                success: function (data, status, jqXHR) {
                    $(data).find('content').each(function (value) {
                        var metadata = {};
                        try {
                            metadata = JSON.parse($(this).text());
                        }
                        catch (e) {
                            console.log('Warning: document ' + id + ' doesn\'t contain valid JSON');
                        }

                        metadata._id = id;

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
     * Get attachment associated to a document.
     *
     * @param xwikiUrl
     * @param id
     * @param attachmentName
     * @returns {Promise}
     */
    function getDocumentAttachment(xwikiUrl, id, attachmentName) {
        var xwikiReference = getXWikiReferenceFromId(id);

        function resolver(done, fail) {
            var xhr = new XMLHttpRequest();

            var url = xwikiUrl + '/xwiki/rest/wikis/xwiki/spaces/' + xwikiReference.space + '/pages/' + xwikiReference.page + '/attachments/' + attachmentName;
            xhr.open('GET', url, true);
            xhr.onerror = function (e) {
                fail(e);
            }
            xhr.onload = function () {
                done({data: this.response});
            }
            xhr.responseType = 'blob';
            xhr.send();
        }

        return new RSVP.Promise(resolver);
    }

    /**
     * Store metadata in a document.
     *
     * @param xwikiUrl the XWiki URL for the REST API
     * @param id document id
     * @param metadata
     * @param jioPost true if the function is a jioPost which must generate a 'created' response on success.
     * @returns {Promise}
     */
    function storeDocumentMetadata(xwikiUrl, id, metadata, jioPost) {
        var xwikiReference = getXWikiReferenceFromId(id);

        function resolver(done, fail) {
            $.ajax({
                url: xwikiUrl + '/xwiki/rest/wikis/xwiki/spaces/' + xwikiReference.space + '/pages/' + xwikiReference.page,
                type: 'PUT',
                contentType: 'text/plain',
                data: JSON.stringify(metadata),
                success: function (data, status, jqXHR) {
                    if (jioPost) {
                        done({id: id})
                    }
                    else {
                        done({status: 204});
                    }
                },
                error: function (jqXHR, status, error) {
                    fail(error);
                }
            })
        };

        return new RSVP.Promise(resolver);
    }

    /**
     * Store an attachment to an XWiki page.
     *
     * @param xwikiUrl the XWiki URL for the REST API
     * @param id
     * @param attachmentName
     * @param attachmentDataBlob
     * @returns {Promise}
     */
    function storeAttachment(xwikiUrl, id, attachmentName, attachmentDataBlob) {
        var xwikiReference = getXWikiReferenceFromId(id);

        function resolver(done, fail) {
            var xhr = new XMLHttpRequest();

            var url = xwikiUrl + '/xwiki/rest/wikis/xwiki/spaces/' + xwikiReference.space + '/pages/' + xwikiReference.page + '/attachments/' + attachmentName;
            xhr.open('PUT', url, true);
            xhr.onerror = function (e) {
                fail(e);
            }
            xhr.onload = function () {
                done({status: 204});
            }
            xhr.send(attachmentDataBlob);
        }

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
                            id: $(this).text(),
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
                promises.push(getDocumentMetadata(xwikiUrl, result.data.rows[i].id));
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

    /**
     * Remove a document
     *
     * @param xwikiUrl the XWiki URL for the REST API
     * @param id
     * @returns {Promise}
     */
    function removeDocument(xwikiUrl, id) {
        var xwikiReference = getXWikiReferenceFromId(id);

        function resolver(done, fail) {
            $.ajax({
                url: xwikiUrl + '/xwiki/rest/wikis/xwiki/spaces/' + xwikiReference.space + '/pages/' + xwikiReference.page,
                type: 'DELETE',
                success: function (data, status, jqXHR) {
                    done({status: 204});
                },
                error: function (jqXHR, status, error) {
                    fail(error);
                }
            })
        }

        return new RSVP.Promise(resolver);
    }



    /*********************************************************
     *  JIO method definitions
     *********************************************************/
    XWikiStorage.prototype.allDocs = function (command, params, options) {
        if (options.include_docs) {
            getAllDocsWithContent(this.xwikiUrl, params.space).then(command.success, command.error);
        } else {
            getAllDocs(this.xwikiUrl, params.space).then(command.success, command.error);
        }
    };

    /*********************************************************/
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

    /*********************************************************/
    XWikiStorage.prototype.getAttachment = function (command, params, options) {
        getDocumentAttachment(this.xwikiUrl, params['_id'], params['_attachment']).then(command.success, command.error);
    };

    /*********************************************************/
    XWikiStorage.prototype.post = function (command, params, options) {
        var space = options.space || DEFAULT_SPACE;
        var id = space + '.' + jIO.util.generateUuid();

        storeDocumentMetadata(this.xwikiUrl, id, params, true).then(command.success, command.error);
    };

    /*********************************************************/
    XWikiStorage.prototype.put = function (command, params, options) {
        var id = params['_id'];

        if (id) {
            var metadata = jIO.util.deepClone(params);
            metadata.delete('_id');

            storeDocumentMetadata(this.xwikiUrl, id, metadata, false).then(command.success, command.error);
        }
        else {
            command.error('Document ID not specified');
        }
    };

    /*********************************************************/
    XWikiStorage.prototype.putAttachment = function (command, params, options) {
        storeAttachment(this.xwikiUrl, params['_id'], params['_attachment'], params['_blob']).then(command.success, command.error);
    };

    /*********************************************************/
    XWikiStorage.prototype.remove = function (command, params, options) {
        removeDocument(this.xwikiUrl, params['_id']).then(command.success, command.error);
    };

    /*********************************************************/
    XWikiStorage.prototype.removeAttachment = function (command, params, options) {
        command.error('REMOVE ATTACHMENT not implemented');
    };

    /*********************************************************/
    XWikiStorage.prototype.check = function (command, params, options) {
        command.error('CHECK not implemented');
    };

    /*********************************************************/
    XWikiStorage.prototype.repair = function (command, params, options) {
        command.error('REPAIR not implemented');
    };

    jIO.addStorage('xwiki', XWikiStorage);
}));
