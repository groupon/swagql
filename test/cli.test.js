'use strict';

const path = require('path');
const { promisify } = require('util');
const execAsync = promisify(require('child_process').exec);

const assert = require('assertive');

const cliPath = path.join(__dirname, '..', 'cli.js');
const petstorePath = path.join(__dirname, 'fixtures', 'petstore.json');

describe('cli', () => {
  it('accepts --name-prefix', async () => {
    const { stdout: js } = await execAsync(
      `${cliPath} --name-prefix=FOO_ < ${petstorePath}`
    );
    assert.include('FOO_petById:', js);
    assert.include("name: 'FOO_Pet'", js);
  });
});
