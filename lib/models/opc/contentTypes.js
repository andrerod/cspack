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

function ContentTypes() {
  this.defaults = null;
  this.overrides = null;

  this.initDefaults();
}

ContentTypes.prototype.initDefaults = function () {
  this.defaults  = [
    {
      '$': {
        Extension: 'csdef',
        ContentType: 'application/octet-stream'
      }
    },
    {
      '$': {
        Extension: 'rd',
        ContentType: 'application/octet-stream'
      }
    },
    {
      '$': {
        Extension: 'rdsc',
        ContentType: 'application/octet-stream'
      }
    },
    {
      '$': {
        Extension: '0',
        ContentType: 'application/octet-stream'
      }
    },
    {
      '$': {
        Extension: 'xml',
        ContentType: 'application/octet-stream'
      }
    },
    {
      '$': {
        Extension: 'rels',
        ContentType: 'application/vnd.openxmlformats-package.relationships+xml'
      }
    }
  ];
};

ContentTypes.prototype.addOverride  = function (name, contentType) {
  if (!this.overrides) {
    this.overrides = [];
  }

  this.overrides.push({
    '$': {
      PartName: name,
      ContentType: contentType
    }
  });
};

ContentTypes.prototype.generate = function () {
  var types = {
    Types: {
      '$': { xmlns: 'http://schemas.openxmlformats.org/package/2006/content-types' },
      Default: this.defaults
    }
  };

  if (this.overrides) {
    types.Types.Override = this.overrides;
  }

  return js2xml.serialize(types);
};

module.exports = ContentTypes;