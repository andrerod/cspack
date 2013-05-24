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

var fs = require('fs');
var path = require('path');
var https = require('https');

var _ = require('underscore');
var async = require('async');

var utils = require('./util/utils');
var constants = require('./util/constants');

var TEMPORARY_PACKAGE_PATH = 'package';

function SDKPackage(options) {
  utils.validateArgs('SDKPackage', function (v) {
    v.object(options, 'options');
  });

  this.cachePath = options.cachePath;
}

_.extend(SDKPackage.prototype, {
  getFiles: function (callback) {
    var self = this;

    self._ensureLatest();

    callback();
  },

  _ensureLatest: function (callback) {
    https.get(constants.DefaultSDKLocation.manifest, function(response) {
      var manifest = '';

      response.on('error', callback);
      response.on('data', function (chunk) {
        manifest += chunk;
      });
      response.on('end', function () {
        // var currentManifest = JSON.parse(manifest);

        // TODO: implement
        callback();
        //var cachedManifest = fs.readFile()
      });
    });

  },

  _fetchBasePackage: function (callback) {
    var self = this;

    utils.mkdirRecursive(path.join(self.outputRoot, TEMPORARY_PACKAGE_PATH), function () {
      // TODO: implement some sort of caching here
      self.sdkManifestOutputFilePath = path.join(self.outputRoot, TEMPORARY_PACKAGE_PATH, 'sdk.json');
      var manifestStream = fs.createWriteStream(self.sdkManifestOutputFilePath);

      self.sdkOutputFilePath = path.join(self.outputRoot, TEMPORARY_PACKAGE_PATH, 'sdk.zip');
      var sdkStream = fs.createWriteStream(self.sdkOutputFilePath);

      async.parallel([
        function (callback) {
          https.get(constants.DefaultSDKLocation.bits, function(response) {
            response.pipe(sdkStream);
            response.on('end', callback);
          });
        },
        function (callback) {
          https.get(constants.DefaultSDKLocation.manifest, function(response) {
            response.pipe(manifestStream);
            callback();
          });
        }
      ], function (err) {
        if (err) { return callback(err); }

/*
        // Unzip the SDK
        var zipPkg = zip(fs.readFileSync(sdkOutputFilePath).toString('base64'), { base64: true });
        console.log(zipPkg.files['storage/'].options);
*/

        callback();
      });
    });
  }
});