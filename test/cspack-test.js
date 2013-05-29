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

var constants = require('../lib/util/constants');
var utils = require('../lib/util/utils');

var ZipDataStore = require('../lib/store/zipdatastore');

var CsPack = require('../lib/cspack');

describe('cspack', function() {
  var subject;
  var outputFile = path.join(__dirname, 'results.cspkg');

  beforeEach(function (done) {
    subject = new CsPack({
      inputDirectory: path.join(__dirname, 'fixtures/scaffold'),
      serviceDefinitionFile: path.join(__dirname, 'fixtures/scaffold/ServiceDefinition.csdef'),
      outputFile: outputFile
    });

    done();
  });

  afterEach(function (done) {
    utils.rmDirRecursive(path.join(__dirname, '../lib/cache'), function () {
      if (!process.env.CSPACK_KEEP_PACKAGE) {
        fs.unlink(outputFile, done);
      } else {
        done();
      }
    });
  });

  describe('execute', function () {
    it('should work', function (done) {
      subject.execute(function (err) {
        var targetFile = '\\base\\x64\\WaHostBootstrapper.exe.config';

        should.not.exist(err);

        var zipDataStore = new ZipDataStore({
          archiveFile: outputFile
        });

        zipDataStore.getContent('package.xml', function (err, manifest) {
          should.not.exist(err);
          should.exist(manifest);

          utils.parseXmlString(manifest, function (err, parsedManifest) {
            should.not.exist(err);

            var workerRoleLayout = parsedManifest.PackageDefinition.PackageLayouts.LayoutDefinition.filter(function (l) {
              return l.Name === 'Roles/WorkerRole1';
            })[0];

            should.exist(workerRoleLayout);

            var configFile = workerRoleLayout.LayoutDescription.FileDefinition.filter(function (f) {
              return f.FilePath === targetFile;
            })[0];

            should.exist(configFile);

            var dataContent = parsedManifest.PackageDefinition.PackageContents.ContentDefinition.filter(function (c) {
              return c.Name === configFile.FileDescription.DataContentReference;
            })[0];

            should.exist(dataContent);

            dataContent.ContentDescription.LengthInBytes.should.equal('268');
            dataContent.ContentDescription.IntegrityCheckHash.should.equal('7px+7sHj+QGNXgFEma367q0Tv/0BAmFGY1khm4CtvCs=');
            dataContent.ContentDescription.IntegrityCheckHashAlgortihm.should.equal('Sha256');

            zipDataStore.getContent(configFile.FileDescription.DataContentReference, function (err, content) {
              should.not.exist(err);
              should.exist(content);

              done();
            });
          });
        });
      });
    });
  });
});