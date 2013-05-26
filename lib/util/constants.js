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

var _ = require('underscore');

_.extend(exports, {
  PackagePaths: {
    LocalContent: 'LocalContent',
    NamedStreams: 'NamedStreams',
    ServiceDefinition: 'ServiceDefinition',
    PackageManifest: 'package.xml'
  },

  TemplatePaths: {
    PackageManifest: 'package.xml.handlebars'
  },

  IntegrityCheckHashAlgortihms: {
    Sha256: 'Sha256'
  },

  DefaultSDKLocation: {
    manifest: 'https://raw.github.com/andrerod/cspack/dev2/lib/pkg/sdk.json',
    bits: 'https://raw.github.com/andrerod/cspack/dev2/lib/pkg/sdk.zip'
  }
});