/**
* Copyright 2012 Microsoft Corporation
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

var PackageManifest = require('../../../lib/cspack/models/packagemanifest');

describe('packagemanifest', function(){
  describe('generate', function () {
    it('should work with no data', function(done) {
      console.log('hi there');

      var packageManifest = new PackageManifest();

      console.log(packageManifest);
      var result = packageManifest.generate();
      console.log(result);

      done();
    });
  });
});