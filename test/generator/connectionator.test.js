'use strict';

const assert = require('assertive');
const t = require('babel-types');
const generate = require('babel-generator').default;

const BuiltInTypes = require('../../lib/generator/built-in');
const Connectionator = require('../../lib/generator/connectionator');
const TypeMap = require('../../lib/generator/type-map');

describe('Connectionator', () => {
  it('generates intermediate types for an element type', () => {
    const builtIn = new BuiltInTypes();
    const typeMap = new TypeMap(builtIn);
    const connectionator = new Connectionator(typeMap);

    const itemTypeA = {
      type: 'object',
      properties: {
        foo: { type: 'boolean' },
      },
    };
    typeMap.addSwaggerDefinition(itemTypeA, 'A');
    const itemTypeB = {
      type: 'object',
      properties: {
        foo: { type: 'boolean' },
      },
    };
    typeMap.addSwaggerDefinition(itemTypeB, 'B');
    const wrapTypeB = {
      type: 'object',
      properties: {
        results: { type: 'array', items: itemTypeB },
        score: { type: 'number' },
      },
    };

    const AConnectionType = connectionator.get({
      type: 'array',
      items: itemTypeA,
    });
    const BConnectionType = connectionator.get(wrapTypeB, 'results');
    const AConnectionType2 = connectionator.get({
      type: 'array',
      items: itemTypeA,
    });

    assert.equal(
      'creates one connection type per element type',
      AConnectionType,
      AConnectionType2
    );
    assert.notEqual(
      'creates individual connection types for each element type',
      AConnectionType,
      BConnectionType
    );

    t.assertIdentifier(AConnectionType, { name: 'AConnection' });
    t.assertIdentifier(BConnectionType, { name: 'BConnection' });

    const AConnectionAST = typeMap.getBySwaggerName('AConnection').ast;
    const AEdgeAST = typeMap.getBySwaggerName('AEdge').ast;
    assert.equal(
      `\
const AConnection = new GraphQLObjectType({
  name: 'AConnection',
  fields: () => ({
    nodes: {
      type: new GraphQLList(A)
    },
    edges: {
      type: new GraphQLList(AEdge)
    },
    pageInfo: {
      type: GraphQLNonNull(PageInfo)
    },
    totalCount: {
      type: GraphQLNonNull(GraphQLInt)
    }
  })
});
const AEdge = new GraphQLObjectType({
  name: 'AEdge',
  fields: () => ({
    cursor: {
      type: GraphQLNonNull(GraphQLString)
    },
    node: {
      type: A
    }
  })
});`,
      generate(t.program([].concat(AConnectionAST, AEdgeAST)), {
        quotes: 'single',
      }).code
    );

    const BConnectionAST = typeMap.getBySwaggerName('BConnection').ast;
    assert.equal(
      `\
const BConnection = new GraphQLObjectType({
  name: 'BConnection',
  fields: () => ({
    score: {
      type: GraphQLFloat
    },
    nodes: {
      type: new GraphQLList(B)
    },
    edges: {
      type: new GraphQLList(BEdge)
    },
    pageInfo: {
      type: GraphQLNonNull(PageInfo)
    },
    totalCount: {
      type: GraphQLNonNull(GraphQLInt)
    }
  })
});`,
      generate(t.program([].concat(BConnectionAST)), {
        quotes: 'single',
      }).code
    );
  });
});
