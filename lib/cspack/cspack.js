#!/usr/bin/env node
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

var path = require('path');
var nodeZip = require('node-zip');

var wrench = require('wrench').ncp;
var serviceDefinition = require('./models/serviceDefinition');

exports = module.exports;

exports.generate = function (options, callback) {
  cloneTemplateDirectory(options.outputDirectory, function (err) {
    if (err) {
      callback(err);
    }

    serviceDefinition.parse(options.serviceDefinitionFile, function (err, serviceDefinition) {

      // Create app root
      createAppRoot(options.outputDirectory, function () {
        // Zip result

        callback();
      });
    });
  });
};

function createAppRoot(outputDirectory, callback) {
  var sourceDirectory = path.join(__dirname, '/../basePackage/');
  var targetDirectory = path.join(outputDirectory, '/package/approot/');

  // Copy excluding the target directory
  wrench.copyDirSyncRecursive(sourceDirectory, targetDirectory, { filter: /^(?!\/package)$/ });
  callback();
};

function cloneTemplateDirectory(outputDirectory, callback) {
  var sourceDirectory = path.join(__dirname, '/../basePackage/');
  var targetDirectory = path.join(outputDirectory, '/package/');

  wrench.copyDirSyncRecursive(sourceDirectory, targetDirectory);
  callback();
}