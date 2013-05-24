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

var should = require('should');

var constants = require('../lib/util/constants');

var HashedPackage = require('../lib/hashedpackage');
var ZipDataStore = require('../lib/store/zipdatastore');
var HandlebarsView = require('../lib/handlebarsview');
var utils = require('../lib/util/utils');

describe('hashedpackage', function(){
  var subject;

  beforeEach(function (done) {
    subject = new HashedPackage({
      productVersion: '1.8.31004.1351',
      dataStore: new ZipDataStore(),
      viewEngine: new HandlebarsView({ templateFilePath: path.join(__dirname, '../lib/templates/', constants.TemplatePaths.PackageManifest) })
    });
    done();
  });

  describe('content definition', function() {
    describe('add', function () {
      var contentName1 = 'mycontent';
      var contentName2 = 'mycontent2';
      var fixtureFullPath = path.join(__dirname, 'fixtures/NamedStreams/RequiredFeatures/WorkerRole/1.0');

      it('should work', function (done) {
        subject.addContentDefinition('LocalContent', contentName1, { filePath: fixtureFullPath }, function (err, contentDefinition) {
          should.not.exist(err);
          should.exist(contentDefinition);
          contentDefinition.Name.should.equal(subject.normalizeContentName(path.join('LocalContent', contentName1)));

          done();
        });
      });

      it('should reuse a content if available', function (done) {
        subject.addContentDefinition('LocalContent', contentName1, { filePath: fixtureFullPath }, function (err1, contentDefinition1) {
          should.not.exist(err1);
          should.exist(contentDefinition1);
          contentDefinition1.Name.should.equal(subject.normalizeContentName(path.join('LocalContent', contentName1)));

          subject.addContentDefinition('LocalContent', contentName2, { filePath: fixtureFullPath }, function (err2, contentDefinition2) {
            should.not.exist(err2);
            should.exist(contentDefinition2);

            contentDefinition2.Name.should.equal(contentDefinition1.Name);

            done();
          });
        });
      });
    });
  });
});