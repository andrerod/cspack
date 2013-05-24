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

var should = require('should');

var CsPack = require('../lib/cspack');

describe('cspack', function () {
  describe('fetch sdk package', function () {
    var subject;

    beforeEach(function (done) {
      subject = new CsPack({ outputDirectory: '/Users/andrerod/workspace/scaffold/' });

      done();
    });

    it('should work', function (done) {
      subject.fetchBasePackage(function (err) {
        should.not.exist(err);

        done();
      });
    });
  });
});