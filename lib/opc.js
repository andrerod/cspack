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
var zip = require('node-zip')();
var utils = require('./util/utils');
var path = require('path');
var wrench = require('wrench');
var isBinaryFile = require('isbinaryfile');
var Handlebars = require('handlebars');

/*
* Generates the OPC specific files ([Content_types].xml and res/.rels) and the final cspkg file.
*
* As described in: // http://msdn.microsoft.com/en-us/library/windowsazure/jj151531.aspx.
*/
exports.createPackageFile = function (outputRoot, tempPackagePath, packageName, callback) {
  function getZipFilename(file) {
    return file.replace(/\\/g, '/');
  }

  utils.getFilesDirectory(tempPackagePath, function (err, files) {
    var contentTypes = [];

    function addContentType(name, contentType) {
      contentTypes.push({
        PartName: name,
        ContentType: contentType
      });
    }

    files.forEach(function (file) {
      var fullFilePath = path.join(tempPackagePath, file);

      if (!fs.lstatSync(fullFilePath).isDirectory()) {
        if (file.substr(0, 'LocalContent'.length) === 'LocalContent') {
          addContentType(('/' + file).replace(/\\/g, '/'), 'application/octet-stream');
        }

        var isBinary = isBinaryFile(fullFilePath);
        var content;
        if (isBinary) {
          content = fs.readFileSync(fullFilePath, 'binary');
          zip.file(getZipFilename(file), content.toString('binary'), { binary: true });
        } else {
          content = fs.readFileSync(fullFilePath, 'base64');
          zip.file(getZipFilename(file), content.toString('base64'), { base64: true });
        }
      } else {
        zip.folder(getZipFilename(file));
      }
    });

    // Add content types file
    var contentTypesContent = utils.addBOM(Handlebars.compile(
      fs.readFileSync(path.join(__dirname, 'templates/[Content_Types].xml.handlebars')).toString()
    )(contentTypes));

    fs.writeFileSync(path.join(tempPackagePath, '[Content_Types].xml'), contentTypesContent);
    zip.file(getZipFilename('[Content_Types].xml'), contentTypesContent);

    // Add .rels file
    utils.mkdir(path.join(tempPackagePath, '_rels'));

    var relsContent = utils.addBOM(Handlebars.compile(
      fs.readFileSync(path.join(__dirname, 'templates/_rels/.rels.handlebars')).toString()
    )());

    fs.writeFileSync(path.join(tempPackagePath, '_rels', '.rels'), relsContent);
    zip.file(getZipFilename(path.join('_rels', '.rels')), relsContent);

    // Create .cspkg
    var data = zip.generate({ base64: false, compression: 'STORE' });

    var packagePath = path.join(outputRoot, packageName);
    fs.writeFileSync(packagePath, data, 'binary');

    // Remove temporary packaging directory
    // wrench.rmdirSyncRecursive(tempPackagePath);

    callback();
  });
};