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

'use strict';

var fs = require('fs');

var _ = require('underscore');
var Handlebars = require('handlebars');

var utils = require('./util/utils');

/**
* Creates a new handlebars view engine.
*
* @constructor
*
*/
function HandlebarsView(options) {
  utils.validateArgs('HandlebarsView', function (v) {
    v.object(options, 'options');
    v.string(options.templateFilePath, 'options.templateFilePath');
  });

  this.templateFilePath = options.templateFilePath;
  this.addBOM = options.addBOM || false;
}

_.extend(HandlebarsView.prototype, {
  render: function (templateFilePath, templateData, addBOM, unixFormat) {
    // TODO: the replace is a temporary hack that needs to be removed in the future.
    var content = Handlebars.compile(
      fs.readFileSync(templateFilePath).toString()
    )(templateData).replace(/\&\#92;/g, '\\');

    if (addBOM) {
      content = utils.addBOM(content);
    }

    if (!unixFormat) {
      if (content.indexOf('\r\n') === -1) {
        content = content.replace(/\n/g, '\r\n');
      }
    }

    return content;
  }
});

module.exports = HandlebarsView;