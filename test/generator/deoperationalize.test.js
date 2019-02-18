'use strict';

const assert = require('assertive');
const t = require('babel-types');
const generate = require('babel-generator').default;
const identity = require('lodash/identity');

const BuiltInTypes = require('../../lib/generator/built-in');
const TypeMap = require('../../lib/generator/type-map');
const Connectionator = require('../../lib/generator/connectionator');

const deoperationalize = require('../../lib/generator/deoperationalize');

function opToCode(op, extract = identity) {
  const builtIn = new BuiltInTypes();
  const output = new TypeMap(builtIn, false);
  const input = new TypeMap(builtIn, true);
  const connections = new Connectionator(output);
  const property = deoperationalize(op, input, output, connections);
  t.assertObjectProperty(property);
  return generate(extract(property, { output }), { quotes: 'single' }).code;
}

describe('deoperationalize', () => {
  it('generates an object property', () => {
    assert.equal(
      `\
myApiCall: {
  type: GraphQLString,
  args: {
    xFoo: {
      type: GraphQLNonNull(GraphQLString)
    },
    y: {
      type: GraphQLString
    },
    thingId: {
      type: GraphQLNonNull(GraphQLID)
    },
    xCustomHeader: {
      type: GraphQLString
    }
  },

  async resolve(parent, options, context, info) {
    if (context[VERIFY_AUTH_STATUS]) {
      const securityConfig = {};
      context[VERIFY_AUTH_STATUS](securityConfig);
    }

    const data = await context[FETCH]('/some/{thingId}', {
      method: 'PUT',
      endpointName: 'My.API/#Call',
      qs: {
        'x-foo': options.xFoo,
        'y': options.y
      },
      pathParams: {
        'thingId': options.thingId
      },
      headers: {
        'x-custom-header': options.xCustomHeader
      },
      json: undefined
    }).json();
    return data;
  }

}`,
      opToCode({
        method: 'PUT',
        path: '/some/{thingId}',
        operationId: 'My.API/#Call',
        responses: { 200: { schema: { type: 'string' } } },
        parameters: [
          {
            name: 'x-foo',
            type: 'string',
            in: 'query',
            required: true,
          },
          {
            name: 'y',
            type: 'string',
            in: 'query',
            required: false,
          },
          {
            name: 'thingId',
            type: 'string',
            format: 'uuid',
            in: 'path',
            required: true,
          },
          {
            name: 'x-custom-header',
            type: 'string',
            in: 'header',
            required: false,
          },
        ],
      })
    );
  });

  it('generates *Response types for empty responses', () => {
    const responseTypeName = 'MyApiCallResponse';
    const responseSwaggerName = 'myApiCall_Response';
    assert.equal(
      `\
myApiCall: {
  type: ${responseTypeName},
  args: {
    x: {
      type: GraphQLString
    }
  },

  async resolve(parent, options, context, info) {
    if (context[VERIFY_AUTH_STATUS]) {
      const securityConfig = {};
      context[VERIFY_AUTH_STATUS](securityConfig);
    }

    const data = await context[FETCH]('/some/path', {
      method: 'DELETE',
      endpointName: 'My.API/#Call',
      qs: {
        'x': options.x
      },
      pathParams: undefined,
      headers: undefined,
      json: undefined
    }).text();
    return {
      rawResponseBody: data,
      rawInputOptions: options
    };
  }

}`,
      opToCode(
        {
          method: 'DELETE',
          path: '/some/path',
          operationId: 'My.API/#Call',
          responses: { 200: {} },
          parameters: [
            { name: 'x', in: 'query', required: false, type: 'string' },
          ],
        },
        (node, { output }) => {
          const responseType = output.getBySwaggerName(responseSwaggerName);
          assert.truthy(responseType);
          assert.equal(
            `\
const ${responseTypeName} = new GraphQLObjectType({
  name: '${responseTypeName}',
  fields: () => ({
    rawResponseBody: {
      type: GraphQLString
    },
    rawInputOptions: {
      type: MyApiCallResponseRawInputOptions
    }
  })
});`,
            generate(responseType.ast, { quotes: 'single' }).code
          );
          return node;
        }
      )
    );
  });

  it('marks required parameters as non-nullable', () => {
    assert.equal(
      `\
args: {
  x: {
    type: GraphQLNonNull(GraphQLString)
  },
  y: {
    type: GraphQLString
  },
  h: {
    type: GraphQLString
  }
}`,
      opToCode(
        {
          method: 'PUT',
          path: '/some/path',
          operationId: 'My.API/#Call',
          responses: { 200: { schema: { type: 'string' } } },
          parameters: [
            {
              name: 'x',
              type: 'string',
              in: 'query',
              required: true,
            },
            {
              name: 'y',
              type: 'string',
              in: 'query',
              required: false,
            },
            {
              name: 'h',
              type: 'string',
              in: 'header',
              required: false,
            },
          ],
        },
        node => node.value.properties.find(p => p.key.name === 'args')
      )
    );
  });

  it('adds cursor-based args to top-level connection fields', () => {
    assert.equal(
      `\
myApiCall: {
  type: UnknownType1Connection,
  args: {
    foo: {
      type: GraphQLString
    },
    first: {
      type: GraphQLInt
    },
    after: {
      type: GraphQLString
    },
    last: {
      type: GraphQLInt
    },
    before: {
      type: GraphQLString
    }
  },

  async resolve(parent, options, context, info) {
    if (context[VERIFY_AUTH_STATUS]) {
      const securityConfig = {};
      context[VERIFY_AUTH_STATUS](securityConfig);
    }

    const data = await context[FETCH]('/some/things', {
      method: 'GET',
      endpointName: 'getMy.API/#Call',
      qs: {
        'foo': options.foo,
        ...parseCursorOptions(options)
      },
      pathParams: undefined,
      headers: undefined,
      json: undefined
    }).json();
    return convertArrayToConnection(null, data, options);
  }

}`,
      opToCode({
        method: 'GET',
        path: '/some/things',
        operationId: 'getMy.API/#Call',
        responses: {
          200: {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        parameters: [
          {
            name: 'foo',
            in: 'query',
            type: 'string',
          },
        ],
      })
    );
  });

  it('adds cursor-based args to connection fields', () => {
    assert.equal(
      `\
myApiCall: {
  type: GraphQlStringConnection,
  args: {
    foo: {
      type: GraphQLString
    },
    first: {
      type: GraphQLInt
    },
    after: {
      type: GraphQLString
    },
    last: {
      type: GraphQLInt
    },
    before: {
      type: GraphQLString
    }
  },

  async resolve(parent, options, context, info) {
    if (context[VERIFY_AUTH_STATUS]) {
      const securityConfig = {};
      context[VERIFY_AUTH_STATUS](securityConfig);
    }

    const data = await context[FETCH]('/some/things', {
      method: 'GET',
      endpointName: 'getMy.API/#Call',
      qs: {
        'foo': options.foo,
        ...parseCursorOptions(options)
      },
      pathParams: undefined,
      headers: undefined,
      json: undefined
    }).json();
    const nodes = data.things;
    return convertArrayToConnection(data, nodes, options);
  }

}`,
      opToCode({
        method: 'GET',
        path: '/some/things',
        operationId: 'getMy.API/#Call',
        responses: {
          200: {
            schema: {
              type: 'object',
              properties: {
                things: { type: 'array', items: { type: 'string' } },
                pagination: {
                  type: 'object',
                  properties: {
                    count: { type: 'integer' },
                    offset: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
        parameters: [
          {
            name: 'foo',
            in: 'query',
            type: 'string',
          },
        ],
        'x-root-property': 'things',
      })
    );
  });

  it('loads securityConfig ', () => {
    assert.equal(
      `\
myApiCall: {
  type: GraphQLString,
  args: {
    x: {
      type: GraphQLString
    }
  },

  async resolve(parent, options, context, info) {
    if (context[VERIFY_AUTH_STATUS]) {
      const securityConfig = {
        "security": [{
          "petstore_auth": ["write:pets", "read:pets"],
          "oauth": []
        }, {
          "petstore_auth": ["read:pets"]
        }],
        "definitions": {}
      };
      context[VERIFY_AUTH_STATUS](securityConfig);
    }

    const data = await context[FETCH]('/some/thing', {
      method: 'GET',
      endpointName: 'My.API/#Call',
      qs: {
        'x': options.x
      },
      pathParams: undefined,
      headers: undefined,
      json: undefined
    }).json();
    return data;
  }

}`,
      opToCode({
        method: 'GET',
        path: '/some/thing',
        security: [
          { petstore_auth: ['write:pets', 'read:pets'], oauth: [] },
          { petstore_auth: ['read:pets'] },
        ],
        operationId: 'My.API/#Call',
        responses: { 200: { schema: { type: 'string' } } },
        parameters: [
          {
            name: 'x',
            type: 'string',
            in: 'query',
            required: false,
          },
        ],
      })
    );
  });
});
