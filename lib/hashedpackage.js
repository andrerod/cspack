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

var util = require('util');

var _ = require('underscore');

var utils = require('./util/utils');
var constants = require('./util/constants');

var Package = require('./package');

/**
* Creates a new Package able to reuse content definitions through checking hashsums.
*
* http://msdn.microsoft.com/en-us/library/windowsazure/jj151528.aspx
*
* @constructor
*
* @param {object} options                      The package options.
* @param {string} [options.hashingAlgorithm]   The hashing algorithm to use.
*/
function HashedPackage(options) {
  HashedPackage['super_'].call(this, options);

  this.hashingAlgorithm = options.hashingAlgorithm || constants.IntegrityCheckHashAlgortihms.Sha256;
}

util.inherits(HashedPackage, Package);

_.extend(HashedPackage.prototype, {
  /**
  * Adds a content to the package data store.
  *
  * @param {string} store           The store where to add (i.e. LocalContent, NamedStreams, etc).
  * @param {string} [name]          The name of the content definition. If null, a guid will be used instead.
  * @param {object} origin          The full path to the file to add.
  * @param {string} origin.filePath The origin file path.
  * @param {string} origin.content  The origin content.
  * @param {function(err, contentDefinition)} callback The callback function.
  */
  addContentDefinition: function (store, name, origin, callback) {
    var self = this;

    utils.validateArgs('addContentDefinition', function (v) {
      v.string(store, 'store');
      v.object(origin, 'origin');
      v.callback(callback, 'callback');
    });

    utils.calculateFileHashsum(origin, self.hashingAlgorithm, function (err, checksum) {
      if (err) { return callback(err); }

      var contentDefinition;
      if (store === constants.PackagePaths.LocalContent) {
        // Local content can be reused
        contentDefinition = self.getContentDefinitionByHash(checksum);
      }

      if (contentDefinition) {
        return callback(null, contentDefinition);
      } else {
        HashedPackage['super_'].prototype.addContentDefinition.call(self, store, name, origin, function (err, contentDefinition) {
          if (err) { return callback(err); }

          contentDefinition.ContentDescription.IntegrityCheckHashAlgortihm = self.hashingAlgorithm;
          contentDefinition.ContentDescription.IntegrityCheckHash = checksum;

          return callback(null, contentDefinition);
        });
      }
    });
  },

  /**
  * Gets a content definition from the package by checksum.
  *
  * @param {string} hash The hash of the content to get.
  * @return {object} The content definition or null if not found.
  */
  getContentDefinitionByHash: function (checksum) {
    var self = this;

    if (self.pkg.PackageContents && self.pkg.PackageContents.ContentDefinition) {
      return self.pkg.PackageContents.ContentDefinition.filter(function (content) {
        return content.ContentDescription.IntegrityCheckHashAlgortihm === self.hashingAlgorithm &&
          content.ContentDescription.IntegrityCheckHash === checksum;
      })[0] || null;
    }

    return null;
  }
});

module.exports = HashedPackage;