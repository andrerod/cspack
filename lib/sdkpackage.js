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
var https = require('https');

var _ = require('underscore');

var ZipDataStore = require('./store/zipdatastore');

var utils = require('./util/utils');
var constants = require('./util/constants');

/**
* Creates a new SDK Package object.
*
* Responsible for providing the files that belong to the SDK and make part of an azure package contents.
*
* @constructor
*
* @param {object} options           The package options.
* @param {string} options.cachePath A folder path where SDK files can be cached for perfomance reasons.
*/
function SDKPackage(options) {
  utils.validateArgs('SDKPackage', function (v) {
    v.object(options, 'options');
  });

  this.cachePath = options.cachePath;
}

_.extend(SDKPackage.prototype, {
  /**
  * Retrieves the list of files from the sdk
  * @param {function(err, files)} The callback function.
  */
  getFiles: function (callback) {
    var self = this;

    if (!self.manifest) {
      self._ensureLatest(function (err, manifest) {
        if (err) { return callback(err); }

        self.manifest = manifest;
        callback(null, self.manifest.files);
      });
    } else {
      callback(null, self.manifest.files);
    }
  },

  /*
  * Retrieves the data from a file from the SDK.
  *
  * @param {string} file The file name.
  * @param {function(err, data)} The callback function.
  */
  getFile: function (file, callback) {
    var self = this;

    if (!self.dataStore) {
      self._ensureLatest(function (err, manifest) {
        if (err) { return callback(err); }

        self.manifest = manifest;
        self.dataStore = new ZipDataStore({ archiveFile: path.join(self.cachePath, 'sdk.zip') });

        self.dataStore.getContent(file, callback);
      });
    } else {
      self.dataStore.getContent(file, callback);
    }
  },

  /*
  * Retrieves the SDK version.
  *
  * @param {function(err, version)} The callback function.
  */
  getVersion: function (callback) {
    var self = this;
    self.getFiles(function (err) {
      if (err) { return callback(err); }
      callback(null, self.manifest.sdkVersion);
    });
  },

  _ensureLatest: function (callback) {
    var self = this;

    function writeManifestAndUpdateSDK(parsedManifest, cachedManifestPath, manifest) {
      utils.mkdirRecursive(path.dirname(cachedManifestPath), function (err) {
        if (err) { return callback(err); }

        fs.writeFile(cachedManifestPath, manifest, function (err) {
          if (err) { return callback(err); }

          self._downloadSDKFiles(function (err) {
            if (err) { return callback(err); }

            callback(null, parsedManifest);
          });
        });
      });
    }

    self._downloadManifestFile(function (err, manifest) {
      if (err) { return callback(err); }

      var parsedManifest = JSON.parse(manifest.toString());
      var cachedManifestPath = path.join(self.cachePath, 'manifest.json');

      fs.exists(cachedManifestPath, function (exists) {
        if (exists) {
          fs.readFile(cachedManifestPath, function (err, cachedManifest) {
            if (err) { return callback(err); }

            var parsedCachedManifest = JSON.parse(cachedManifest.toString());
            if (parsedCachedManifest.sdkVersion !== parsedManifest.sdkVersion) {
              writeManifestAndUpdateSDK(parsedManifest, cachedManifestPath, manifest);
            } else {
              callback(null, parsedManifest);
            }
          });
        } else {
          writeManifestAndUpdateSDK(parsedManifest, cachedManifestPath, manifest);
        }
      });
    });
  },

  _downloadManifestFile: function (callback) {
    https.get(constants.DefaultSDKLocation.manifest, function(response) {
      response.setEncoding('utf8');

      var manifest = '';

      response.on('error', callback);
      response.on('data', function (chunk) {
        manifest += chunk;
      });

      response.on('end', function () {
        callback(null, manifest);
      });
    }).on('error', callback);
  },

  _downloadSDKFiles: function (callback) {
    var self = this;

    var cbCalled = false;

    function done(err) {
      if (!cbCalled) {
        callback(err);
        cbCalled = true;
      }
    }

    var cachedSDKPath = path.join(self.cachePath, 'sdk.zip');

    var writeStream = fs.createWriteStream(cachedSDKPath);
    writeStream.on('close', done);
    writeStream.on('error', done);

    https.get(constants.DefaultSDKLocation.bits, function (rsp) {
      rsp.on('end', done);

      rsp.pipe(writeStream);
    }).on('error', done);
  }
});

module.exports = SDKPackage;