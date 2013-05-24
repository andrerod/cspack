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

var async = require('async');
var zip = require('node-zip');
var path = require('path');
var isBinaryFile = require('isbinaryfile');

var utils = require('./util/utils');
var constants = require('./util/constants');

function getOpcFilename(file) {
  return file.replace(/\\/g, '/');
}

/*
* Generates the OPC specific files ([Content_types].xml and res/.rels) and the final cspkg file.
*
* As described in: // http://msdn.microsoft.com/en-us/library/windowsazure/jj151531.aspx.
*/
exports.createOpcPackage = function (pkg, callback) {
  var zipPackage = zip();

  var contentTypes = [];

  function addContentType(name, contentType) {
    contentTypes.push({
      PartName: name,
      ContentType: contentType
    });
  }

  pkg.dataStore.getContents(function (err, files) {
    function addFile(file, callback) {
      pkg.dataStore.getContent(file, function (err, content) {
        if (err) { return callback(err); }

        pkg.dataStore.getContentStat(file, function (err, stat) {
          if (err) { return callback(err); }

          if (!stat.isDirectory()) {
            if (utils.stringStartsWith(file, constants.PackagePaths.LocalContent)) {
              addContentType('/' + getOpcFilename(file), 'application/octet-stream');
            }

            var isBinary = isBinaryFile(content, stat);
            if (isBinary) {
              zipPackage.file(getOpcFilename(file), content.toString('binary'), { binary: true });
            } else {
              zipPackage.file(getOpcFilename(file), content.toString('base64'), { base64: true });
            }
          } else {
            zipPackage.folder(getOpcFilename(file));
          }
        });
      });
    }

    async.each(files, addFile, function (err) {
      if (err) { return callback(err); }

      // Add content types file
      var contentTypesContent = utils.processTemplate('[Content_Types].xml.handlebars', contentTypes, true);
      pkg.dataStore.addContentFromString('[Content_Types].xml', contentTypesContent);
      zipPackage.file(getOpcFilename('[Content_Types].xml'), contentTypesContent);

      // Add .rels file
      var relsContent = utils.processTemplate('_rels/.rels.handlebars', {}, true);
      pkg.dataStore.addContentFromString(path.join('_rels', '.rels'), contentTypesContent);
      zipPackage.file(getOpcFilename(path.join('_rels', '.rels')), relsContent);

      // Create .cspkg
      var data = zipPackage.generate({ base64: false, compression: 'STORE' });

      callback(err, data);
    });
  });
};