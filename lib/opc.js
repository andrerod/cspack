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

var ContentTypes = require('./models/opc/contentTypes');
var rels = require('./models/opc/rels');

/*
* Generates the OPC specific files ([Content_types].xml and res/.rels) and the final cspkg file.
*
* As described in: // http://msdn.microsoft.com/en-us/library/windowsazure/jj151531.aspx.
*/
exports.createPackageFile = function (outputRoot, tempPackagePath, packageName, callback) {
  utils.getFilesDirectory(tempPackagePath, function (err, files) {
    var contentTypes = new ContentTypes();

    files.forEach(function (file) {
      var fullFilePath = path.join(tempPackagePath, file);

      if (!fs.lstatSync(fullFilePath).isDirectory()) {
        if (file.substr(0, 'LocalContent'.length) === 'LocalContent') {
          contentTypes.addOverride('/' + file, 'application/octet-stream');
        }

        var content = fs.readFileSync(fullFilePath);
        zip.file(file, content.toString('base64'), { base64: true });
      }
    });

    // Add content types file
    zip.file('[Content_Types].xml', utils.addBOM(contentTypes.generate().toString()));

    // Add .rels file
    zip.file('_rels/.rels', utils.addBOM(rels.generate().toString()));

    // Create .cspkg
    var data = zip.generate({ base64: false, compression: 'STORE' });

    var packagePath = path.join(outputRoot, packageName);
    fs.writeFileSync(packagePath, data, 'binary');

    // Remove temporary packaging directory
    wrench.rmdirSyncRecursive(tempPackagePath);

    callback();
  });
};