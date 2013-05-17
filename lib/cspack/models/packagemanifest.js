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

var js2xml = require('node-js2xml');

function PackageManifest() {
  this.metadata = null;
  this.contents = null;
  this.layouts = null;

  this.initDefaults();
}

PackageManifest.prototype.initDefaults = function () {
  this.metadata = {
    KeyValuePair: [
      {
        Key: 'http://schemas.microsoft.com/windowsazure/ProductVersion/',
        Value: '1.8.31004.1351'
      }
    ]
  };
};

PackageManifest.prototype.addContentDefinition = function (name, content) {
  throw new Error('not implemented', name, content);
};

PackageManifest.prototype.addFileDefinition = function (roleName, fileName) {
  throw new Error('not implemented', roleName, fileName);
};

PackageManifest.prototype.generateManifest = function () {
  var pkg = {
    PackageDefinition: {
      '$': { xmlns : 'http://schemas.microsoft.com/windowsazure', 'xmlns:i': 'http://www.w3.org/2001/XMLSchema-instance' },
      PackageMetaData: this.metadata,
      PackageContents: this.contents,
      PackageLayouts: this.layouts
    }
  };

  return js2xml.serialize(pkg);
};

module.exports = PackageManifest;