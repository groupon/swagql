'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');

const assert = require('assertive');
const { graphql } = require('graphql');
const { fetch } = require('gofer');
const http = require('http');

const generateSchema = require('../../lib/generate-schema');

describe('SwagQL', () => {
  const port = 4000;
  let server;

  before(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/v2/pet/1') {
        res.end(
          JSON.stringify({
            id: 1,
            name: 'MaxTheDog',
            'nick-name': 'Honey Bear',
            '5 Things are Neato!': 'It worked!',
          })
        );
      }
    });
    await server.listen(port);
  });

  after(() => server.close());

  it('creates a working module', async () => {
    const swaggerSchema = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'petstore.json'))
    );

    const gqlResult = await generateSchema(swaggerSchema, [
      path.join(__dirname, '..', 'fixtures', 'require-os-plugin.js'),
    ]);

    assert.truthy(
      'updatePet result includes parameter from path',
      gqlResult.ast.program.body
        .find(
          n =>
            n.type === 'VariableDeclaration' &&
            n.declarations[0].id.name === 'Mutation'
        )
        .declarations[0].init.arguments[0].properties.find(
          p => p.key.name === 'fields'
        )
        .value.properties.find(p => p.key.name === 'updatePet')
        .value.properties.find(p => p.key.name === 'args')
        .value.properties.find(p => p.key.name === 'debug')
    );

    // assert that the swagqlType is present and has the apiType object
    for (const p of gqlResult.ast.program.body) {
      if (!p.swagqlType) continue;
      assert.hasType(Object, p.swagqlType.apiType);
    }

    const { code: source } = gqlResult;

    // create and load a temporary graphql schema module
    const hypath = path.join(__dirname, '../../lib/schema.js');
    const gqlSchemaModule = new Module(hypath);
    gqlSchemaModule.filename = hypath;
    gqlSchemaModule.paths = Module['_nodeModulePaths'](
      path.join(__dirname, '..', '..')
    );
    gqlSchemaModule['_compile'](source, hypath);

    assert.match(/^\/\/ Generated by /, source.slice(0, source.indexOf('\n')));

    // check if our require-os plugin worked.
    assert.match(
      /const os = require\('os'\)/,
      source.slice(0, source.indexOf(';'))
    );

    const result = await graphql(
      gqlSchemaModule.exports.schema,
      `
        query MyQuery($petId: Int!) {
          petById(petId: $petId) {
            id
            name
            nickName
            _5ThingsAreNeato
          }
        }
      `,
      null,
      {
        [gqlSchemaModule.exports.FETCH](urlPath, options) {
          return fetch(`http://localhost:${port}/v2${urlPath}`, options);
        },
        [gqlSchemaModule.exports.VERIFY_AUTH_STATUS]() {},
      },
      { petId: 1 }
    );
    assert.notEqual(null, result);
    assert.notEqual(null, result.data);
    assert.equal(undefined, result.errors);

    assert.notEqual(null, result.data.me);
    assert.equal(1, result.data.petById.id);

    assert.notEqual(null, result.data.myPlaces);
    assert.equal('Honey Bear', result.data.petById.nickName);
    assert.equal('It worked!', result.data.petById._5ThingsAreNeato);
  });
});
