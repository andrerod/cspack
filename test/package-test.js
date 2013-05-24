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

var Package = require('../lib/package');
var ZipDataStore = require('../lib/store/zipdatastore');
var HandlebarsView = require('../lib/handlebarsview');
var utils = require('../lib/util/utils');

describe('package', function(){
  var subject;

  beforeEach(function (done) {
    subject = new Package({
      productVersion: '1.8.31004.1351',
      dataStore: new ZipDataStore(),
      viewEngine: new HandlebarsView({ templateFilePath: path.join(__dirname, '../lib/templates/', constants.TemplatePaths.PackageManifest) })
    });
    done();
  });

  describe('content definition', function() {
    describe('add', function () {
      it('should work', function (done) {
        var contentName = 'mycontent';
        var fixtureFullPath = path.join(__dirname, 'fixtures/NamedStreams/RequiredFeatures/WorkerRole/1.0');

        subject.addContentDefinition('NamedStreams', contentName, { filePath: fixtureFullPath }, function (err, contentDefinition) {
          should.not.exist(err);
          should.exist(contentDefinition);
          contentDefinition.Name.should.equal(subject.normalizeContentName(path.join('NamedStreams', contentName)));
          done();
        });
      });
    });

    describe('get', function () {
      var contentName = 'mycontent';

      beforeEach(function (done) {
        var fixtureFullPath = path.join(__dirname, 'fixtures/NamedStreams/RequiredFeatures/WorkerRole/1.0');
        subject.addContentDefinition('NamedStreams', contentName, { filePath: fixtureFullPath }, done);
      });

      it ('should return null if it does not exist', function (done) {
        should.strictEqual(subject.getContentDefinition('fake'), null);
        done();
      });

      it('should return the content if it does exist', function (done) {
        var contentDefinition = subject.getContentDefinition(path.join('NamedStreams', contentName));

        should.exist(contentDefinition);
        contentDefinition.Name.should.equal(subject.normalizeContentName(path.join('NamedStreams', contentName)));

        done();
      });
    });
  });

  describe('file definition', function () {
    var layoutName = 'mylayout';

    beforeEach(function (done) {
      subject.addLayoutDefinition(layoutName, done);
    });

    describe('add', function () {

    });

    describe('get', function () {
      var contentName = 'mycontent';
      var filePath;

      beforeEach(function (done) {
        var fixtureFullPath = path.join(__dirname, 'fixtures/NamedStreams/RequiredFeatures/WorkerRole/1.0');
        subject.addFileDefinition(layoutName, contentName, { filePath: fixtureFullPath }, done);
      });

      it ('should throw if the layout does not exist', function (done) {
        (function(){ subject.getFileDefinition('fake', 'fake') }).should.throw();
        done();
      });

      it ('should return null if it does not exist', function (done) {
        should.strictEqual(subject.getFileDefinition(layoutName, 'fake'), null);
        done();
      });

      it ('should return if it does exist', function (done) {
        var fileDefinition = subject.getFileDefinition(layoutName, contentName);
        should.exist(fileDefinition);
        fileDefinition.FilePath.should.equal(subject.normalizeFilePath(contentName));
        should.exist(fileDefinition.FileDescription);

        done();
      });
    });
  });

  describe('layout definition', function () {
    describe('add', function () {
      var layoutName = 'mylayout';

      it('should work', function (done) {
        subject.addLayoutDefinition(layoutName, function (err, layoutDefinition) {
          should.not.exist(err);
          should.exist(layoutDefinition);
          layoutDefinition.Name.should.equal(layoutName);
          done();
        });
      });

      it('should return error if layout already exists', function (done) {
        subject.addLayoutDefinition(layoutName, function (err) {
          should.not.exist(err);

          subject.addLayoutDefinition(layoutName, function (err, layoutDefinition) {
            should.exist(err);

            done();
          });
        });
      });
    });

    describe('get', function () {
      var layoutName = 'mylayout';

      beforeEach(function (done) {
        subject.addLayoutDefinition(layoutName, done);
      });

      it('should return null if it does not exist', function (done) {
        should.strictEqual(subject.getLayoutDefinition('fake'), null);
        done();
      });

      it('should return the layout if it does exist', function (done) {
        var layoutDefinition = subject.getLayoutDefinition(layoutName);

        should.exist(layoutDefinition);
        layoutDefinition.Name.should.equal(layoutName);

        done();
      });
    });
  });

  describe('generate manifest', function () {
    var contentName = 'mycontent';
    var layoutName = 'roles/role1';

    before(function (done) {
      var fixtureFullPath = path.join(__dirname, 'fixtures/NamedStreams/RequiredFeatures/WorkerRole/1.0');
      subject.addLayoutDefinition(layoutName, function () {
        subject.addFileDefinition(layoutName, contentName, { filePath: fixtureFullPath }, done);
      });
    });

    it('should work', function (done) {
      var fixtureFullPath = path.join(__dirname, 'fixtures/NamedStreams/RequiredFeatures/WorkerRole/1.0');
      subject.addLayoutDefinition(layoutName, function () {
        subject.addFileDefinition(layoutName, contentName, { filePath: fixtureFullPath }, function () {
          subject.generateManifest(function (err) {
            should.not.exist(err);

            subject.dataStore.getContent(constants.PackagePaths.PackageManifest, function (err, manifest) {
              should.not.exist(err);

              utils.parseXml(manifest, function (err, parsedXml) {
                should.not.exist(err);

                should.exist(parsedXml.PackageDefinition);
                should.exist(parsedXml.PackageDefinition.PackageContents);
                should.exist(parsedXml.PackageDefinition.PackageLayouts);
                should.exist(parsedXml.PackageDefinition.PackageLayouts.LayoutDefinition);
                parsedXml.PackageDefinition.PackageLayouts.LayoutDefinition.Name.should.equal(layoutName);
                should.exist(parsedXml.PackageDefinition.PackageLayouts.LayoutDefinition.LayoutDescription.FileDefinition);

                done();
              });
            });
          });
        });
      });
    });
  });
});