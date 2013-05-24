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
var fs = require('fs');

var should = require('should');

var ZipDataStore = require('../lib/store/zipdatastore');

describe('zipdatastore', function() {
  var subject;

  beforeEach(function (done) {
    subject = new ZipDataStore();
    done();
  });

  describe('addContentFromString', function () {
    it('should work', function (done) {
      var contentName = 'manifest.json';
      var content = '{ "sdkVersion": "1.8.31004.1351" }';

      subject.addContentFromString(contentName, content, function (err) {
        should.not.exist(err);

        subject.getContent(contentName, function (err, actualContent) {
          should.not.exist(err);
          actualContent.should.equal(content);

          done();
        });
      });
    });
  });

  describe('addContentFromFile', function () {
    var filePath = path.join(__dirname, 'test.txt');

    var contentName = 'manifest.json';
    var content = 'hi there';

    beforeEach(function (done) {
      fs.writeFile(filePath, content, done);
    });

    afterEach(function (done) {
      fs.unlink(filePath, done);
    });

    it('should work', function (done) {
      subject.addContentFromFile(contentName, filePath, function () {
        subject.getContent(contentName, function (err, actualContent) {
          should.not.exist(err);
          actualContent.should.equal(content);

          done();
        });
      });
    });
  });

  describe('get contents', function () {
    var contentName = 'manifest.json';
    var contentName2 = 'manifest2.json';

    var content = '{ "sdkVersion": "1.8.31004.1351" }';

    beforeEach(function (done) {
      subject.addContentFromString(contentName, content, function () {
        subject.addContentFromString(contentName2, content, done);
      });
    });

    it('should work', function (done) {
      subject.getContents(function (err, contents) {
        should.not.exist(err);
        should.exist(contents);
        contents.length.should.equal(2);

        done();
      });
    });
  });
});