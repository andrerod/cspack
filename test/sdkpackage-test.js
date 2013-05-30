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

var SDKPackage = require('../lib/sdkpackage');
var utils = require('../lib/util/utils');

describe('sdkpackage', function() {
  var subject;
  var cachePath = path.join(__dirname, 'cache');

  beforeEach(function (done) {
    subject = new SDKPackage({ cachePath: cachePath });
    done();
  });

  afterEach(function (done) {
    utils.rmDirRecursive(cachePath, done);
  });

  describe('getFiles', function () {
    it('should work', function (done) {
      subject.getFiles(function (err, files) {
        should.not.exist(err);
        should.exist(files);

        files.length.should.be.above(0);

        done();
      });
    });
  });

  describe('getFile', function () {
    it('should work', function (done) {
      subject.getFiles(function (err, files) {
        should.not.exist(err);
        should.exist(files);

        files.length.should.be.above(0);

        subject.getFile(files[0].name, function (err, data) {
          should.not.exist(err);
          should.exist(data);

          done();
        });
      });
    });
  });

  describe('getVersion', function () {
    it('should work', function (done) {
      subject.getVersion(function (err, version) {
        should.not.exist(err);
        should.exist(version);

        done();
      });
    });
  });
});