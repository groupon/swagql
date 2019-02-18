'use strict';

const assert = require('assertive');
const generate = require('babel-generator').default;
const t = require('babel-types');

const BuiltInTypes = require('../../lib/generator/built-in');

function render(builtIn) {
  return generate(builtIn.ast, { quotes: 'single' }).code;
}

describe('BuiltInTypes', () => {
  it('exists', () => {
    assert.hasType(Function, BuiltInTypes);
  });

  it('exposes a single VariableDeclaration node', () => {
    assert.equal('VariableDeclaration', new BuiltInTypes().ast.type);
  });

  it('includes schema and object by default', () => {
    assert.equal(
      `const {
  GraphQLObjectType,
  GraphQLSchema
} = require('graphql');`,
      render(new BuiltInTypes())
    );
  });

  it('returns identifiers for referenced types', () => {
    const builtIn = new BuiltInTypes();
    const ref = builtIn.ref('GraphQLBoolean');
    t.assertIdentifier(ref, { name: 'GraphQLBoolean' });
  });

  it('supports swagger-style refs', () => {
    const builtIn = new BuiltInTypes();
    const ref = builtIn.resolveSwagger({ type: 'boolean' });
    t.assertIdentifier(ref, { name: 'GraphQLBoolean' });
  });

  it('converts string#format=uuid to ID', () => {
    const builtIn = new BuiltInTypes();
    const ref = builtIn.resolveSwagger({ type: 'string', format: 'uuid' });
    t.assertIdentifier(ref, { name: 'GraphQLID' });
  });

  it('returns null for invalid types', () => {
    const builtIn = new BuiltInTypes();
    const ref = builtIn.ref('SomeRandomProp');
    assert.equal(null, ref);
  });

  it('includes additional types if they are used', () => {
    const builtIn = new BuiltInTypes();
    builtIn.ref('GraphQLBoolean');
    builtIn.ref('GraphQLList');
    assert.equal(
      `const {
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLBoolean,
  GraphQLList
} = require('graphql');`,
      render(builtIn)
    );
  });
});
