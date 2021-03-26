/*
 * Copyright (c) 2019, Groupon, Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 * Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright
 * notice, this list of conditions and the following disclaimer in the
 * documentation and/or other materials provided with the distribution.
 *
 * Neither the name of GROUPON nor the names of its contributors may be
 * used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
 * IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 * PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

const program = require('commander');
const YAML = require('js-yaml');
const generateSchema = require('../lib/generate-schema');
const { version } = require('../package.json');

program
  .version(version)
  .option('-p, --plugins <type>', 'List of babel plugins', p => p.split(','))
  .option('-n, --name-prefix <str>', 'Prefix to prepend onto ops & types')
  .parse(process.argv);

function main(isCli) {
  if (!isCli) return;

  process.stdin.setEncoding('utf8');

  let inputData = '';
  process.stdin.on('data', chunk => {
    inputData = inputData + chunk;
  });

  process.stdin.on('end', async () => {
    try {
      const swaggerSpec = await YAML.load(inputData);
      const schema = await generateSchema(
        swaggerSpec,
        program.plugins,
        program.namePrefix
      );
      process.stdout.write(schema.code.trim());
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  });
}

module.exports = main;
