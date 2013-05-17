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
var wrench = require('wrench');
var path = require('path');

var ContentTypes = require('./models/opc/contentTypes');
var rels = require('./models/opc/rels');

/*
* Generates the OPC specific files ([Content_types].xml and res/.rels) and the final cspkg file.
*
* As described in: // http://msdn.microsoft.com/en-us/library/windowsazure/jj151531.aspx.
*/
exports.createPackageFile = function (outputRoot, tempPackagePath, packageName, callback) {
  var packagePath = path.join(outputRoot, packageName);

  var contentTypes = new ContentTypes();

  wrench.readdirRecursive(tempPackagePath, function(error, curFiles) {
    if (!curFiles) {
      createPackage();
    }

    curFiles.forEach(function (file) {
      if (file.substr(0, 'LocalContent'.length) === 'LocalContent') {
        contentTypes.addOverride('/' + file, 'application/octet-stream');
      }

      try {
        var content = fs.readFileSync(path.join(tempPackagePath, file));
        zip.file(file, content.toString('base64'), { base64: true });
      } catch (e) {
        // skip directories
      }
    });
  });

  function createPackage() {
    // Add content types file
    zip.file('[Content_Types].xml', contentTypes.generate().toString());

    // Add .rels file
    zip.file('_rels/.rels', rels.generate().toString());

    // Create .cspkg
    var data = zip.generate({ base64: false, compression: 'STORE' });
    fs.writeFileSync(packagePath, data, 'binary');

    // Remove temporary packaging directory
    wrench.rmdirSyncRecursive(tempPackagePath);

    callback();
  }
};