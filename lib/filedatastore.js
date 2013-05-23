/**
* Copyright (c) Microsoft.  All rights reserved.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

'use strict';

var fs = require('fs');
var path = require('path');

var _ = require('underscore');

var utils = require('./util/utils');

/**
* Creates a new file store object.
*
* @constructor
*
* @param {object} options                      The package options.
* @param {string} options.temporaryPackagePath The temporary package path.
*/
function FileDataStore(options) {
  utils.validateArgs('Package', function (v) {
    v.object(options, 'options');
    v.string(options.temporaryPackagePath, 'options.temporaryPackagePath');
  });

  this.temporaryPackagePath = options.temporaryPackagePath;
}

_.extend(FileDataStore.prototype, {
  /**
  * Retrieves the stats about a file
  *
  * @param {string} dataStorePath The data store path.
  * @param {function(err, stat)} callback The callback function.
  */
  getContentStat: function (dataStorePath, callback) {
    return fs.stat(path.join(this.temporaryPackagePath, dataStorePath), callback);
  },

  getContent: function (dataStorePath, callback) {
    try {
      callback(null, fs.readFileSync(path.join(this.temporaryPackagePath, dataStorePath)).toString());
    } catch (e) {
      callback(e);
    }
  },

  /**
  * Adds content to the data store from a file.
  *
  * @param {string} name The name of the content to add.
  * @param {function(err, stat)} callback The callback function.
  */
  addContentFromFile: function (name, fileFullPath, callback) {
    var self = this;

    if (fileFullPath && fileFullPath !== path.join(self.temporaryPackagePath, name)) {
      return utils.copyFile(
        fileFullPath,
        path.join(self.temporaryPackagePath, name),
        { createBasepath: true },
        callback);
    }

    return callback(null);
  },

  /**
  * Adds content to the data store from a string.
  *
  * @param {string} name The name of the content to add.
  * @param {function(err, stat)} callback The callback function.
  */
  addContentFromString: function (name, content, callback) {
    var self = this;

    fs.writeFile(path.join(self.temporaryPackagePath, name), content, callback);
  }
});

module.exports = FileDataStore;