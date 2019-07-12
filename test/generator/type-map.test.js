'use strict';

const assert = require('assertive');
const t = require('babel-types');
const generate = require('babel-generator').default;

const BuiltInTypes = require('../../lib/generator/built-in');
const TypeMap = require('../../lib/generator/type-map');

const SIMPLE_OBJ = {
  type: 'object',
  properties: {
    x: { type: 'boolean' },
    y: { type: 'string' },
    z: { type: 'number' },
  },
  required: ['x', 'z'],
};

const YOLO_OBJ = {
  type: 'object',
  additionalProperties: {
    type: 'string',
  },
};

const EMPTY_OBJ = {
  type: 'object',
};

const BAD_NAMES_OBJ = {
  type: 'object',
  properties: {
    1: { type: 'number' },
    'bad-name': { type: 'string' },
    'Bad?Name': { type: 'string' },
    'Bad Name': { type: 'string' },
  },
};

describe('TypeMap', () => {
  it('can manage type defintions', () => {
    const builtIn = new BuiltInTypes();
    const typeMap = new TypeMap(builtIn);
    typeMap.addSwaggerDefinition(SIMPLE_OBJ, 'My.Type/#bar');
    const type = typeMap.getBySwaggerName('My.Type/#bar');
    assert.equal('MyTypeBar', type.graphqlName);
    t.assertIdentifier(type.ref(), { name: type.graphqlName });
  });

  it('can handle naming collisions', () => {
    const builtIn = new BuiltInTypes();
    const typeMap = new TypeMap(builtIn);
    typeMap.addSwaggerDefinition(SIMPLE_OBJ, 'My.Type/#bar');
    const firstType = typeMap.getBySwaggerName('My.Type/#bar');
    assert.equal('MyTypeBar', firstType.graphqlName);
    t.assertIdentifier(firstType.ref(), { name: firstType.graphqlName });

    typeMap.addSwaggerDefinition(SIMPLE_OBJ, 'My.Type.bar');
    const colliding = typeMap.getBySwaggerName('My.Type.bar');
    assert.equal('MyTypeBar2', colliding.graphqlName);
    t.assertIdentifier(colliding.ref(), { name: colliding.graphqlName });
  });

  it('can handle recursive lists', () => {
    const builtIn = new BuiltInTypes();
    const typeMap = new TypeMap(builtIn);

    const recursive = {
      type: 'object',
      properties: {
        children: { type: 'array' },
      },
    };
    recursive.properties.children.items = recursive;
    typeMap.addSwaggerDefinition(recursive, 'Recursive');
    t.assertIdentifier(typeMap.ref(recursive), { name: 'Recursive' });
    assert.equal(
      `\
const Recursive = new GraphQLObjectType({
  name: 'Recursive',
  fields: () => ({
    children: {
      type: new GraphQLList(Recursive)
    }
  })
});`,
      generate(t.program(typeMap.astNodes), { quotes: 'single' }).code
    );
  });

  it('exposes an array of ast nodes', () => {
    const builtIn = new BuiltInTypes();
    const typeMap = new TypeMap(builtIn);
    typeMap.addSwaggerDefinition(SIMPLE_OBJ, 'My.Type/#bar');
    t.assertIdentifier(typeMap.ref(SIMPLE_OBJ), { name: 'MyTypeBar' });

    assert.equal(
      `const MyTypeBar = new GraphQLObjectType({
  name: 'MyTypeBar',
  fields: () => ({
    x: {
      type: GraphQLNonNull(GraphQLBoolean)
    },
    y: {
      type: GraphQLString
    },
    z: {
      type: GraphQLNonNull(GraphQLFloat)
    }
  })
});`,
      generate(t.program(typeMap.astNodes), { quotes: 'single' }).code
    );
  });

  it('handles objects with additionalProperties', () => {
    const builtIn = new BuiltInTypes();
    const typeMap = new TypeMap(builtIn);
    typeMap.addSwaggerDefinition(YOLO_OBJ, 'RandomShape');
    t.assertIdentifier(typeMap.ref(YOLO_OBJ), { name: 'RandomShape' });

    assert.equal(
      `const RandomShape = new GraphQLScalarType({
  name: 'RandomShape',

  serialize(value) {
    return value;
  }

});`,
      generate(t.program(typeMap.astNodes), { quotes: 'single' }).code
    );
  });

  it('handles objects with no properties at all', () => {
    const builtIn = new BuiltInTypes();
    const typeMap = new TypeMap(builtIn);
    typeMap.addSwaggerDefinition(EMPTY_OBJ, 'EmptyObj');
    t.assertIdentifier(typeMap.ref(EMPTY_OBJ), { name: 'EmptyObj' });

    assert.equal(
      `const EmptyObj = new GraphQLScalarType({
  name: 'EmptyObj',

  serialize(value) {
    return value;
  }

});`,
      generate(t.program(typeMap.astNodes), { quotes: 'single' }).code
    );
  });

  it('handles objects with invalid property key names', () => {
    const builtIn = new BuiltInTypes();
    const typeMap = new TypeMap(builtIn);
    typeMap.addSwaggerDefinition(BAD_NAMES_OBJ, 'BadNames');
    t.assertIdentifier(typeMap.ref(BAD_NAMES_OBJ), { name: 'BadNames' });

    assert.equal(
      `const BadNames = new GraphQLObjectType({
  name: 'BadNames',
  fields: () => ({
    _1: {
      type: GraphQLString,
      resolve: obj => obj['1']
    },
    badName: {
      type: GraphQLString,
      resolve: obj => obj['bad-name']
    },
    badName2: {
      type: GraphQLString,
      resolve: obj => obj['Bad?Name']
    },
    badName3: {
      type: GraphQLString,
      resolve: obj => obj['Bad Name']
    }
  })
});`,
      generate(t.program(typeMap.astNodes), { quotes: 'single' }).code
    );
  });

  it('can generate a list of scalars', () => {
    const builtIn = new BuiltInTypes();
    const typeMap = new TypeMap(builtIn, false);
    const scalarListType = {
      type: 'array',
      items: {
        type: 'object',
      },
    };
    const wrapObject = {
      type: 'object',
      properties: {
        list: scalarListType,
      },
    };
    const wrapRef = typeMap.ref(wrapObject);
    t.identifier(wrapRef);

    // The order here is important: We absolutely need to put the scalar first
    // so it can be referenced in the list type.
    assert.equal(
      `\
const UnknownType2 = new GraphQLScalarType({
  name: 'UnknownType2',

  serialize(value) {
    return value;
  }

});
const UnknownType1 = new GraphQLObjectType({
  name: 'UnknownType1',
  fields: () => ({
    list: {
      type: new GraphQLList(UnknownType2)
    }
  })
});`,
      generate(t.program(typeMap.astNodes), { quotes: 'single' }).code
    );
  });

  it('can create Input types', () => {
    const builtIn = new BuiltInTypes();
    const typeMap = new TypeMap(builtIn, true);
    typeMap.addSwaggerDefinition(SIMPLE_OBJ, 'My.Type/#bar');
    t.assertIdentifier(typeMap.ref(SIMPLE_OBJ), { name: 'MyTypeBarInput' });

    assert.equal(
      `const MyTypeBarInput = new GraphQLInputObjectType({
  name: 'MyTypeBarInput',
  fields: () => ({
    x: {
      type: GraphQLNonNull(GraphQLBoolean)
    },
    y: {
      type: GraphQLString
    },
    z: {
      type: GraphQLNonNull(GraphQLFloat)
    }
  })
});`,
      generate(t.program(typeMap.astNodes), { quotes: 'single' }).code
    );
  });
});
